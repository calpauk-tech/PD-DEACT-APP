import React from 'react';

interface ProcessGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProcessGuideModal: React.FC<ProcessGuideModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base">
                            📖
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 leading-tight">
                                Planday Deactivation Process Guide
                            </h3>
                            <p className="text-xs text-gray-500">
                                How employee deactivation, dates, and shifts work in Planday
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-200 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 overflow-y-auto space-y-6 text-sm text-gray-700 leading-relaxed">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-900 flex gap-3">
                        <span className="text-xl">ℹ️</span>
                        <div>
                            <h4 className="font-semibold text-blue-900 mb-1">Planday Open API Deactivation</h4>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                This app interacts directly with the official Planday Open API endpoint (<code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-950 font-mono">PUT /hr/v1.0/employees/deactivate/{'{employeeId}'}</code>) to deactivate selected employees securely from your browser.
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
                            <span>1.</span> Deactivation Date (Immediate vs. Scheduled)
                        </h4>
                        <div className="pl-6 space-y-2">
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="font-semibold text-gray-900 text-xs uppercase tracking-wide text-blue-600 mb-1">
                                    Option A: Immediate Deactivation
                                </div>
                                <p className="text-xs text-gray-600">
                                    <strong>Leave the date blank/empty:</strong> The employee will be deactivated immediately from today. In the API payload, this sets <code className="bg-gray-200 px-1 py-0.5 rounded font-mono">date: null</code>.
                                </p>
                            </div>
                            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="font-semibold text-gray-900 text-xs uppercase tracking-wide text-purple-600 mb-1">
                                    Option B: Scheduled Deactivation
                                </div>
                                <p className="text-xs text-gray-600">
                                    <strong>Provide a date (<code className="font-mono">YYYY-MM-DD</code>):</strong> The employee will remain active until the specified future date, after which Planday will automatically deactivate their profile.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
                            <span>2.</span> Keep Shifts Setting (TRUE vs. FALSE)
                        </h4>
                        <div className="pl-6 space-y-2">
                            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                                <span className="font-semibold text-emerald-900">FALSE (Default & Recommended):</span>
                                <p className="text-xs text-emerald-800 mt-1">
                                    Unassigns the employee from all future shifts scheduled past their deactivation date. Those shifts become open shifts in Planday so other staff can cover them.
                                </p>
                            </div>
                            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg">
                                <span className="font-semibold text-amber-900">TRUE:</span>
                                <p className="text-xs text-amber-800 mt-1">
                                    Keeps existing shifts assigned to the employee even past their deactivation date.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-gray-900 text-base mb-3 flex items-center gap-2">
                            <span>3.</span> Optional Deactivation Reason
                        </h4>
                        <div className="pl-6">
                            <p className="text-xs text-gray-600">
                                You can provide an optional text reason (e.g., <em>"Resignation"</em>, <em>"Contract End"</em>, <em>"Seasonal Staff"</em>) to document why the employee was deactivated. This is saved directly into the employee record in Planday.
                            </p>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 space-y-1.5">
                        <div className="flex items-center gap-1.5 font-medium text-gray-700">
                            <span>🔒</span> Security & Permissions Note
                        </div>
                        <p>
                            Your Planday API credentials must have the <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono">employee:update</code> scope enabled in your Planday portal under <strong>Settings &gt; API Access</strong>.
                        </p>
                        <p>
                            All calls are made client-side from your browser directly to Planday's official servers. Your tokens and employee records are never shared with any external service.
                        </p>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl transition-colors shadow-xs"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
};
