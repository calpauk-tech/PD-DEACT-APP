/**
 * Utility functions for date formatting across the Planday Deactivator app
 * Includes the 4-Stage Date Processing Architecture:
 * 1. Dataset-wide Locale Detection (checkForUSDateFormat)
 * 2. Two-Digit Year & Century Ambiguity Resolution (guessCentury & detectAmbiguousTwoDigitDates)
 * 3. Multi-Format Normalization Engine (parseDateWithFormat)
 * 4. User Transparency & Conversion Report (formatDateToText & Audit Log)
 */

/**
 * Formats any date input (YYYY-MM-DD, ISO string, timestamp, or empty/null) into DD/MM/YYYY format.
 * If empty, null, or undefined, formats today's current date as DD/MM/YYYY (e.g. 22/09/2026).
 */
export const formatDisplayDate = (dateStr?: string | null): string => {
    if (!dateStr || dateStr.trim() === '') {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        return `${d}/${m}/${y}`;
    }

    const trimmed = dateStr.trim();

    // Match YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
        const [, y, m, d] = isoMatch;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // Match DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // Fallback date parsing
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
        const d = String(parsed.getDate()).padStart(2, '0');
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const y = parsed.getFullYear();
        return `${d}/${m}/${y}`;
    }

    return trimmed;
};

/**
 * Returns today's date formatted as YYYY-MM-DD (standard for HTML date inputs)
 */
export const getTodayIso = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// ============================================================================
// STAGE 1: Automatic US vs. EU Format Detection
// ============================================================================

/**
 * Scans all date values across the dataset looking for definitive markers:
 * If the 2nd number > 12 -> must be day, so MM/DD/YYYY (US marker)
 * If the 1st number > 12 -> must be day, so DD/MM/YYYY (EU marker)
 * Only returns true if US markers found and no conflicting EU markers found.
 */
export const checkForUSDateFormat = (rows: any[][], dateColIndex: number): boolean => {
    if (dateColIndex < 0) return false;

    let usMarkerFound = false;
    let euMarkerFound = false;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;
        const val = row[dateColIndex];
        if (val !== undefined && val !== null) {
            const strVal = String(val).trim();
            // Match patterns like D/M/Y or M/D/Y separated by /, ., or -
            const match = strVal.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
            if (match) {
                const p1 = parseInt(match[1], 10);
                const p2 = parseInt(match[2], 10);

                // If second number > 12, cannot be month -> must be day (MM/DD/YYYY)
                if (p2 > 12) usMarkerFound = true;

                // If first number > 12, cannot be month -> must be day (DD/MM/YYYY)
                if (p1 > 12) euMarkerFound = true;
            }
        }
    }

    // Only force US if US markers were detected and no conflicting EU markers were found
    if (usMarkerFound && !euMarkerFound) return true;
    return false; // Defaults to Standard/European (DD/MM/YYYY)
};

// ============================================================================
// STAGE 2: Two-Digit Year & Century Ambiguity Resolution
// ============================================================================

export const CURRENT_TWO_DIGIT_YEAR = parseInt(new Date().getFullYear().toString().slice(-2), 10);

/**
 * Context-aware century guessing for 2-digit years.
 */
export const guessCentury = (twoDigitYear: number, fieldName: string = ''): number => {
    const lowerName = fieldName.toLowerCase();

    // Birth dates: If year > current year (e.g. 90 > 24), default to 1990; otherwise 2000s
    if (lowerName.includes('birth')) {
        return twoDigitYear > CURRENT_TWO_DIGIT_YEAR ? 1900 : 2000;
    }

    // Operational dates (Hire date, valid from, deactivation, termination): 1951-2050 window
    return twoDigitYear > 50 ? 1900 : 2000;
};

export interface AmbiguousDateItem {
    rowIndex: number; // 0-based index in rows array
    excelRowNumber: number; // 1-based row number
    employeeIdentifier: string;
    employeeName: string;
    fieldName: string;
    originalInput: string;
    twoDigitYear: number;
    recommendedCentury: number; // 1900 or 2000
    chosenCentury: number; // user choice (defaults to recommendedCentury)
}

/**
 * Detects rows containing 2-digit years in the specified date column
 */
