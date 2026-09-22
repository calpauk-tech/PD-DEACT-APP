import React, { useState, useEffect } from 'react';
import { AmbiguousDateItem } from '../dateUtils';

interface DateAmbiguityModalProps {
    isOpen: boolean;
    items: AmbiguousDateItem[];
    onConfirm: (yearCorrections: Record<number, number>) => void;
    onCancel: () => void;
}

export const DateAmbiguityModal: React.FC<DateAmbiguityModalProps> = ({
    isOpen,
    items,
    onConfirm,
    onCancel
}) => {
    // Map of rowIndex -> selected 4-digit year
    const [selections, setSelections] = useState<Record<number, number>>({});

    useEffect(() => {
        const initial: Record<number, number> = {};
        items.forEach(item => {
            initial[item.rowIndex] = item.recommendedCentury + item.twoDigitYear;
        });
        setSelections(initial);
    }, [items]);

    if (!isOpen || items.length === 0) return null;

    const handleSelectYear = (rowIndex: number, year: number) => {
        setSelections(prev => ({
            ...prev,
            [rowIndex]: year
        }));
    };

    const handleBulkApplyCentury = (century: 1900 | 2000) => {
        const updated: Record<number, number> = {};
        items.forEach(item => {
            updated[item.rowIndex] = century + item.twoDigitYear;
        });
        setSelections(updated);
    };

    const handleResetRecommendations = () => {
        const reset: Record<number, number> = {};
        items.forEach(item => {
            reset[item.rowIndex] = item.recommendedCentury + item.twoDigitYear;
        });
        setSelections(reset);
    };

    const handleConfirm = () => {
        onConfirm(selections);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-amber-50/70 to-orange-50/40">
                    <div className="flex items-start gap-3.5">
                        <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-sm shrink-0">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                2-Digit Year & Century Ambiguity Resolution
                            </h3>
                            <p className="text-xs text-gray-600 mt-1 max-w-xl">
                                We found <strong>{items.length}</strong> date value{items.length === 1 ? '' : 's'} written with a 2-digit year (e.g. &quot;24&quot; or &quot;98&quot;). Please confirm whether each belongs to the <strong>1900s</strong> or <strong>2000s</strong>.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onCancel}
                        type="button"
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-white/80 transition-colors cursor-pointer"
                        title="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Bulk Action Controls */}
                <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-gray-500 font-medium">Quick bulk actions:</span>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleBulkApplyCentury(2000)}
                            className="px-3 py-1 bg-white border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-700 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                            Set all to 2000s (e.g. 20{items[0]?.twoDigitYear.toString().padStart(2, '0')})
                        </button>
                        <button
                            type="button"
                            onClick={() => handleBulkApplyCentury(1900)}
                            className="px-3 py-1 bg-white border border-gray-200 hover:border-blue-400 text-gray-700 hover:text-blue-700 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                            Set all to 1900s (e.g. 19{items[0]?.twoDigitYear.toString().padStart(2, '0')})
                        </button>
                        <button
                            type="button"
                            onClick={handleResetRecommendations}
                            className="px-3 py-1 bg-white border border-gray-200 hover:border-gray-400 text-gray-600 rounded-lg font-medium transition-colors cursor-pointer shadow-2xs"
                        >
                            Reset to Recommended
                        </button>
                    </div>
                </div>

                {/* Table of Ambiguous Dates */}
                <div className="p-6 overflow-y-auto flex-1 divide-y divide-gray-100">
                    <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-2xs">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold">
                                    <th className="p-3 w-16 text-center">Row</th>
                                    <th className="p-3">Employee</th>
                                    <th className="p-3">Original Input</th>
                                    <th className="p-3 text-center">Select Target Year</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {items.map(item => {
                                    const y2000 = 2000 + item.twoDigitYear;
                                    const y1900 = 1900 + item.twoDigitYear;
                                    const selectedYear = selections[item.rowIndex] || (item.recommendedCentury + item.twoDigitYear);
                                    const isRec2000 = item.recommendedCentury === 2000;

                                    return (
                                        <tr key={item.rowIndex} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="p-3 text-center font-mono text-gray-400 font-semibold">
                                                #{item.excelRowNumber}
                                            </td>
                                            <td className="p-3">
                                                <div className="font-semibold text-gray-900">
                                                    {item.employeeName}
                                                </div>
                                                {item.employeeIdentifier && (
                                                    <div className="text-[11px] text-gray-500 font-mono">
                                                        {item.employeeIdentifier}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-800 font-semibold">
                                                    {item.originalInput}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectYear(item.rowIndex, y2000)}
                                                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            selectedYear === y2000
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <span>{y2000}</span>
                                                        {isRec2000 && (
                                                            <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${selectedYear === y2000 ? 'bg-blue-700 text-blue-100' : 'bg-gray-100 text-gray-500'}`}>
                                                                Suggested
                                                            </span>
                                                        )}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleSelectYear(item.rowIndex, y1900)}
                                                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                            selectedYear === y1900
                                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                                                                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <span>{y1900}</span>
                                                        {!isRec2000 && (
                                                            <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${selectedYear === y1900 ? 'bg-blue-700 text-blue-100' : 'bg-gray-100 text-gray-500'}`}>
                                                                Suggested
                                                            </span>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-200 text-gray-700 hover:bg-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                    >
                        <span>Confirm Years & Process ({items.length})</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
