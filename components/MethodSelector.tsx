import React from 'react';
import { DeactivationMethod } from '../types';

interface MethodSelectorProps {
    method: DeactivationMethod;
    setMethod: (method: DeactivationMethod) => void;
    onContinue: () => void;
    onBack?: () => void;
    totalEmployeesCount: number;
}

export const MethodSelector: React.FC<MethodSelectorProps> = ({ method, setMethod, onContinue, onBack, totalEmployeesCount }) => {
    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 max-w-3xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Deactivation Method</h2>
                <p className="text-sm text-gray-500">
                    Choose how you want to select and configure employees for deactivation ({totalEmployeesCount} active employees found in portal)
                </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 mb-8">
                {/* Method 1: Excel File (DEFAULT) */}
                <label 
                    className={`cursor-pointer border-2 rounded-2xl p-6 flex flex-col items-center justify-between text-center transition-all ${
                        method === 'excel' 
                            ? 'border-emerald-600 bg-emerald-50/50 shadow-md ring-2 ring-emerald-100' 
                            : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50/60'
                    }`}
                >
                    <input 
                        type="radio" 
                        name="deactivationMethod" 
                        value="excel" 
                        checked={method === 'excel'} 
                        onChange={() => setMethod('excel')} 
                        className="sr-only" 
                    />
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-900 mb-1 flex items-center justify-center gap-2">
                            <span>Use Excel Sheet</span>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Default</span>
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                            Download an Excel sheet pre-filled with all active employees, mark checked rows in Excel, and upload back.
                        </div>
                    </div>
                    <span className={`mt-4 text-xs font-semibold px-3 py-1 rounded-full ${
                        method === 'excel' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                        {method === 'excel' ? 'Selected (Default)' : 'Select'}
                    </span>
                </label>

                {/* Method 2: Table Editor */}
                <label 
                    className={`cursor-pointer border-2 rounded-2xl p-6 flex flex-col items-center justify-between text-center transition-all ${
                        method === 'editor' 
                            ? 'border-blue-600 bg-blue-50/50 shadow-md ring-2 ring-blue-100' 
                            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50/60'
                    }`}
                >
                    <input 
                        type="radio" 
                        name="deactivationMethod" 
                        value="editor" 
                        checked={method === 'editor'} 
                        onChange={() => setMethod('editor')} 
                        className="sr-only" 
                    />
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-lg font-bold text-gray-900 mb-1">Interactive Table Editor</div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                            Search, filter, check rows, set dates and reasons directly inside your browser. Recommended for quick and visual updates.
                        </div>
                    </div>
                    <span className={`mt-4 text-xs font-semibold px-3 py-1 rounded-full ${
                        method === 'editor' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                        {method === 'editor' ? 'Selected' : 'Select'}
                    </span>
                </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                {onBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                    >
                        ← Back to Connection
                    </button>
                ) : <div />}

                <button
                    type="button"
                    onClick={onContinue}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors shadow-sm flex items-center gap-2 cursor-pointer text-sm"
                >
                    <span>Continue to {method === 'editor' ? 'Table Editor' : 'Excel Upload'}</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </button>
            </div>
        </div>
    );
};
