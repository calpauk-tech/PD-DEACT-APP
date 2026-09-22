import React, { useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import { DeactivationResult } from '../types';
import { formatDisplayDate } from '../dateUtils';

interface ResultsStepProps {
    results: DeactivationResult[];
    onBack1Step: () => void;
    onBackToEditor: () => void;
    onFixErrors: () => void;
    onRestart: () => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
    results,
    onBack1Step,
    onBackToEditor,
    onFixErrors,
    onRestart
}) => {
    const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    const filteredResults = results.filter(r => {
        if (filterStatus === 'success') return r.success;
        if (filterStatus === 'error') return !r.success;
        return true;
    });

    const handleExportResultsExcel = () => {
        const headers = [
            'Status',
            'Employee ID',
            'Employee Name',
            'Deactivation Date',
            'Termination Type',
            'Keep Shifts',
            'Reason',
            'Result Message'
        ];

        const rows = results.map(r => [
            r.success ? 'SUCCESS' : 'FAILED',
            r.employeeId,
            r.employeeName,
            formatDisplayDate(r.date),
            r.terminationTypeName || (r.terminationTypeId ? `#${r.terminationTypeId}` : ''),
            r.keepShifts ? 'TRUE' : 'FALSE',
            r.reason || '',
            r.message
        ]);

        const data = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(data);

        // Header style
        const headerStyle = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1E40AF" } },
            alignment: { horizontal: "center", vertical: "center" }
        };

        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:H1');
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
            if (ws[cellAddress]) {
                ws[cellAddress].s = headerStyle;
            }
        }

        // Color status rows
        for (let R = 1; R <= results.length; ++R) {
            const statusCell = XLSX.utils.encode_cell({ r: R, c: 0 });
            const isSuccess = results[R - 1].success;
            if (ws[statusCell]) {
                ws[statusCell].s = {
                    font: { bold: true, color: { rgb: isSuccess ? "065F46" : "991B1B" } },
                    fill: { fgColor: { rgb: isSuccess ? "D1FAE5" : "FEE2E2" } }
                };
            }
        }

        ws['!cols'] = [
            { wch: 12 }, // Status
            { wch: 14 }, // Employee ID
            { wch: 22 }, // Name
            { wch: 20 }, // Date
            { wch: 22 }, // Termination Type
            { wch: 14 }, // Keep Shifts
            { wch: 24 }, // Reason
            { wch: 45 }  // Message
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Deactivation Results");

        const todayStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `Planday_Deactivation_Results_${todayStr}.xlsx`);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            {/* Header Summary Banner */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Deactivation Process Finished</h2>
                        <p className="text-xs text-gray-500">
                            Summary of API deactivation requests sent to Planday
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Always available Back buttons */}
                        <button
                            type="button"
                            onClick={onBack1Step}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Return to Review Step (all edits preserved)"
                        >
                            <span>← Back 1 Step (Review)</span>
                        </button>

                        <button
                            type="button"
                            onClick={onBackToEditor}
                            className="bg-white border border-blue-300 hover:bg-blue-50 text-blue-700 font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                            title="Return to Table Editor with all your changes preserved"
                        >
                            <span>← Back to Editor</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportResultsExcel}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download Results (Excel)</span>
                        </button>

                        <button
                            type="button"
                            onClick={onRestart}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
                            title="Reset selections and start a new batch"
                        >
                            New Batch
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                        <div className="text-3xl font-bold text-gray-900">{results.length}</div>
                        <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider mt-0.5">Attempted</div>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                        <div className="text-3xl font-bold text-emerald-800">{successCount}</div>
                        <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider mt-0.5">Succeeded</div>
                    </div>

                    <div className={`p-4 rounded-xl border ${
                        failureCount > 0 ? 'bg-red-50 border-red-200 text-red-900' : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}>
                        <div className="text-3xl font-bold">{failureCount}</div>
                        <div className="text-xs font-semibold uppercase tracking-wider mt-0.5">Failed</div>
                    </div>
                </div>
            </div>

            {/* Error Recovery Banner if failures exist */}
            {failureCount > 0 && (
                <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">⚠️</span>
                        <div>
                            <h4 className="text-sm font-bold text-amber-900">
                                {failureCount} employee{failureCount > 1 ? 's' : ''} had errors during deactivation
                            </h4>
                            <p className="text-xs text-amber-800 mt-0.5">
                                The app has preserved all your configured dates, reasons, and termination types. You can return to the editor to make small changes to the fields that failed and try again.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onFixErrors}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                        <span>Review & Fix Failed Items ({failureCount}) →</span>
                    </button>
                </div>
            )}

            {/* Filter Tabs & Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                                filterStatus === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            All ({results.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterStatus('success')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                                filterStatus === 'success' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Succeeded ({successCount})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterStatus('error')}
                            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                                filterStatus === 'error' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Failed ({failureCount})
                        </button>
                    </div>

                    <span className="text-gray-500">
                        Showing {filteredResults.length} records
                    </span>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-3 w-28">Status</th>
                                <th className="p-3 w-20">ID</th>
                                <th className="p-3">Employee Name</th>
                                <th className="p-3">Effective Date</th>
                                <th className="p-3">Termination Type</th>
                                <th className="p-3">Keep Shifts</th>
                                <th className="p-3">Reason</th>
                                <th className="p-3">API Response</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredResults.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                                        No records for selected filter.
                                    </td>
                                </tr>
                            ) : (
                                filteredResults.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        {/* Status badge */}
                                        <td className="p-3">
                                            {item.success ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                                                    ✓ Success
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-800 bg-red-100/70 border border-red-300 px-2.5 py-0.5 rounded-full">
                                                    ✕ Failed
                                                </span>
                                            )}
                                        </td>

                                        {/* ID */}
                                        <td className="p-3 font-mono text-gray-500 text-xs">
                                            {item.employeeId}
                                        </td>

                                        {/* Name */}
                                        <td className="p-3 font-semibold text-gray-900">
                                            {item.employeeName}
                                        </td>

                                        {/* Date - formatted as DD/MM/YYYY e.g. 22/09/2026 */}
                                        <td className="p-3 text-xs font-mono font-medium text-gray-800">
                                            {formatDisplayDate(item.date)}
                                        </td>

                                        {/* Termination Type */}
                                        <td className="p-3 text-xs">
                                            {item.terminationTypeName ? (
                                                <span className="inline-flex items-center text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                                    {item.terminationTypeName}
                                                </span>
                                            ) : item.terminationTypeId ? (
                                                <span className="text-xs font-mono text-gray-600">
                                                    #{item.terminationTypeId}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">None</span>
                                            )}
                                        </td>

                                        {/* Keep Shifts */}
                                        <td className="p-3 text-xs">
                                            {item.keepShifts ? 'TRUE (Kept)' : 'FALSE (Unassigned)'}
                                        </td>

                                        {/* Reason */}
                                        <td className="p-3 text-xs text-gray-600 italic">
                                            {item.reason || '-'}
                                        </td>

                                        {/* Message */}
                                        <td className="p-3 text-xs font-mono">
                                            <span className={item.success ? 'text-emerald-700' : 'text-red-700 font-semibold'}>
                                                {item.message}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

