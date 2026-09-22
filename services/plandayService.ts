import { PlandayApiCredentials, Employee, Department, EmployeeGroup, TerminationType, DeactivationPayload } from '../types';

const AUTH_URL = 'https://id.planday.com/connect/token';
const API_BASE_URL = 'https://openapi.planday.com';

let credentials_internal: PlandayApiCredentials | null = null;
let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let globalDelayUntil = 0;

export function initializeService(credentials: PlandayApiCredentials) {
    if (credentials_internal?.clientId !== credentials.clientId || credentials_internal?.refreshToken !== credentials.refreshToken) {
        accessToken = null;
        tokenExpiry = null;
    }
    credentials_internal = { ...credentials };
}

export function resetService() {
    credentials_internal = null;
    accessToken = null;
    tokenExpiry = null;
}

async function wait(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getAccessToken(): Promise<string> {
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken;
    }

    if (!credentials_internal) {
        throw new Error("Planday service not initialized with credentials.");
    }

    const payload = new URLSearchParams({
        'client_id': credentials_internal.clientId,
        'grant_type': 'refresh_token',
        'refresh_token': credentials_internal.refreshToken,
    });

    const response = await fetch(AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: payload.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        sessionStorage.removeItem('plandayCredentials');
        credentials_internal = null;
        accessToken = null;
        tokenExpiry = null;
        throw new Error(`Failed to refresh access token: ${response.status} ${errorText}. Your credentials may be invalid or expired. Please re-enter them.`);
    }

    const data = await response.json();
    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

    if (data.refresh_token && data.refresh_token !== credentials_internal.refreshToken) {
        credentials_internal.refreshToken = data.refresh_token;
        sessionStorage.setItem('plandayCredentials', JSON.stringify(credentials_internal));
    }
    
    return accessToken;
}

// Optimized retry logic with NetworkError handling and exponential backoff
async function fetchWithAuth(url: string, options: RequestInit = { method: 'GET' }, retries = 5, backoffDelay = 2000): Promise<Response> {
    if (!credentials_internal) throw new Error("Service not initialized");

    const now = Date.now();
    if (globalDelayUntil > now) {
        await wait(globalDelayUntil - now);
    }

    const token = await getAccessToken();
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'X-ClientId': credentials_internal.clientId,
    };

    try {
        const response = await fetch(url, { ...options, headers });

        // Handle Rate Limiting (429)
        if (response.status === 429) {
            if (retries > 0) {
                const retryAfterHeader = response.headers.get('Retry-After');
                const xRateLimitReset = response.headers.get('x-ratelimit-reset');
                
                let waitTime = 1000; // Default 1s
                
                if (retryAfterHeader) {
                    waitTime = parseInt(retryAfterHeader, 10) * 1000;
                } else if (xRateLimitReset) {
                     waitTime = (parseInt(xRateLimitReset, 10) + 1) * 1000;
                }

                // Set global delay so other concurrent requests also wait
                globalDelayUntil = Math.max(globalDelayUntil, Date.now() + waitTime);

                console.warn(`Rate limited (429). Retrying in ${waitTime}ms...`);
                await wait(waitTime);
                return fetchWithAuth(url, options, retries - 1, backoffDelay);
            }
        }

        // Proactive Rate Limiting checks
        if (response.ok) {
            const remaining = response.headers.get('x-ratelimit-remaining');
            const reset = response.headers.get('x-ratelimit-reset');
            if (remaining !== null && reset !== null) {
                if (parseInt(remaining, 10) === 0) {
                    const waitTime = (parseInt(reset, 10) + 1) * 1000;
                    globalDelayUntil = Math.max(globalDelayUntil, Date.now() + waitTime);
                }
            }
        }

        // Handle Server Errors (5xx)
        if (response.status >= 500 && retries > 0) {
             console.warn(`Server error ${response.status}. Retrying...`);
             await wait(1000); 
             return fetchWithAuth(url, options, retries - 1, backoffDelay);
        }

        return response;
    } catch (error: any) {
        const isNetworkError = error.name === 'TypeError' || error.message.includes('NetworkError') || error.message.includes('fetch');
        
        if (isNetworkError && retries > 0) {
            console.warn(`Network error detected: ${error.message}. Pausing for ${backoffDelay}ms and retrying...`);
            await wait(backoffDelay);
            return fetchWithAuth(url, options, retries - 1, backoffDelay * 1.5);
        }
        throw error;
    }
}

