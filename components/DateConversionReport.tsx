import React, { useState } from 'react';
import { DateConversionAuditItem } from '../dateUtils';

interface DateConversionReportProps {
    isUSFormat: boolean;
    auditItems: DateConversionAuditItem[];
    onToggleFormat?: () => void;
}

export const DateConversionReport: React.FC<DateConversionReportProps> = ({
    isUSFormat,
    auditItems,
    onToggleFormat
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');

    if (auditItems.length === 0) return null;

    const filteredItems = searchFilter.trim() === ''
        ? auditItems
        : auditItems.filter(item => 
            item.employeeName.toLowerCase().includes(searchFilter.toLowerCase()) ||
            item.employeeIdentifier.toLowerCase().includes(searchFilter.toLowerCase()) ||
            item.originalInput.toLowerCase().includes(searchFilter.toLowerCase()) ||
            item.targetPayload.toLowerCase().includes(searchFilter.toLowerCase()) ||
            item.textDate.toLowerCase().includes(searchFilter.toLowerCase())
        );

    return (
        <div className="mt-3 bg-white border border-blue-200/90 rounded-2xl overflow-hidden shadow-2xs text-left">
            {/* Header Banner */}
            <div className="p-3.5 sm:p-4 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow-2xs shrink-0">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-900">
                                Date Format Detected:
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                                isUSFormat 
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                            }`}>
                                {isUSFormat ? 'US Format (MM/DD/YYYY)' : 'Standard/EU Format (DD/MM/YYYY)'}
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {auditItems.length} date{auditItems.length === 1 ? '' : 's'} normalized to ISO standard with day/month verification.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {onToggleFormat && (
                        <button
                            type="button"
                            onClick={onToggleFormat}
                            className="px-2.5 py-1.5 bg-white border border-gray-300 hover:border-blue-400 text-gray-700 hover:text-blue-700 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
                            title="Switch interpretation between DD/MM/YYYY and MM/DD/YYYY"
                        >
                            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                            <span>Switch to {isUSFormat ? 'Standard/EU (DD/MM)' : 'US (MM/DD)'}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-800 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                        <span>{isExpanded ? 'Hide Conversion Log' : 'View Conversion Log'}</span>
                        <svg className={`w-3.5 h-3.5 text-blue-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Expandable Verification Table */}
            {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-slate-50/50 border-t border-blue-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                        <p className="text-[11px] text-gray-600">
                            Check the spelled-out dates below to confirm that days and months were interpreted accurately.
                        </p>
                        {auditItems.length > 5 && (
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                placeholder="Filter dates..."
                                className="px-2.5 py-1 text-xs border border-gray-200 rounded-lg bg-white w-full sm:w-48 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                            />
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold sticky top-0 z-10">
                                    <th className="p-2.5 w-14 text-center">Row</th>
                                    <th className="p-2.5">Employee</th>
                                    <th className="p-2.5">Field</th>
                                    <th className="p-2.5">Original Input</th>
                                    <th className="p-2.5">Target Payload</th>
                                    <th className="p-2.5">Text Date (Verification)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItems.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="p-2.5 text-center font-mono text-gray-400 font-semibold">
                                            #{item.excelRowNumber}
                                        </td>
                                        <td className="p-2.5">
                                            <span className="font-semibold text-gray-900 block leading-tight">
                                                {item.employeeName}
                                            </span>
                                            {item.employeeIdentifier && (
                                                <span className="text-[10px] text-gray-500 font-mono">
                                                    {item.employeeIdentifier}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-2.5 text-gray-500">
                                            {item.fieldName}
                                        </td>
                                        <td className="p-2.5 font-mono text-gray-700">
                                            <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[11px]">
                                                {item.originalInput}
                                            </span>
                                        </td>
                                        <td className="p-2.5 font-mono text-blue-700 font-semibold">
                                            {item.targetPayload || <span className="text-gray-400 font-normal italic">None</span>}
                                        </td>
                                        <td className="p-2.5">
                                            {item.textDate ? (
                                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                                                    <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                    {item.textDate}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic">Invalid / Skipped</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
