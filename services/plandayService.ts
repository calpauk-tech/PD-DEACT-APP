import { PlandayApiCredentials, Employee, Department, EmployeeGroup, TerminationType, DeactivationPayload } from '../types';

const AUTH_URL = 'https://id.planday.com/connect/token';
const REVOCATION_URL = 'https://id.planday.com/connect/revocation';
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

// Revoke refresh token against Planday OAuth server
export async function revokeToken(): Promise<void> {
    let creds = credentials_internal;
    if (!creds) {
        try {
            const saved = sessionStorage.getItem('plandayCredentials');
            if (saved) creds = JSON.parse(saved);
        } catch {}
    }
    if (!creds || !creds.clientId || !creds.refreshToken) {
        resetService();
        return;
    }

    try {
        const payload = new URLSearchParams({
            client_id: creds.clientId,
            token: creds.refreshToken,
        });

        await fetch(REVOCATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload.toString(),
        });
    } catch (err) {
        console.warn('Failed to revoke Planday token on server:', err);
    } finally {
        resetService();
    }
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

// Optimized retry logic with NetworkError handling, request timeout, and exponential backoff
async function fetchWithAuth(url: string, options: RequestInit = { method: 'GET' }, retries = 5, backoffDelay = 2000): Promise<Response> {
    if (!credentials_internal) throw new Error("Service not initialized");

    if (options.signal?.aborted) {
        throw new Error("Operation aborted");
    }

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

    // 20-second per-request timeout to prevent silent TCP/network hanging
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
        try {
            timeoutController.abort(new Error('Request timed out after 20 seconds'));
        } catch {}
    }, 20000);

    let abortHandler: (() => void) | undefined;
    if (options.signal) {
        abortHandler = () => {
            try {
                timeoutController.abort(options.signal?.reason || new Error('Operation aborted'));
            } catch {}
        };
        options.signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
        const response = await fetch(url, { 
            ...options, 
            headers,
            signal: timeoutController.signal 
        });

        // Handle Rate Limiting (429)
        if (response.status === 429) {
            if (retries > 0 && !options.signal?.aborted) {
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
        if (response.status >= 500 && retries > 0 && !options.signal?.aborted) {
             console.warn(`Server error ${response.status}. Retrying...`);
             await wait(1000); 
             return fetchWithAuth(url, options, retries - 1, backoffDelay);
        }

        return response;
    } catch (error: any) {
        if (options.signal?.aborted) {
            throw error;
        }

        const isTimeout = error.message?.includes('timed out') || error.name === 'AbortError';
        const isNetworkError = error.name === 'TypeError' || error.message?.includes('NetworkError') || error.message?.includes('fetch');
        
        if ((isNetworkError || isTimeout) && retries > 0) {
            console.warn(`Transient fetch issue (${error.message || error.name}). Pausing for ${backoffDelay}ms and retrying...`);
            await wait(backoffDelay);
            return fetchWithAuth(url, options, retries - 1, backoffDelay * 1.5);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
        if (options.signal && abortHandler) {
            options.signal.removeEventListener('abort', abortHandler);
        }
    }
}

export async function fetchPaginatedData(
    endpoint: string,
    onProgress?: (loaded: number, total?: number) => void,
    signal?: AbortSignal
): Promise<any[]> {
    // Planday API endpoints enforce a maximum of 50 items per page
    const limit = 50; 
    const separator = endpoint.includes('?') ? '&' : '?';

    // 1. Fetch the first page to inspect total records and response structure
    const firstUrl = `${API_BASE_URL}${endpoint}${separator}limit=${limit}&offset=0`;
    const response = await fetchWithAuth(firstUrl, { signal });
    if (!response.ok) throw new Error(`Failed to fetch ${endpoint}: ${await response.text()}`);
    const result = await response.json();

    if (Array.isArray(result)) {
        if (onProgress) onProgress(result.length, result.length);
        return result; 
    }

    if (!result || !result.data || !Array.isArray(result.data)) {
        return [];
    }

    const firstPageItems: any[] = result.data;
    const total = typeof result.paging?.total === 'number' ? result.paging.total : undefined;

    // If total is not provided or all items fit in the first page, return immediately
    if (typeof total !== 'number' || total <= firstPageItems.length || firstPageItems.length === 0) {
        if (onProgress) onProgress(firstPageItems.length, total ?? firstPageItems.length);
        return firstPageItems;
    }

    // 2. High-speed parallel batch fetching for large portals (5 concurrent requests)
    // Planday API rate limit allows 20 req/s and 750 req/min per portal
    const offsets: number[] = [];
    for (let offset = limit; offset < total; offset += limit) {
        offsets.push(offset);
    }

    const pagesByOffset = new Map<number, any[]>();
    let loadedCount = firstPageItems.length;
    if (onProgress) onProgress(loadedCount, total);

    const CONCURRENCY = 5;
    let nextOffsetIdx = 0;

    const worker = async () => {
        while (nextOffsetIdx < offsets.length) {
            if (signal?.aborted) throw new Error('Operation aborted');
            const currentIndex = nextOffsetIdx++;
            if (currentIndex >= offsets.length) break;

            const currentOffset = offsets[currentIndex];
            const pageUrl = `${API_BASE_URL}${endpoint}${separator}limit=${limit}&offset=${currentOffset}`;
            
            const pageRes = await fetchWithAuth(pageUrl, { signal });
            if (!pageRes.ok) throw new Error(`Failed to fetch ${endpoint} at offset ${currentOffset}: ${await pageRes.text()}`);
            const pageJson = await pageRes.json();
            const items = Array.isArray(pageJson?.data) ? pageJson.data : [];
            pagesByOffset.set(currentOffset, items);

            loadedCount += items.length;
            if (onProgress) onProgress(loadedCount, total);

            // Small 30ms yield between calls to prevent burst spikes
            await wait(30);
        }
    };

    const workerPromises = Array.from(
        { length: Math.min(CONCURRENCY, offsets.length) }, 
        () => worker()
    );
    await Promise.all(workerPromises);

    // 3. Re-assemble records in exact offset sequence
    let allData: any[] = [...firstPageItems];
    for (const offset of offsets) {
        const pageItems = pagesByOffset.get(offset) || [];
        allData = allData.concat(pageItems);
    }

    return allData;
}

export async function fetchPortalInfo(signal?: AbortSignal): Promise<any> {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/portal/v1.0/info`, { signal });
        if (!response.ok) return null;
        const json = await response.json();
        return json.data || json;
    } catch {
        return null;
    }
}

export async function fetchDepartments(signal?: AbortSignal): Promise<Department[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/departments', undefined, signal);
        return items.map((d: any) => ({ id: d.id, name: d.name || `Department ${d.id}` }));
    } catch (e) {
        console.warn("Could not fetch departments:", e);
        return [];
    }
}

export async function fetchEmployeeGroups(signal?: AbortSignal): Promise<EmployeeGroup[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/employeegroups', undefined, signal);
        return items.map((g: any) => ({ id: g.id, name: g.name || `Group ${g.id}` }));
    } catch (e) {
        console.warn("Could not fetch employee groups:", e);
        return [];
    }
}

export async function fetchEmployeeTypes(signal?: AbortSignal): Promise<{ id: number; name: string }[]> {
    try {
        const items = await fetchPaginatedData('/hr/v1.0/employeetypes', undefined, signal);
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
export async function fetchTerminationTypes(signal?: AbortSignal): Promise<TerminationType[]> {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/hr/v1.0/terminationtypes`, { signal });
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

export async function fetchAllDefinitions(signal?: AbortSignal): Promise<{
    departments: Department[];
    employeeGroups: EmployeeGroup[];
    terminationTypes: TerminationType[];
    employeeTypes: { id: number; name: string }[];
}> {
    const [departments, employeeGroups, terminationTypes, employeeTypes] = await Promise.all([
        fetchDepartments(signal),
        fetchEmployeeGroups(signal),
        fetchTerminationTypes(signal),
        fetchEmployeeTypes(signal),
    ]);
    return { departments, employeeGroups, terminationTypes, employeeTypes };
}

export async function fetchEmployees(
    onProgress?: (loaded: number, total?: number) => void,
    signal?: AbortSignal
): Promise<Employee[]> {
    const raw = await fetchPaginatedData('/hr/v1.0/employees', onProgress, signal);
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
