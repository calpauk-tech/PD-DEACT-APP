import React, { useState } from 'react';

interface ProcessingStepProps {
    current: number;
    total: number;
    currentEmployeeName: string;
    currentEmployeeId: number | null;
    successCount: number;
    failureCount: number;
    onAbort: () => void;
}

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
    current,
    total,
    currentEmployeeName,
    currentEmployeeId,
    successCount,
    failureCount,
    onAbort
}) => {
    const [showAbortConfirm, setShowAbortConfirm] = useState(false);

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-2xl mx-auto text-center space-y-6">
            <div className="flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                </div>

                <h2 className="text-2xl font-bold text-gray-900">
                    Deactivating Employees...
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                    Communicating with Planday Open API endpoint <code className="font-mono text-blue-600">/hr/v1.0/employees/deactivate/</code>
                </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>Progress ({percentage}%)</span>
                    <span className="text-blue-700 font-mono">
                        {current} of {total} processed
                    </span>
                </div>

                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden border border-gray-200">
                    <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            {/* Current Item Indicator */}
            {currentEmployeeName && (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600">
                    Currently processing: <strong className="text-gray-900">{currentEmployeeName}</strong>
                    {currentEmployeeId && (
                        <span className="ml-1 text-gray-400 font-mono">(ID: {currentEmployeeId})</span>
                    )}
                </div>
            )}

            {/* Live Counter Badges */}
            <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
                    <div className="text-xl font-bold">{successCount}</div>
                    <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Succeeded</div>
                </div>

                <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-900">
                    <div className="text-xl font-bold">{failureCount}</div>
                    <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wide">Failed</div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700">
                    <div className="text-xl font-bold">{Math.max(0, total - current)}</div>
                    <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Remaining</div>
                </div>
            </div>

            {/* Abort button */}
            <div className="pt-2 border-t border-gray-100">
                <button
                    type="button"
                    onClick={() => setShowAbortConfirm(true)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 px-4 py-2 rounded-lg transition-colors cursor-pointer"
                >
                    Cancel / Stop Remaining Process
                </button>
            </div>

            {/* Abort Confirmation Dialog */}
            {showAbortConfirm && (
                <div className="fixed inset-0 z-[140] flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100 space-y-4">
                        <h3 className="text-base font-bold text-gray-900">Stop Deactivation Process?</h3>
                        <p className="text-xs text-gray-600">
                            Employees already processed will remain deactivated. Remaining queued employees will not be touched.
                        </p>
                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowAbortConfirm(false)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100"
                            >
                                Continue Process
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAbortConfirm(false);
                                    onAbort();
                                }}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold"
                            >
                                Stop Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
