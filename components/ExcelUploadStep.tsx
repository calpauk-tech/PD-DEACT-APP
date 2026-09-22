import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx-js-style';
import { DeactivationItem, TerminationType, Department, EmployeeGroup, EmployeeType } from '../types';
import { filterDeactivationItems } from '../filterUtils';
import { MultiSelectMenu } from './MultiSelectMenu';
import { ColumnMappingModal, ColumnMappingConfig } from './ColumnMappingModal';
import { 
    checkForUSDateFormat, 
    detectAmbiguousTwoDigitDates, 
    parseDateWithFormat, 
    formatDateToText, 
    AmbiguousDateItem, 
    DateConversionAuditItem 
} from '../dateUtils';
import { DateAmbiguityModal } from './DateAmbiguityModal';
import { DateConversionReport } from './DateConversionReport';

interface ExcelUploadStepProps {
    items: DeactivationItem[];
    departments?: Department[];
    employeeGroups?: EmployeeGroup[];
    employeeTypes?: EmployeeType[];
    terminationTypes: TerminationType[];
    onLoadedItems: (updatedItems: DeactivationItem[]) => void;
    onBack: () => void;
    onNext: () => void;
}

export const ExcelUploadStep: React.FC<ExcelUploadStepProps> = ({
    items,
    departments = [],
    employeeGroups = [],
    employeeTypes = [],
    terminationTypes,
    onLoadedItems,
    onBack,
    onNext
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [parsedStats, setParsedStats] = useState<{ 
        total: number; 
        checked: number; 
        matched: number; 
        unmatched: number; 
        mode: 'id' | 'salaryIdentifier';
        colName?: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 4-Stage Date Processing state
    const [isUSDateFormat, setIsUSDateFormat] = useState<boolean>(false);
    const [dateAuditLog, setDateAuditLog] = useState<DateConversionAuditItem[]>([]);
    const [ambiguousDateItems, setAmbiguousDateItems] = useState<AmbiguousDateItem[]>([]);
    const [isDateAmbiguityModalOpen, setIsDateAmbiguityModalOpen] = useState<boolean>(false);
    const [activeYearCorrections, setActiveYearCorrections] = useState<Record<number, number>>({});
    const [pendingDateResolution, setPendingDateResolution] = useState<{
        config: ColumnMappingConfig;
        headers: string[];
        rows: any[][];
        forceUS: boolean;
    } | null>(null);

    // Stored raw sheet data for modal & re-mapping
    const [uploadedFileRaw, setUploadedFileRaw] = useState<{
        headers: string[];
        rows: any[][];
        fileName: string;
    } | null>(null);

    // Column Mapping Modal state
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
    const [mappingReason, setMappingReason] = useState<'both_identifiers' | 'no_identifier' | 'missing_columns' | 'manual_review'>('manual_review');
    const [currentMappingConfig, setCurrentMappingConfig] = useState<ColumnMappingConfig>({
        identifierType: 'id',
        colIdentifier: -1,
        colCheck: -1,
        colDate: -1,
        colReason: -1,
        colTerm: -1,
        colKeep: -1,
        colFirst: -1,
        colLast: -1,
    });

    // Template filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDepartment, setFilterDepartment] = useState<number[]>([]);
    const [filterPrimaryDepartment, setFilterPrimaryDepartment] = useState<boolean>(false);
    const [filterGroup, setFilterGroup] = useState<number[]>([]);
    const [filterType, setFilterType] = useState<number[]>([]);
    const [downloadNotification, setDownloadNotification] = useState<string | null>(null);

    // Ensure departments and employee groups always have options
    // (fallback to extracting unique departments/groups from items if props were empty)
    const effectiveDepartments = useMemo(() => {
        if (departments && departments.length > 0) return departments;
        const deptMap = new Map<number, string>();
        items.forEach(emp => {
            if (emp.departmentIds && emp.departmentNames) {
                emp.departmentIds.forEach((id, idx) => {
                    const name = emp.departmentNames?.[idx];
                    if (name && !deptMap.has(id)) {
                        deptMap.set(id, name);
                    }
                });
            }
        });
        return Array.from(deptMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [departments, items]);

    const effectiveEmployeeGroups = useMemo(() => {
        if (employeeGroups && employeeGroups.length > 0) return employeeGroups;
        const grpMap = new Map<number, string>();
        items.forEach(emp => {
            if (emp.employeeGroupIds && emp.employeeGroupNames) {
                emp.employeeGroupIds.forEach((id, idx) => {
                    const name = emp.employeeGroupNames?.[idx];
                    if (name && !grpMap.has(id)) {
                        grpMap.set(id, name);
                    }
                });
            }
        });
        return Array.from(grpMap.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [employeeGroups, items]);

    const effectiveEmployeeTypes = useMemo(() => {
        if (employeeTypes && employeeTypes.length > 0) return employeeTypes;
        const typeMap = new Map<number, string>();
        items.forEach(emp => {
            if (emp.employeeTypeId && !typeMap.has(emp.employeeTypeId)) {
                typeMap.set(emp.employeeTypeId, `Type ${emp.employeeTypeId}`);
            }
        });
        return Array.from(typeMap.entries()).map(([id, name]) => ({ id, name }));
    }, [employeeTypes, items]);

    // Filtered items for Excel template generation
    const filteredEmployeesForTemplate = useMemo(() => {
        return filterDeactivationItems(items, {
            searchQuery,
            filterDepartment,
            filterPrimaryDepartment,
            filterGroup,
            filterType,
        });
    }, [items, searchQuery, filterDepartment, filterPrimaryDepartment, filterGroup, filterType]);

    const hasActiveFilters = Boolean(
        searchQuery.trim() ||
        filterDepartment.length > 0 ||
        filterPrimaryDepartment ||
        filterGroup.length > 0 ||
        filterType.length > 0
    );

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterDepartment([]);
        setFilterPrimaryDepartment(false);
        setFilterGroup([]);
        setFilterType([]);
    };

    // Helper to generate the Instructions Sheet
    const createInstructionsSheet = () => {
        const titleRow = ['Planday Employee Deactivation Template — Field Guide & Instructions'];
        const emptyRow = [''];
        const headers = ['Column Name', 'Required?', 'Format / Accepted Values', 'Field Guide & Explanation'];

        const guideRows = [
            [
                'Planday Employee ID (API)',
                'Conditional (Recommended)',
                'Numeric (e.g. 10423)',
                'Unique internal Planday Employee ID. Highly recommended for accurate matching. Either this or Salary Identifier must be provided.'
            ],
            [
                'Salary Identifier (Payroll ID)',
                'Conditional',
                'Alphanumeric text (e.g. EMP-081, 9021)',
                'Employee payroll identifier from your HR/payroll system. Used to match employees if Planday Employee ID is not used.'
            ],
            [
                'First Name',
                'Optional',
                'Text (e.g. Jane)',
                'First name of the employee for visual reference and fallback matching.'
            ],
            [
                'Last Name',
                'Optional',
                'Text (e.g. Doe)',
                'Last name of the employee for visual reference and fallback matching.'
            ],
            [
                'Check to Deactivate (x)',
                'Required',
                'Enter "x" (or "X") | Leave Blank',
                'Enter "x" to mark this employee for deactivation. Leave BLANK to keep the employee active / skip them.'
            ],
            [
                'Deactivation Date (YYYY-MM-DD)',
                'Optional',
                'Date in YYYY-MM-DD format (e.g. 2026-10-31)',
                'The effective date of deactivation. If left blank, Planday defaults to today\'s date.'
            ],
            [
                'Reason',
                'Optional',
                'Free text (e.g. Resignation, Relocation)',
                'Free-text note or termination reason recorded in Planday\'s employee deactivation history.'
            ],
            [
                'Termination Type',
                'Optional',
                'Type Name or numeric ID',
                'The specific termination type configured in your Planday portal. Enter the exact name or numeric ID (see list below).'
            ],
            [
                'Keep Shifts (TRUE/FALSE*)',
                'Optional',
                'TRUE or FALSE (Default: FALSE)',
                'If TRUE, future scheduled shifts remain on the roster. If FALSE or blank, future shifts are removed.'
            ],
        ];

        const termHeaderRow = ['Valid Termination Types in this Planday Portal:'];
        const termSubHeader = ['Type ID', 'Termination Type Name'];
        const termRows = terminationTypes && terminationTypes.length > 0
            ? terminationTypes.map(t => [t.id, t.name])
            : [['-', 'None configured (default portal termination type will be used)']];

        const fullData = [
            titleRow,
            emptyRow,
            headers,
            ...guideRows,
            emptyRow,
            termHeaderRow,
            termSubHeader,
            ...termRows
        ];

        const ws = XLSX.utils.aoa_to_sheet(fullData);

        // Header and title styling
        const titleStyle = {
            font: { bold: true, sz: 13, color: { rgb: "1E3A8A" } },
        };
        const tableHeaderStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E40AF" } }, // Blue 800
            alignment: { horizontal: "left", vertical: "center" }
        };

        if (ws['A1']) ws['A1'].s = titleStyle;
        
        // Row 3 (0-indexed row 2) is the table header
        for (let c = 0; c < 4; c++) {
            const addr = XLSX.utils.encode_cell({ r: 2, c });
            if (ws[addr]) ws[addr].s = tableHeaderStyle;
        }

        // Termination type table header row
        const termHeaderIdx = 3 + guideRows.length + 2; // 0-indexed
        for (let c = 0; c < 2; c++) {
            const addr = XLSX.utils.encode_cell({ r: termHeaderIdx, c });
            if (ws[addr]) ws[addr].s = tableHeaderStyle;
        }

        ws['!cols'] = [
            { wch: 32 }, // Column Name
            { wch: 28 }, // Required?
            { wch: 38 }, // Format / Accepted Values
            { wch: 80 }, // Field Guide & Explanation
        ];

        return ws;
    };

    // 1. Download Blank Template
    const handleDownloadBlankTemplate = () => {
        const headers = [
            'Planday Employee ID (API)',
            'Salary Identifier (Payroll ID)',
            'First Name',
            'Last Name',
            'Check to Deactivate (x)',
            'Deactivation Date (YYYY-MM-DD)',
            'Reason',
            'Termination Type',
            'Keep Shifts (TRUE/FALSE*)'
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers]);

        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E40AF" } }, // Blue 800
            alignment: { horizontal: "center", vertical: "center" }
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:I1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (ws[cellAddress]) {
                ws[cellAddress].s = headerStyle;
            }
        }

        ws['!cols'] = [
            { wch: 28 }, // Planday Employee ID (API)
            { wch: 30 }, // Salary Identifier (Payroll ID)
            { wch: 18 }, // First Name
            { wch: 18 }, // Last Name
            { wch: 25 }, // Check to Deactivate (x)
            { wch: 30 }, // Deactivation Date
            { wch: 28 }, // Reason
            { wch: 26 }, // Termination Type
            { wch: 25 }, // Keep Shifts
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Deactivation List");
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(), "Instructions");

        const todayStr = new Date().toISOString().split('T')[0];
        const filename = `Planday_Deactivate-Emp_Template_Blank_${todayStr}.xlsx`;

        XLSX.writeFile(wb, filename);

        setDownloadNotification(`Downloaded blank template.`);
        setTimeout(() => setDownloadNotification(null), 5000);
    };

    // 2. Download Pre-filled Template (Filtered or All)
    const handleDownloadTemplate = (exportAll = false) => {
        const targetItems = exportAll ? items : filteredEmployeesForTemplate;

        if (targetItems.length === 0) {
            alert('No employees match the selected filters. Please adjust your filters to download a template.');
            return;
        }

        const headers = [
            'Planday Employee ID (API)',
            'Salary Identifier (Payroll ID)',
            'First Name',
            'Last Name',
            'Check to Deactivate (x)',
            'Deactivation Date (YYYY-MM-DD)',
            'Reason',
            'Termination Type',
            'Keep Shifts (TRUE/FALSE*)'
        ];

        const rows = targetItems.map(emp => {
            const termName = emp.terminationTypeName || (terminationTypes.find(t => t.id === emp.terminationTypeId)?.name || '');
            return [
                emp.employeeId,
                emp.salaryIdentifier || '',
                emp.firstName,
                emp.lastName,
                emp.selected ? 'x' : '',
                emp.deactivationDate || '',
                emp.reason || '',
                termName,
                emp.keepShifts ? 'TRUE' : 'FALSE'
            ];
        });

        const data = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Styling headers
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E40AF" } }, // Blue 800
            alignment: { horizontal: "center", vertical: "center" }
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:I1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (ws[cellAddress]) {
                ws[cellAddress].s = headerStyle;
            }
        }

        // Set column widths
        ws['!cols'] = [
            { wch: 28 }, // Planday Employee ID (API)
            { wch: 30 }, // Salary Identifier (Payroll ID)
            { wch: 18 }, // First Name
            { wch: 18 }, // Last Name
            { wch: 25 }, // Check to Deactivate (x)
            { wch: 30 }, // Deactivation Date
            { wch: 28 }, // Reason
            { wch: 26 }, // Termination Type
            { wch: 25 }, // Keep Shifts
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Deactivation List");
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(), "Instructions");

        const todayStr = new Date().toISOString().split('T')[0];
        const filename = exportAll || !hasActiveFilters
            ? `Planday_Deactivate-Emp_Template_All_${todayStr}.xlsx`
            : `Planday_Deactivate-Emp_Template_Filtered_${targetItems.length}_${todayStr}.xlsx`;

        XLSX.writeFile(wb, filename);

        setDownloadNotification(`Downloaded template with ${targetItems.length} employee${targetItems.length === 1 ? '' : 's'}.`);
        setTimeout(() => setDownloadNotification(null), 5000);
    };

    // Apply Mapping and Process Data Rows with 4-Stage Date Architecture
    const applyMappingAndProcess = (
        config: ColumnMappingConfig, 
        headers: string[], 
        rows: any[][],
        dateOptions?: {
            forceUS?: boolean;
            yearCorrections?: Record<number, number>;
        }
    ) => {
        try {
            setUploadError(null);

            // STAGE 1: Dataset-wide Locale Detection (US vs EU format)
            const detectedUS = dateOptions?.forceUS !== undefined
                ? dateOptions.forceUS
                : (config.colDate !== -1 ? checkForUSDateFormat(rows, config.colDate) : false);

            // STAGE 2: Two-Digit Year & Century Ambiguity Resolution
            if (config.colDate !== -1 && !dateOptions?.yearCorrections) {
                const dateHeaderName = config.colDate < headers.length ? headers[config.colDate] : 'Deactivation Date';
                const ambiguous = detectAmbiguousTwoDigitDates(
                    rows,
                    config.colDate,
                    config.colIdentifier,
                    config.colFirst,
                    config.colLast,
                    dateHeaderName
                );

                if (ambiguous.length > 0) {
                    setAmbiguousDateItems(ambiguous);
                    setPendingDateResolution({
                        config,
                        headers,
                        rows,
                        forceUS: detectedUS
                    });
                    setIsDateAmbiguityModalOpen(true);
                    return; // Pause file processing until user confirms centuries!
                }
            }

            const updatedList: DeactivationItem[] = [...items];
            let checkedCount = 0;
            let matchedCount = 0;
            let unmatchedCount = 0;
            const auditItems: DateConversionAuditItem[] = [];

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0 || row.every((c: any) => c === undefined || c === null || String(c).trim() === '')) {
                    continue;
                }

                const rawIdentVal = config.colIdentifier !== -1 ? row[config.colIdentifier] : null;
                const rawFirst = config.colFirst !== -1 ? String(row[config.colFirst] || '').trim() : '';
                const rawLast = config.colLast !== -1 ? String(row[config.colLast] || '').trim() : '';

                let targetIndex = -1;

                if (config.identifierType === 'id') {
                    const empId = rawIdentVal ? parseInt(String(rawIdentVal).replace(/[^0-9]/g, ''), 10) : null;
                    if (empId && !isNaN(empId)) {
                        targetIndex = updatedList.findIndex(x => x.employeeId === empId);
                    }
                } else {
                    const salaryStr = rawIdentVal !== undefined && rawIdentVal !== null ? String(rawIdentVal).trim() : '';
                    if (salaryStr) {
                        targetIndex = updatedList.findIndex(x => 
                            String(x.salaryIdentifier || '').trim().toLowerCase() === salaryStr.toLowerCase()
                        );
                    }
                }

                // Fallback to name if not matched by primary identifier
                if (targetIndex === -1 && (rawFirst || rawLast)) {
                    targetIndex = updatedList.findIndex(x => 
                        x.firstName.toLowerCase() === rawFirst.toLowerCase() && 
                        x.lastName.toLowerCase() === rawLast.toLowerCase()
                    );
                }

                if (targetIndex === -1) {
                    unmatchedCount++;
                    continue;
                }

                matchedCount++;

                // Check value ('x', 'true', 'yes', '1' => true; blank/other => false)
                let isChecked = false;
                if (config.colCheck === 'all') {
                    isChecked = true;
                } else if (config.colCheck !== -1) {
                    const rawCheck = row[config.colCheck];
                    isChecked = rawCheck === true || 
                                String(rawCheck).trim().toLowerCase() === 'true' || 
                                String(rawCheck).trim().toLowerCase() === 'yes' || 
                                String(rawCheck).trim() === '1' ||
                                String(rawCheck).trim().toLowerCase() === 'x';
                }

                // STAGE 3: Multi-Format Normalization Engine
                const rawDateVal = config.colDate !== -1 ? row[config.colDate] : '';
                const yearCorrection = dateOptions?.yearCorrections ? dateOptions.yearCorrections[i] : undefined;
                const parsedDate = parseDateWithFormat(rawDateVal, detectedUS, yearCorrection) || '';

                // STAGE 4: Date Conversion Audit Item for verification
                if (rawDateVal !== undefined && rawDateVal !== null && String(rawDateVal).trim() !== '') {
                    const matchedEmp = updatedList[targetIndex];
                    const dateFieldName = config.colDate < headers.length ? headers[config.colDate] : 'Deactivation Date';
                    auditItems.push({
                        excelRowNumber: i + 1,
                        employeeIdentifier: String(rawIdentVal ?? matchedEmp.employeeId),
                        employeeName: `${matchedEmp.firstName} ${matchedEmp.lastName}`.trim(),
                        fieldName: dateFieldName,
                        originalInput: String(rawDateVal),
                        targetPayload: parsedDate,
                        textDate: parsedDate ? formatDateToText(parsedDate) : '',
                        isValid: Boolean(parsedDate)
                    });
                }

                // Reason value
                const rawReasonVal = config.colReason !== -1 && row[config.colReason] !== undefined && row[config.colReason] !== null
                    ? String(row[config.colReason]).trim()
                    : '';

                // Termination Type value
                let parsedTermId = updatedList[targetIndex].terminationTypeId;
                let parsedTermName = updatedList[targetIndex].terminationTypeName;

                if (config.colTerm !== -1 && row[config.colTerm] !== undefined && row[config.colTerm] !== null && String(row[config.colTerm]).trim() !== '') {
                    const rawTerm = String(row[config.colTerm]).trim();
                    const numId = parseInt(rawTerm, 10);
                    const matchedById = !isNaN(numId) ? terminationTypes.find(t => t.id === numId) : null;
                    const matchedByName = terminationTypes.find(t => t.name.toLowerCase() === rawTerm.toLowerCase());
                    const matched = matchedById || matchedByName;
                    if (matched) {
                        parsedTermId = matched.id;
                        parsedTermName = matched.name;
                    } else {
                        if (!isNaN(numId)) {
                            parsedTermId = numId;
                        }
                        parsedTermName = rawTerm;
                    }
                }

                // Keep shifts value
                let isKeep = false;
                if (config.colKeep !== -1) {
                    const rawKeepVal = row[config.colKeep];
                    isKeep = rawKeepVal === true || 
                             String(rawKeepVal).trim().toLowerCase() === 'true' || 
                             String(rawKeepVal).trim().toLowerCase() === 'yes' || 
                             String(rawKeepVal).trim() === '1';
                }

                if (isChecked) {
                    checkedCount++;
                }

                updatedList[targetIndex] = {
                    ...updatedList[targetIndex],
                    selected: isChecked,
                    deactivationDate: parsedDate,
                    reason: rawReasonVal,
                    keepShifts: isKeep,
                    terminationTypeId: parsedTermId,
                    terminationTypeName: parsedTermName,
                };
            }

            onLoadedItems(updatedList);
            setCurrentMappingConfig(config);
            setIsUSDateFormat(detectedUS);
            setDateAuditLog(auditItems);
            if (dateOptions?.yearCorrections) {
                setActiveYearCorrections(dateOptions.yearCorrections);
            }

            const colName = config.colIdentifier >= 0 && config.colIdentifier < headers.length
                ? headers[config.colIdentifier]
                : (config.identifierType === 'id' ? 'Planday Employee ID' : 'Salary Identifier');

            setParsedStats({ 
                total: rows.length - 1, 
                checked: checkedCount,
                matched: matchedCount,
                unmatched: unmatchedCount,
                mode: config.identifierType,
                colName
            });

        } catch (err: any) {
            setUploadError(err.message || "Failed to process data rows with selected mapping.");
        }
    };

    // Stage 2: Handlers for Year & Century Ambiguity Resolution
    const handleConfirmDateAmbiguity = (corrections: Record<number, number>) => {
        setIsDateAmbiguityModalOpen(false);
        setActiveYearCorrections(corrections);
        if (pendingDateResolution) {
            applyMappingAndProcess(
                pendingDateResolution.config,
                pendingDateResolution.headers,
                pendingDateResolution.rows,
                {
                    forceUS: pendingDateResolution.forceUS,
                    yearCorrections: corrections
                }
            );
            setPendingDateResolution(null);
        }
    };

    const handleCancelDateAmbiguity = () => {
        setIsDateAmbiguityModalOpen(false);
        if (pendingDateResolution) {
            applyMappingAndProcess(
                pendingDateResolution.config,
                pendingDateResolution.headers,
                pendingDateResolution.rows,
                {
                    forceUS: pendingDateResolution.forceUS
                }
            );
            setPendingDateResolution(null);
        }
    };

    // Stage 4: User transparency handler to switch between US (MM/DD) and EU (DD/MM)
    const handleToggleDateFormat = () => {
        if (!uploadedFileRaw || !currentMappingConfig) return;
        const nextUS = !isUSDateFormat;
        setIsUSDateFormat(nextUS);
        applyMappingAndProcess(
            currentMappingConfig,
            uploadedFileRaw.headers,
            uploadedFileRaw.rows,
            {
                forceUS: nextUS,
                yearCorrections: activeYearCorrections
            }
        );
    };

    // 2. Parse Uploaded Excel file with Smart Column Detection
    const processFile = async (file: File) => {
        setUploadError(null);
        setUploadedFileName(file.name);
        setDateAuditLog([]);
        setAmbiguousDateItems([]);
        setActiveYearCorrections({});
        setPendingDateResolution(null);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                throw new Error("No sheet found in workbook.");
            }

            const sheet = workbook.Sheets[firstSheetName];
            const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (rawRows.length < 2) {
                throw new Error("Excel file is empty or has no data rows.");
            }

            const rawHeaders = (rawRows[0] || []).map((h, i) => String(h || `Column ${i + 1}`).trim());
            const headerRowLower = rawHeaders.map(h => h.toLowerCase());
            
            // Detect column indices
            const colId = headerRowLower.findIndex(h => 
                (h.includes('planday employee id') || 
                 h.includes('api id') || 
                 h === 'id' || 
                 h.includes('employee id') || 
                 h.includes('employeeid') || 
                 h.includes('employee_id')) && 
                !h.includes('salary') && !h.includes('payroll')
            );

            const colSalary = headerRowLower.findIndex(h => 
                h.includes('salary identifier') || 
                h.includes('payroll id') || 
                h.includes('salary id') || 
                h.includes('payroll') || 
                h.includes('salary') || 
                h.includes('salaryidentifier') || 
                h.includes('salary_identifier') ||
                h === 'pid'
            );

            const colFirst = headerRowLower.findIndex(h => h.includes('first name') || h.includes('firstname') || h === 'first');
            const colLast = headerRowLower.findIndex(h => h.includes('last name') || h.includes('lastname') || h === 'last' || h.includes('surname'));
            const colCheck = headerRowLower.findIndex(h => 
                h.includes('check to deactivate') || 
                h.includes('check') || 
                h.includes('deactivate') || 
                h.includes('select') ||
                h.includes('status') ||
                h.includes('terminate')
            );
            const colDate = headerRowLower.findIndex(h => 
                h.includes('deactivation date') || 
                h.includes('termination date') || 
                h.includes('exit date') || 
                h.includes('end date') || 
                h.includes('date')
            );
            const colReason = headerRowLower.findIndex(h => 
                h.includes('reason') || 
                h.includes('note') || 
                h.includes('comment') ||
                h.includes('cause')
            );
            const colTerm = headerRowLower.findIndex(h => 
                h.includes('termination type') || 
                h.includes('term type') || 
                h.includes('exit type') || 
                h.includes('termination')
            );
            const colKeep = headerRowLower.findIndex(h => 
                h.includes('keep shifts') || 
                h.includes('keep shift') || 
                h.includes('retain shifts') || 
                h.includes('shifts')
            );

            const hasId = colId !== -1;
            const hasSalary = colSalary !== -1;
            const hasCheck = colCheck !== -1;

            // Save raw data for modal review
            setUploadedFileRaw({
                headers: rawHeaders,
                rows: rawRows,
                fileName: file.name
            });

            // Default configuration
            const detectedConfig: ColumnMappingConfig = {
                identifierType: hasId ? 'id' : (hasSalary ? 'salaryIdentifier' : 'id'),
                colIdentifier: hasId ? colId : (hasSalary ? colSalary : 0),
                colCheck: hasCheck ? colCheck : 'all',
                colDate,
                colReason,
                colTerm,
                colKeep,
                colFirst,
                colLast,
            };

            setCurrentMappingConfig(detectedConfig);

            // 1. Both exist -> Ask user which one to use
            if (hasId && hasSalary) {
                setMappingReason('both_identifiers');
                setIsMappingModalOpen(true);
                return;
            }

            // 2. None exists -> Ask user which column carries salary identifier or planday employee ID
            if (!hasId && !hasSalary) {
                setMappingReason('no_identifier');
                setIsMappingModalOpen(true);
                return;
            }

            // 3. Only 1 exists:
            // "If only 1 exists, use this one. ... It might also be other columns are missing, so then the user should be asked to map these columns as well manually."
            if (!hasCheck) {
                setMappingReason('missing_columns');
                setIsMappingModalOpen(true);
                return;
            }

            // Both single identifier and check column exist -> apply mapping directly!
            applyMappingAndProcess(detectedConfig, rawHeaders, rawRows);

        } catch (err: any) {
            setUploadError(err.message || "Failed to parse Excel file.");
            setParsedStats(null);
        }
    };

    const handleOpenMappingReview = () => {
        if (!uploadedFileRaw) return;
        setMappingReason('manual_review');
        setIsMappingModalOpen(true);
    };

    const handleConfirmMapping = (newConfig: ColumnMappingConfig) => {
        setIsMappingModalOpen(false);
        if (uploadedFileRaw) {
            applyMappingAndProcess(newConfig, uploadedFileRaw.headers, uploadedFileRaw.rows, {
                forceUS: isUSDateFormat,
                yearCorrections: activeYearCorrections
            });
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const selectedCount = items.filter(i => i.selected).length;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Step 1: Filter & Download Template */}
            <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-visible">
                {/* Header banner */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-t-2xl border-b border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-bold text-gray-900">Step 1: Download Employee List</h3>
                                <span className="bg-blue-100 text-blue-800 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                                    {items.length} portal employees
                                </span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                                Download a pre-populated Excel template. You can optionally filter by Department, Group, or Type below to export only specific employees.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filters configuration section */}
                <div className="p-6 bg-white space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div>
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                                Filter Template (Optional)
                            </span>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Select criteria to generate a template containing only matching staff.
                            </p>
                        </div>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Reset Filters</span>
                            </button>
                        )}
                    </div>

                    {/* Filter controls with ample spacing and proper stacking context */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                        {/* Search input */}
                        <div className="flex flex-col">
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Search Employees
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search name, ID..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-7 py-2 bg-white border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                                />
                                <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Department filter */}
                        <MultiSelectMenu
                            label="Department"
                            options={effectiveDepartments}
                            selectedIds={filterDepartment}
                            onChange={setFilterDepartment}
                            toggleOptionLabel="Primary Dept Only"
                            toggleOptionEnabled={filterPrimaryDepartment}
                            onToggleOption={setFilterPrimaryDepartment}
                            toggleTooltipText="When enabled, only matches the employee's designated Primary Department"
                        />

                        {/* Employee Group filter */}
                        <MultiSelectMenu
                            label="Employee Group"
                            options={effectiveEmployeeGroups}
                            selectedIds={filterGroup}
                            onChange={setFilterGroup}
                        />

                        {/* Employee Type filter (if types exist in portal) */}
                        {effectiveEmployeeTypes.length > 0 && (
                            <MultiSelectMenu
                                label="Employee Type"
                                options={effectiveEmployeeTypes}
                                selectedIds={filterType}
                                onChange={setFilterType}
                            />
                        )}
                    </div>
                </div>

                {/* Action & Download Footer */}
                <div className="bg-gray-50/80 p-5 rounded-b-2xl border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                    {/* Status & count summary */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                            hasActiveFilters 
                                ? 'bg-blue-50 border-blue-200 text-blue-900' 
                                : 'bg-white border-gray-200 text-gray-700'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${hasActiveFilters ? 'bg-blue-600 animate-pulse' : 'bg-gray-400'}`}></span>
                            <span>
                                {hasActiveFilters ? (
                                    <>
                                        <strong>{filteredEmployeesForTemplate.length}</strong> of {items.length} employees match filters
                                    </>
                                ) : (
                                    <>
                                        All <strong>{items.length}</strong> employees selected
                                    </>
                                )}
                            </span>
                        </div>

                        {downloadNotification && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-800 border border-green-200 rounded-xl text-xs font-semibold animate-in fade-in duration-200">
                                <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                {downloadNotification}
                            </span>
                        )}
                    </div>

                    {/* Download buttons */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
                        {/* Download Blank Template */}
                        <button
                            type="button"
                            onClick={handleDownloadBlankTemplate}
                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2.5 px-3.5 rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Download an empty Excel template with headers only"
                        >
                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>Download Blank Template</span>
                        </button>

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={() => handleDownloadTemplate(true)}
                                className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-colors shadow-xs cursor-pointer"
                                title="Download complete template with all employees regardless of filters"
                            >
                                Download All ({items.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => handleDownloadTemplate(false)}
                            disabled={filteredEmployeesForTemplate.length === 0}
                            className={`font-semibold py-2.5 px-5 rounded-xl text-xs sm:text-sm transition-all shadow-sm shrink-0 flex items-center gap-2 cursor-pointer ${
                                filteredEmployeesForTemplate.length === 0
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                            }`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>
                                {hasActiveFilters 
                                    ? `Download Filtered Template (${filteredEmployeesForTemplate.length})` 
                                    : `Download Excel Template (${items.length})`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Upload Area */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100 text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Step 2: Upload Completed File</h3>
                <p className="text-xs text-gray-500 mb-6 max-w-xl mx-auto">
                    In your Excel sheet, enter <code className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700 font-mono font-bold">x</code> in the <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800 font-mono font-semibold">Check to Deactivate (x)</code> column for employees to deactivate (leave blank to skip), then upload it below.
                </p>

                {terminationTypes.length > 0 && (
                    <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-1.5 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-xs text-blue-800">
                        <span className="font-semibold text-blue-900">Valid Termination Types for this portal:</span>
                        {terminationTypes.map(t => (
                            <span key={t.id} className="bg-white border border-blue-200 text-blue-700 px-2 py-0.5 rounded text-[11px] font-medium">
                                {t.name}
                            </span>
                        ))}
                    </div>
                )}

                <div
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 transition-all cursor-pointer flex flex-col items-center justify-center gap-3 ${
                        isDragging 
                            ? 'border-blue-600 bg-blue-50/60 scale-[1.01]' 
                            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50/50'
                    }`}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                    />

                    <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-gray-800">
                            {uploadedFileName ? uploadedFileName : "Click to select or drag and drop your Excel file here"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Supports .xlsx, .xls, and .csv files
                        </p>
                    </div>
                </div>

                {/* Error message with manual mapping option */}
                {uploadError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <strong className="block text-red-900 font-semibold mb-0.5">Upload Notice:</strong>
                            <span>{uploadError}</span>
                        </div>
                        {uploadedFileRaw && (
                            <button
                                type="button"
                                onClick={handleOpenMappingReview}
                                className="px-3.5 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-xl font-semibold text-xs transition-colors shrink-0 cursor-pointer shadow-xs"
                            >
                                Map Columns Manually
                            </button>
                        )}
                    </div>
                )}

                {/* Success feedback */}
                {parsedStats && !uploadError && (
                    <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                        <div className="flex items-start gap-2.5">
                            <span className="p-1 bg-emerald-600 text-white rounded-lg text-xs leading-none font-bold shrink-0 mt-0.5">✓</span>
                            <div>
                                <p className="font-bold text-emerald-950 text-sm">
                                    File loaded successfully!
                                </p>
                                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                                    Processed <strong>{parsedStats.total}</strong> rows • Matched <strong>{parsedStats.matched}</strong> employees via <strong>{parsedStats.mode === 'id' ? 'Planday Employee ID (API)' : 'Salary Identifier (Payroll ID)'}</strong>{parsedStats.colName ? ` ("${parsedStats.colName}")` : ''} • <strong>{parsedStats.checked}</strong> marked for deactivation.
                                    {parsedStats.unmatched > 0 && (
                                        <span className="text-amber-800 font-medium block mt-1">
                                            ⚠️ {parsedStats.unmatched} row{parsedStats.unmatched === 1 ? '' : 's'} could not be mapped to existing employees.
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {uploadedFileRaw && (
                                <button
                                    type="button"
                                    onClick={handleOpenMappingReview}
                                    className="px-3 py-1.5 bg-white hover:bg-emerald-100/60 border border-emerald-300 text-emerald-800 font-semibold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                                    title="Adjust column mapping"
                                >
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                    </svg>
                                    <span>Remap Columns</span>
                                </button>
                            )}
                            <span className="bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs">
                                {parsedStats.checked} to deactivate
                            </span>
                        </div>
                    </div>
                )}

                {/* Stage 4: Date Conversion Transparency & Audit Report */}
                {dateAuditLog.length > 0 && !uploadError && (
                    <div className="mt-4 text-left">
                        <DateConversionReport
                            isUSFormat={isUSDateFormat}
                            auditItems={dateAuditLog}
                            onToggleFormat={handleToggleDateFormat}
                        />
                    </div>
                )}
            </div>

            {/* Column Mapping Modal */}
            {isMappingModalOpen && uploadedFileRaw && (
                <ColumnMappingModal
                    isOpen={isMappingModalOpen}
                    onClose={() => setIsMappingModalOpen(false)}
                    onConfirm={handleConfirmMapping}
                    rawHeaders={uploadedFileRaw.headers}
                    sampleRows={uploadedFileRaw.rows.slice(1, 5)}
                    initialConfig={currentMappingConfig}
                    reason={mappingReason}
                    fileName={uploadedFileRaw.fileName}
                />
            )}

            {/* Stage 2: Two-Digit Year & Century Ambiguity Resolution Modal */}
            {isDateAmbiguityModalOpen && ambiguousDateItems.length > 0 && (
                <DateAmbiguityModal
                    isOpen={isDateAmbiguityModalOpen}
                    items={ambiguousDateItems}
                    onConfirm={handleConfirmDateAmbiguity}
                    onCancel={handleCancelDateAmbiguity}
                />
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                    &larr; Back to Method
                </button>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600 hidden sm:inline">
                        <strong>{selectedCount}</strong> employee{selectedCount === 1 ? '' : 's'} checked
                    </span>

                    <button
                        type="button"
                        onClick={onNext}
                        disabled={selectedCount === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm cursor-pointer"
                    >
                        <span>Review & Confirm ({selectedCount})</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