export async function fetchPaginatedData(
    endpoint: string,
    onProgress?: (loaded: number, total?: number) => void
): Promise<any[]> {
    let allData: any[] = [];
    let offset = 0;
    // Planday API endpoints (such as /hr/v1.0/employees) enforce a maximum of 50 items per page
    const limit = 50; 

    while (true) {
        const separator = endpoint.includes('?') ? '&' : '?';
        const url = `${API_BASE_URL}${endpoint}${separator}limit=${limit}&offset=${offset}`;
        
        const response = await fetchWithAuth(url);
        if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${await response.text()}`);
        const result = await response.json();

        let items: any[] = [];
        if (Array.isArray(result)) {
            items = result;
            allData = allData.concat(items);
            if (onProgress) onProgress(allData.length, allData.length);
            break; 
        } else if (result && result.data && Array.isArray(result.data)) {
            items = result.data;
            allData = allData.concat(items);

            const total = typeof result.paging?.total === 'number' ? result.paging.total : undefined;
            if (onProgress) onProgress(allData.length, total);

            // Empty page returned - end of dataset
            if (items.length === 0) {
                break;
            }

            // Stop when we have loaded all records specified by paging total
            if (typeof total === 'number' && allData.length >= total) {
                break;
            }

            // If paging metadata does not specify total, break if fewer items were returned than the limit
            const effectiveLimit = typeof result.paging?.limit === 'number' ? result.paging.limit : limit;
            if (typeof total !== 'number' && items.length < effectiveLimit) {
                break;
            }

            offset += items.length;
            // Short 50ms pause between pages to stay well under rate limits
            await wait(50);
        } else {
            break;
        }
    }
    return allData;
}

export async function fetchPortalInfo(): Promise<any> {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/portal/v1.0/info`);
        if (!response.ok) return null;
        const json = await response.json();
        return json.data || json;
    } catch {
        return null;
    }
}

export async function fetchDepartments(): Promise<Department[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/departments');
        return items.map((d: any) => ({ id: d.id, name: d.name || `Department ${d.id}` }));
    } catch (e) {
        console.warn("Could not fetch departments:", e);
        return [];
    }
}

export async function fetchEmployeeGroups(): Promise<EmployeeGroup[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/employeegroups');
        return items.map((g: any) => ({ id: g.id, name: g.name || `Group ${g.id}` }));
    } catch (e) {
        console.warn("Could not fetch employee groups:", e);
        return [];
    }
}

export async function fetchEmployeeTypes(): Promise<{ id: number; name: string }[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/employeetypes');
        return items.map((t: any) => ({ id: t.id, name: t.name || `Type ${t.id}` }));
    } catch {
        return [];
    }
}

/**
 * Fetches termination types configured for the portal.
 * Inactive termination types (isActive === false) are excluded.
 * Endpoint: GET /hr/v1.0/terminationtypes
 */
