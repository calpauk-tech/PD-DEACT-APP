import React, { useState, useMemo } from 'react';
import { DeactivationItem, TerminationType } from '../types';

interface ApiPayloadPreviewProps {
    items: DeactivationItem[];
    terminationTypes: TerminationType[];
    todayStr?: string;
}

export const ApiPayloadPreview: React.FC<ApiPayloadPreviewProps> = ({
    items,
    terminationTypes,
    todayStr = new Date().toISOString().split('T')[0]
}) => {
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // Pick the first couple of rows (prefer selected/queued rows; fallback to first visible rows)
    const previewRows = useMemo(() => {
        const selected = items.filter(i => i.selected);
        if (selected.length > 0) {
            return selected.slice(0, 3);
        }
        return items.slice(0, 3);
    }, [items]);

    const handleCopy = (payload: any, index: number) => {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1800);
    };

    if (previewRows.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Simple header */}
            <div className="px-5 py-3.5 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                        {'{ }'} PAYLOAD
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                        Live API Payload Preview
                    </h3>
                    <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Updates Live
                    </span>
                </div>
                <p className="text-xs text-gray-500">
                    Exact JSON payloads parsed from the table for the first {previewRows.length} {previewRows.length === 1 ? 'employee' : 'employees'}
                </p>
            </div>

            {/* Payloads Grid (First couple of rows side-by-side) */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-gray-50/30">
                {previewRows.map((item, idx) => {
                    // Exact payload mapping used by plandayService.deactivateEmployee
                    const dateVal = item.deactivationDate && item.deactivationDate.trim() !== ''
                        ? item.deactivationDate.trim()
                        : null;

                    const reasonVal = item.reason && item.reason.trim() !== ''
                        ? item.reason.trim()
                        : null;

                    const termId = item.terminationTypeId !== undefined && item.terminationTypeId !== null && !isNaN(Number(item.terminationTypeId))
                        ? Number(item.terminationTypeId)
                        : null;

                    const payload = {
                        date: dateVal,
                        reason: reasonVal,
                        keepShifts: Boolean(item.keepShifts),
                        terminationTypeId: termId
                    };

                    const termTypeName = termId !== null
                        ? (terminationTypes.find(t => t.id === termId)?.name || item.terminationTypeName || `ID ${termId}`)
                        : null;

                    return (
                        <div 
                            key={item.employeeId}
                            className="bg-slate-900 rounded-xl p-3.5 border border-slate-800 text-slate-100 flex flex-col justify-between shadow-xs"
                        >
                            {/* Card Top: Row & Employee Info */}
                            <div>
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-semibold text-slate-400">
                                            Row #{idx + 1}
                                        </span>
                                        <span className="font-bold text-xs text-white truncate max-w-[130px]" title={`${item.firstName} ${item.lastName}`}>
                                            {item.firstName} {item.lastName}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(payload, idx)}
                                        className="text-[11px] font-mono text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded transition-colors cursor-pointer"
                                        title="Copy JSON Payload"
                                    >
                                        {copiedIndex === idx ? '✓ Copied' : 'Copy'}
                                    </button>
                                </div>

                                {/* Endpoint URL */}
                                <div className="text-[11px] font-mono text-slate-400 mb-2 truncate">
                                    <span className="text-emerald-400 font-bold">PUT</span>{' '}
                                    <span className="text-slate-500">/hr/v1.0/employees/deactivate/</span>
                                    <span className="text-blue-300 font-bold">{item.employeeId}</span>
                                </div>

                                {/* Formatted JSON Payload */}
                                <div className="bg-slate-950/80 rounded-lg p-2.5 font-mono text-xs text-blue-200 border border-slate-850 overflow-x-auto">
                                    <pre className="text-[11.5px] leading-relaxed">
{JSON.stringify(payload, null, 2)}
                                    </pre>
                                </div>
                            </div>

                            {/* Card Bottom: Summary Notes */}
                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-1 font-sans">
                                <span>
                                    {dateVal ? `Date: ${dateVal}` : 'Immediate (Today)'}
                                </span>
                                <span>
                                    {termTypeName ? `Type: ${termTypeName}` : 'Type: None'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