export const detectAmbiguousTwoDigitDates = (
    rows: any[][],
    dateColIdx: number,
    idColIdx: number,
    firstColIdx: number,
    lastColIdx: number,
    fieldName: string = 'Deactivation Date'
): AmbiguousDateItem[] => {
    const ambiguous: AmbiguousDateItem[] = [];
    if (dateColIdx < 0) return ambiguous;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const val = row[dateColIdx];
        if (val === undefined || val === null) continue;

        const str = String(val).trim();
        if (!str) continue;

        // Check for 2-digit year pattern in D/M/YY or M/D/YY
        const match = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2})$/);
        if (match) {
            const twoDigitYear = parseInt(match[3], 10);
            const recommended = guessCentury(twoDigitYear, fieldName);

            const empId = idColIdx >= 0 && row[idColIdx] !== undefined ? String(row[idColIdx]).trim() : '';
            const firstName = firstColIdx >= 0 && row[firstColIdx] !== undefined ? String(row[firstColIdx]).trim() : '';
            const lastName = lastColIdx >= 0 && row[lastColIdx] !== undefined ? String(row[lastColIdx]).trim() : '';
            const fullName = [firstName, lastName].filter(Boolean).join(' ') || (empId ? `ID: ${empId}` : `Row ${i + 1}`);

            ambiguous.push({
                rowIndex: i,
                excelRowNumber: i + 1,
                employeeIdentifier: empId,
                employeeName: fullName,
                fieldName,
                originalInput: str,
                twoDigitYear,
                recommendedCentury: recommended,
                chosenCentury: recommended
            });
        }
    }

    return ambiguous;
};

// ============================================================================
// STAGE 3: Multi-Format Normalization Engine (parseDateWithFormat)
// ============================================================================

/**
 * Converts any valid date representation into canonical ISO YYYY-MM-DD
 */
export const parseDateWithFormat = (
    input: any,
    forceUS: boolean,
    yearCorrection?: number
): string | null => {
    if (!input) return null;

    // 1. Native Date objects (e.g. from Excel reader XLSX cellDates: true)
    if (input instanceof Date) {
        if (isNaN(input.getTime())) return null;
        const y = input.getFullYear();
        const m = String(input.getMonth() + 1).padStart(2, '0');
        const d = String(input.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // 2. Excel Numeric Serial Dates (e.g., 44561)
    if (typeof input === 'number' || /^\d{5}$/.test(String(input).trim())) {
        const serial = parseInt(String(input), 10);
        if (serial > 20000 && serial < 80000) {
            // 25569 = days between Jan 1 1900 and Jan 1 1970 (Unix Epoch)
            const dateObj = new Date(Math.round((serial - 25569) * 86400 * 1000));
            const y = dateObj.getUTCFullYear();
            const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    const str = String(input).trim();
    if (!str) return null;

    // 3. Year-First format (YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD)
    const matchYearFirst = str.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
    if (matchYearFirst) {
        const y = parseInt(matchYearFirst[1], 10);
        const p1 = parseInt(matchYearFirst[2], 10);
        const p2 = parseInt(matchYearFirst[3], 10);

        // Handles standard YYYY-MM-DD, or YYYY-DD-MM if p1 > 12
        const m = p1 > 12 ? p2 : p1;
        const d = p1 > 12 ? p1 : p2;

        if (m > 12 || d > 31 || m < 1 || d < 1) return null;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // 4. Year-Last format (D/M/Y or M/D/Y)
    const match = str.match(/^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})$/);
    if (match) {
        const part1 = parseInt(match[1], 10);
        const part2 = parseInt(match[2], 10);
        let y = parseInt(match[3], 10);

        if (yearCorrection) {
            y = yearCorrection;
        } else if (y < 100) {
            y += (y > 50 ? 1900 : 2000);
        }

        const d = forceUS ? part2 : part1;
        const m = forceUS ? part1 : part2;

        if (m > 12 || d > 31 || m < 1 || d < 1) return null;
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // 5. Fallback for textual dates (e.g. "Aug 15 2023")
    const fallbackDate = new Date(str.replace(/-/g, '/'));
    if (!isNaN(fallbackDate.getTime()) && /[A-Za-z]/.test(str)) {
        const y = fallbackDate.getFullYear();
        if (y > 1900 && y < 2100) {
            const m = String(fallbackDate.getMonth() + 1).padStart(2, '0');
            const d = String(fallbackDate.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }

    return null;
};

// ============================================================================
// STAGE 4: User Transparency & Conversion Report
// ============================================================================

/**
 * Converts ISO "2024-05-12" to "12. May 2024" to remove all ambiguity
 */
export const formatDateToText = (isoDate: string): string => {
    if (!isoDate) return "";
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10)));
    if (isNaN(date.getTime())) return isoDate;
    return `${parseInt(d, 10)}. ${date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${y}`;
};

export interface DateConversionAuditItem {
    excelRowNumber: number;
    employeeIdentifier: string;
    employeeName: string;
    fieldName: string;
    originalInput: string;
    targetPayload: string; // ISO YYYY-MM-DD
    textDate: string; // e.g. "14. March 2024"
    isValid: boolean;
}
