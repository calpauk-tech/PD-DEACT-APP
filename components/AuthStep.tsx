import React, { useState } from 'react';
import { PlandayApiCredentials } from '../types';

interface AuthStepProps {
    onSuccess: (credentials: PlandayApiCredentials) => void;
    isLoading: boolean;
}

const DEFAULT_CLIENT_ID = 'ea8d8bf4-a874-4535-8b2c-f7b7ccb87e86';

export const AuthStep: React.FC<AuthStepProps> = ({ onSuccess, isLoading }) => {
    const [token, setToken] = useState('');
    const [clientId, setClientId] = useState(DEFAULT_CLIENT_ID);
    const [showCustomClientId, setShowCustomClientId] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedToken = token.trim();
        const trimmedClient = clientId.trim() || DEFAULT_CLIENT_ID;
        if (trimmedToken) {
            onSuccess({
                clientId: trimmedClient,
                refreshToken: trimmedToken,
            });
        }
    };

    const handleCopyAppId = (idToCopy: string) => {
        navigator.clipboard.writeText(idToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="grid md:grid-cols-2 gap-8 items-start max-w-7xl mx-auto">
            {/* Left Box: Connect Form */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 leading-tight">Connect to Planday</h2>
                        <p className="text-xs text-gray-500">Secure direct API connection via Refresh Token</p>
                    </div>
                </div>

                <p className="text-sm text-gray-600 mb-6">
                    Enter your Planday refresh token to authenticate and fetch your active employee roster for deactivation.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2" htmlFor="token">
                            Planday Refresh Token <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="token"
                            type="password"
                            autoComplete="off"
                            placeholder="Paste your refresh token here..."
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                            required
                            disabled={isLoading}
                        />
                        <p className="text-xs text-gray-400 mt-1.5">
                            Tokens are stored only in your browser session and never sent to third parties.
                        </p>
                    </div>

                    {/* Advanced Client ID Toggle */}
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => setShowCustomClientId(!showCustomClientId)}
                            className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 font-medium transition-colors"
                        >
                            <span>{showCustomClientId ? '▼' : '▶'}</span>
                            <span>Advanced: Custom Client / App ID</span>
                            <span className="text-gray-400 text-[11px]">(Default is pre-configured)</span>
                        </button>

                        {showCustomClientId && (
                            <div className="mt-2.5 p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                                <label className="block text-xs font-semibold text-gray-700" htmlFor="clientId">
                                    Client / App ID
                                </label>
                                <input
                                    id="clientId"
                                    type="text"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                    placeholder="Enter custom App ID"
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        )}
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            disabled={!token.trim() || isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Connecting & Verifying...</span>
                                </>
                            ) : (
                                <span>Connect to Planday &rarr;</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Right Box: Token Guide */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center">
                <h3 className="text-2xl font-bold mb-3 text-gray-900">How to get your refresh token</h3>
                <p className="text-sm text-gray-600 mb-6">
                    Follow these steps in your Planday portal to generate your API credentials:
                </p>
                
                <ol className="list-decimal list-inside space-y-4 text-sm text-gray-700">
                    <li>
                        Log in to your <strong>Planday portal</strong> as an Admin
                    </li>
                    <li>
                        Navigate to <strong>Settings &rarr; API Access</strong>
                    </li>
                    <li>
                        Click <span className="bg-blue-100 text-blue-800 font-medium px-2 py-0.5 rounded text-xs">"Connect APP"</span> and connect to App ID:
                        <div className="mt-2 flex items-center justify-between bg-gray-100 p-2.5 rounded-lg border border-gray-200 font-mono text-xs text-gray-800">
                            <span className="break-all">{DEFAULT_CLIENT_ID}</span>
                            <button 
                                type="button"
                                className="text-gray-500 hover:text-blue-600 ml-2 p-1.5 transition-colors rounded hover:bg-gray-200 shrink-0" 
                                onClick={() => handleCopyAppId(DEFAULT_CLIENT_ID)} 
                                title="Copy App ID"
                            >
                                {copied ? (
                                    <span className="text-green-600 text-xs font-sans font-bold">Copied!</span>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </li>
                    <li>
                        Authorize the app when prompted (ensure <code className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-blue-700">employee:update</code> scope is active)
                    </li>
                    <li>
                        Copy the generated <strong>"Token"</strong> string and paste it into the field on the left
                    </li>
                </ol>
            </div>
        </div>
    );
};