export async function fetchTerminationTypes(): Promise<TerminationType[]> {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/hr/v1.0/terminationtypes`);
        if (!response.ok) {
            console.warn(`Could not fetch termination types (${response.status}):`, await response.text());
            return [];
        }
        const json = await response.json();
        let items: any[] = [];
        if (Array.isArray(json)) {
            items = json;
        } else if (json && Array.isArray(json.data)) {
            items = json.data;
        } else if (json && Array.isArray(json.items)) {
            items = json.items;
        }

        return items
            .filter((t: any) => t && t.isActive !== false)
            .map((t: any) => ({
                id: Number(t.id),
                name: String(t.name || `Type ${t.id}`),
                isActive: t.isActive !== false
            }));
    } catch (e) {
        console.warn("Could not fetch termination types (portal may not configure them):", e);
        return [];
    }
}

export async function fetchEmployees(
    onProgress?: (loaded: number, total?: number) => void
): Promise<Employee[]> {
    const raw = await fetchPaginatedData('/hr/v1.0/employees', onProgress);
    return raw.map((emp: any) => {
        const deptIds: number[] = Array.isArray(emp.departments)
            ? emp.departments.map((d: any) => typeof d === 'number' ? d : d?.id).filter((id: any): id is number => typeof id === 'number')
            : (Array.isArray(emp.departmentIds) ? emp.departmentIds : []);

        const groupIds: number[] = Array.isArray(emp.employeeGroups)
            ? emp.employeeGroups.map((g: any) => typeof g === 'number' ? g : g?.id).filter((id: any): id is number => typeof id === 'number')
            : (Array.isArray(emp.employeeGroupIds) ? emp.employeeGroupIds : []);

        const primDept = emp.primaryDepartmentId || emp.departmentId || (deptIds.length > 0 ? deptIds[0] : undefined);

        return {
            id: emp.id,
            firstName: emp.firstName || '',
            lastName: emp.lastName || '',
            email: emp.email || '',
            departments: deptIds,
            departmentIds: deptIds,
            employeeGroups: groupIds,
            employeeGroupIds: groupIds,
            primaryDepartmentId: primDept,
            salaryIdentifier: emp.salaryIdentifier,
            employeeTypeId: typeof emp.employeeTypeId === 'number' ? emp.employeeTypeId : undefined
        };
    });
}

export function parseError(text: string): string {
    try {
        const json = JSON.parse(text);
        const parts: string[] = [];

        if (json.modelState) {
             const ms = Object.entries(json.modelState)
                .map(([key, msgs]) => `${key.replace('model.', '')}: ${(Array.isArray(msgs) ? msgs.join(', ') : msgs)}`)
                .join('; ');
             if (ms) parts.push(ms);
        }

        if (json.errors) {
            if (Array.isArray(json.errors)) {
                const errs = json.errors.map((e: any) => `${e.key || ''}: ${e.message || ''}`).join(', ');
                if (errs) parts.push(errs);
            } else if (typeof json.errors === 'object') {
                const errs = Object.entries(json.errors)
                    .map(([key, msgs]) => `${key}: ${(Array.isArray(msgs) ? msgs.join(', ') : msgs)}`)
                    .join('; ');
                if (errs) parts.push(errs);
            }
        }

        if (json.error && typeof json.error === 'object') {
            const err = json.error;
            if (err.validation_errors && Array.isArray(err.validation_errors)) {
                const msgs = err.validation_errors.map((ve: any) => `${ve.property_name}: ${ve.error_message || ve.error_message_key}`);
                if (msgs.length > 0) parts.push(msgs.join('; '));
            }
            if (err.errors && typeof err.errors === 'object') {
                const nested = Object.entries(err.errors)
                   .map(([key, msgs]) => `${key}: ${(Array.isArray(msgs) ? msgs.join(', ') : msgs)}`)
                   .join('; ');
                if (nested) parts.push(nested);
            }
            if (err.code) parts.push(`${err.code}${err.message ? ': ' + err.message : ''}`);
            else if (err.message) parts.push(err.message);
        }
        
        if (json.message) parts.push(json.message);
        if (json.error_description) parts.push(json.error_description);
        if (json.title && !json.message) parts.push(json.title);
        if (json.detail) parts.push(json.detail);
        
        if (parts.length > 0) {
            return [...new Set(parts)].join(' | ');
        }

        if (Object.keys(json).length > 0) return JSON.stringify(json);
    } catch { }
    
    if (text.toLowerCase().includes('<!doctype html>')) return 'Server returned HTML error (500/404). Check credentials and endpoint.';
    return text.substring(0, 300);
}

/**
 * Calls Planday Open API to deactivate an employee
 * Endpoint: PUT /hr/v1.0/employees/deactivate/{employeeId}
 * 204 No Content is expected for successful deactivation.
 */
export async function deactivateEmployee(employeeId: number, payload: DeactivationPayload): Promise<void> {
    const url = `${API_BASE_URL}/hr/v1.0/employees/deactivate/${employeeId}`;
    
    const cleanPayload: Record<string, any> = {
        date: payload.date && payload.date.trim() !== '' ? payload.date.trim() : null,
        reason: payload.reason && payload.reason.trim() !== '' ? payload.reason.trim() : null,
        keepShifts: Boolean(payload.keepShifts),
        terminationTypeId: payload.terminationTypeId !== undefined && payload.terminationTypeId !== null && !isNaN(Number(payload.terminationTypeId))
            ? Number(payload.terminationTypeId)
            : null
    };

    const response = await fetchWithAuth(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanPayload)
    });

    // 204 No Content is success
    if (response.status === 204 || response.ok) {
        return;
    }

    const errText = await response.text();
    const errorMsg = parseError(errText);
    throw new Error(`${response.status}: ${errorMsg || 'Deactivation failed'}`);
}
