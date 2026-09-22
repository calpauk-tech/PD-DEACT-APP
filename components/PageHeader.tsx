import React from 'react';

interface PageHeaderProps {
    onOpenGuide: () => void;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ onOpenGuide }) => (
    <div className="text-center relative">
        <div className="flex items-center justify-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                Planday Bulk Deactivator
            </h1>
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                BETA
            </span>
        </div>
        <p className="mt-2 text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
            Bulk deactivate or schedule deactivation for Planday employees via the official Open API
        </p>
        <div className="mt-3">
            <button
                type="button"
                onClick={onOpenGuide}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Deactivation Process Guide & Rules
            </button>
        </div>
    </div>
);
