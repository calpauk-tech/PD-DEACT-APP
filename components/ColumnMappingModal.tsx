import React, { useState, useMemo } from 'react';

export interface ColumnMappingConfig {
    identifierType: 'id' | 'salaryIdentifier';
    colIdentifier: number; // index in rawHeaders (-1 if none)
    colCheck: number | 'all'; // column index or 'all' to treat every row as checked
    colDate: number; // index or -1
    colReason: number; // index or -1
    colTerm: number; // index or -1
    colKeep: number; // index or -1
    colFirst: number; // index or -1
    colLast: number; // index or -1
}

interface ColumnMappingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (config: ColumnMappingConfig) => void;
    rawHeaders: string[];
    sampleRows: any[][];
    initialConfig: ColumnMappingConfig;
    reason: 'both_identifiers' | 'no_identifier' | 'missing_columns' | 'manual_review';
    fileName: string;
}

export const ColumnMappingModal: React.FC<ColumnMappingModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    rawHeaders,
    sampleRows,
    initialConfig,
    reason,
    fileName,
}) => {
    const [config, setConfig] = useState<ColumnMappingConfig>(initialConfig);

    // Sync if initialConfig changes
    React.useEffect(() => {
        setConfig(initialConfig);
    }, [initialConfig]);

    if (!isOpen) return null;

    // Helper to get preview text from a column
    const getColPreview = (colIdx: number): string => {
        if (colIdx < 0 || colIdx >= rawHeaders.length) return '';
        for (const row of sampleRows) {
            if (row && row[colIdx] !== undefined && row[colIdx] !== null && String(row[colIdx]).trim() !== '') {
                return String(row[colIdx]).trim();
            }
        }
        return '(empty)';
    };

    const handleSave = () => {
        if (config.colIdentifier === -1) {
            alert('Please select a column for the Employee Identifier.');
            return;
        }
        onConfirm(config);
    };

    // Columns formatted for dropdowns
    const columnOptions = rawHeaders.map((name, idx) => ({
        index: idx,
        name: name || `Column ${idx + 1}`,
        sample: getColPreview(idx),
    }));

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                                </svg>
                            </span>
                            <h3 className="text-base font-bold text-gray-900">Map Excel Columns</h3>
                            <span className="text-[11px] font-mono text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md truncate max-w-[200px]" title={fileName}>
                                {fileName}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                            Verify how data columns from your file match Planday employee records.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer text-sm"
                        title="Close"
                    >
                        ✕
                    </button>
                </div>

                {/* Notice Banner based on situation */}
                <div className="px-5 pt-4 pb-1">
                    {reason === 'both_identifiers' && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <span className="font-semibold block text-blue-950">Multiple Identifiers Detected:</span>
                                Both <strong>Planday Employee ID</strong> and <strong>Salary Identifier</strong> were detected in your sheet. Please select which identifier you prefer to map employees with.
                            </div>
                        </div>
                    )}

                    {reason === 'no_identifier' && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <span className="font-semibold block text-amber-950">Identifier Column Required:</span>
                                We could not automatically recognize an employee ID column. Please select which column carries your <strong>Planday Employee ID (API)</strong> or <strong>Salary Identifier (Payroll ID)</strong> below.
                            </div>
                        </div>
                    )}

                    {reason === 'missing_columns' && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 flex items-start gap-2.5">
                            <svg className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                            <div>
                                <span className="font-semibold block text-slate-900">Please Review Missing Columns:</span>
                                Some deactivation columns (such as the deactivation check or date) could not be automatically located. Please confirm your mappings below.
                            </div>
                        </div>
                    )}
                </div>

                {/* Form Body */}
                <div className="p-5 overflow-y-auto space-y-5 text-xs text-gray-700">
                    {/* Primary Identifier Mapping Section */}
                    <div className="bg-gray-50/80 border border-gray-200 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="font-bold text-gray-900 text-xs uppercase tracking-wide flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                                Step 1: Choose Employee Identifier Column
                            </label>
                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                Required
                            </span>
                        </div>

                        {/* Strategy Selection */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, identifierType: 'id' }))}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                                    config.identifierType === 'id'
                                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                                        : 'bg-white/60 border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="identifierType"
                                    checked={config.identifierType === 'id'}
                                    onChange={() => setConfig(prev => ({ ...prev, identifierType: 'id' }))}
                                    className="mt-0.5 text-blue-600"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block text-xs">Planday Employee ID (API)</span>
                                    <span className="text-[11px] text-gray-500">Numeric API ID (e.g. 10423)</span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setConfig(prev => ({ ...prev, identifierType: 'salaryIdentifier' }))}
                                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2.5 ${
                                    config.identifierType === 'salaryIdentifier'
                                        ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                                        : 'bg-white/60 border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="identifierType"
                                    checked={config.identifierType === 'salaryIdentifier'}
                                    onChange={() => setConfig(prev => ({ ...prev, identifierType: 'salaryIdentifier' }))}
                                    className="mt-0.5 text-blue-600"
                                />
                                <div>
                                    <span className="font-bold text-gray-900 block text-xs">Salary Identifier (Payroll ID)</span>
                                    <span className="text-[11px] text-gray-500">Alphanumeric Payroll ID (e.g. EMP-081)</span>
                                </div>
                            </button>
                        </div>

                        {/* Column selector for Identifier */}
                        <div className="pt-2">
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                                Sheet column carrying this identifier:
                            </label>
                            <select
                                value={config.colIdentifier}
                                onChange={e => setConfig(prev => ({ ...prev, colIdentifier: parseInt(e.target.value, 10) }))}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value={-1} disabled>-- Select Column --</option>
                                {columnOptions.map(col => (
                                    <option key={col.index} value={col.index}>
                                        {col.name} {col.sample ? `(Sample: "${col.sample}")` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Deactivation Parameter Columns */}
                    <div className="space-y-3">
                        <label className="font-bold text-gray-900 text-xs uppercase tracking-wide block">
                            Step 2: Map Action & Details Columns
                        </label>

                        {/* Check to Deactivate (x) */}
                        <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="font-semibold text-gray-800 text-xs flex items-center gap-1.5">
                                    <span>Check to Deactivate (x)</span>
                                    <span className="text-[10px] text-gray-400 font-normal">('x' = TRUE, blank = FALSE)</span>
                                </label>
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
                                    Recommended
                                </span>
                            </div>

                            <select
                                value={config.colCheck}
                                onChange={e => {
                                    const val = e.target.value;
                                    setConfig(prev => ({
                                        ...prev,
                                        colCheck: val === 'all' ? 'all' : parseInt(val, 10),
                                    }));
                                }}
                                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            >
                                <option value="all">⭐️ Mark ALL employees in this file for deactivation</option>
                                {columnOptions.map(col => (
                                    <option key={col.index} value={col.index}>
                                        Use Column: {col.name} {col.sample ? `(Sample: "${col.sample}")` : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-gray-500">
                                If your spreadsheet contains only employees to deactivate, select "Mark ALL employees". Otherwise select the column where 'x' (or TRUE) marks employees for deactivation.
                            </p>
                        </div>

                        {/* 2-column grid for other optional attributes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Deactivation Date */}
                            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                                <label className="font-semibold text-gray-800 text-xs block">
                                    Deactivation Date (Optional)
                                </label>
                                <select
                                    value={config.colDate}
                                    onChange={e => setConfig(prev => ({ ...prev, colDate: parseInt(e.target.value, 10) }))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value={-1}>(None - Keep default)</option>
                                    {columnOptions.map(col => (
                                        <option key={col.index} value={col.index}>
                                            {col.name} {col.sample ? `(${col.sample})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Reason */}
                            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                                <label className="font-semibold text-gray-800 text-xs block">
                                    Reason (Optional)
                                </label>
                                <select
                                    value={config.colReason}
                                    onChange={e => setConfig(prev => ({ ...prev, colReason: parseInt(e.target.value, 10) }))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value={-1}>(None - Keep default)</option>
                                    {columnOptions.map(col => (
                                        <option key={col.index} value={col.index}>
                                            {col.name} {col.sample ? `(${col.sample})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Termination Type */}
                            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                                <label className="font-semibold text-gray-800 text-xs block">
                                    Termination Type (Optional)
                                </label>
                                <select
                                    value={config.colTerm}
                                    onChange={e => setConfig(prev => ({ ...prev, colTerm: parseInt(e.target.value, 10) }))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value={-1}>(None - Keep default)</option>
                                    {columnOptions.map(col => (
                                        <option key={col.index} value={col.index}>
                                            {col.name} {col.sample ? `(${col.sample})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Keep Shifts */}
                            <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                                <label className="font-semibold text-gray-800 text-xs block">
                                    Keep Shifts (Optional)
                                </label>
                                <select
                                    value={config.colKeep}
                                    onChange={e => setConfig(prev => ({ ...prev, colKeep: parseInt(e.target.value, 10) }))}
                                    className="w-full bg-white border border-gray-300 rounded-xl px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                    <option value={-1}>(None - Default to FALSE)</option>
                                    {columnOptions.map(col => (
                                        <option key={col.index} value={col.index}>
                                            {col.name} {col.sample ? `(${col.sample})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Name fallbacks (Collapsible / Advanced) */}
                        <div className="pt-1">
                            <details className="text-gray-500 text-[11px] group cursor-pointer">
                                <summary className="hover:text-gray-700 font-medium select-none">
                                    ▸ Optional: Name Matching Fallbacks (Click to configure)
                                </summary>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div>
                                        <label className="block font-medium text-gray-700 mb-1">First Name Column</label>
                                        <select
                                            value={config.colFirst}
                                            onChange={e => setConfig(prev => ({ ...prev, colFirst: parseInt(e.target.value, 10) }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs"
                                        >
                                            <option value={-1}>(None)</option>
                                            {columnOptions.map(col => (
                                                <option key={col.index} value={col.index}>
                                                    {col.name} {col.sample ? `(${col.sample})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-medium text-gray-700 mb-1">Last Name Column</label>
                                        <select
                                            value={config.colLast}
                                            onChange={e => setConfig(prev => ({ ...prev, colLast: parseInt(e.target.value, 10) }))}
                                            className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-xs"
                                        >
                                            <option value={-1}>(None)</option>
                                            {columnOptions.map(col => (
                                                <option key={col.index} value={col.index}>
                                                    {col.name} {col.sample ? `(${col.sample})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>

                    {/* Preview Table of mapped rows */}
                    {sampleRows.length > 0 && config.colIdentifier !== -1 && (
                        <div className="pt-2">
                            <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                                <span>Preview of First {Math.min(3, sampleRows.length)} Data Rows</span>
                                <span className="text-[10px] text-gray-400 font-normal">Mapped with selected columns</span>
                            </div>
                            <div className="border border-gray-200 rounded-xl overflow-x-auto text-[11px]">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
                                        <tr>
                                            <th className="p-2">Identifier ({config.identifierType === 'id' ? 'API ID' : 'Payroll ID'})</th>
                                            <th className="p-2">Deactivate?</th>
                                            <th className="p-2">Date</th>
                                            <th className="p-2">Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sampleRows.slice(0, 3).map((row, rIdx) => {
                                            const idVal = config.colIdentifier !== -1 ? String(row[config.colIdentifier] || '-') : '-';
                                            const rawVal = config.colCheck === 'all' 
                                                ? 'All' 
                                                : (config.colCheck !== -1 ? String(row[config.colCheck] ?? '').trim() : '');
                                            const lower = rawVal.toLowerCase();
                                            const isChecked = lower === 'x' || lower === 'true' || lower === '1' || lower === 'yes' || rawVal === 'All';
                                            const dateVal = config.colDate !== -1 ? String(row[config.colDate] ?? '-') : '-';
                                            const reasonVal = config.colReason !== -1 ? String(row[config.colReason] ?? '-') : '-';

                                            return (
                                                <tr key={rIdx} className="hover:bg-gray-50/50">
                                                    <td className="p-2 font-mono font-medium text-blue-700">{idVal}</td>
                                                    <td className="p-2 font-semibold">
                                                        {isChecked ? (
                                                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                                ✓ Yes {rawVal !== 'All' ? `("${rawVal}")` : '(All)'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 font-normal">
                                                                {rawVal ? `No ("${rawVal}")` : 'No (blank)'}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-gray-600">{dateVal}</td>
                                                    <td className="p-2 text-gray-600 truncate max-w-[150px]">{reasonVal}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={config.colIdentifier === -1}
                        className={`px-5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 ${
                            config.colIdentifier === -1
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                        }`}
                    >
                        <span>Apply Mapping & Process File</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
