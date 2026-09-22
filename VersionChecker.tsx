import React, { useState, useEffect } from 'react';

const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const VersionChecker: React.FC = () => {
    const [hasNewVersion, setHasNewVersion] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);

    useEffect(() => {
        // Fetch current version on load
        fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
            .then(res => {
                if (!res.ok) throw new Error('Version file not found');
                return res.json();
            })
            .then(data => {
                if (data && data.version) {
                    setCurrentVersion(data.version);
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (!currentVersion) return;

        const checkVersion = async () => {
            try {
                const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                if (data && data.version && data.version !== currentVersion) {
                    setHasNewVersion(true);
                }
            } catch (error) {
                console.error("Failed to check version", error);
            }
        };

        // Check every 5 minutes
        const interval = setInterval(checkVersion, 5 * 60 * 1000);
        
        // Also check on window focus
        const onFocus = () => checkVersion();
        window.addEventListener('focus', onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener('focus', onFocus);
        };
    }, [currentVersion]);

    if (!hasNewVersion) return null;

    return (
        <div className="fixed top-0 left-0 w-full z-[100] bg-blue-600 text-white px-4 py-3 shadow-md flex justify-between items-center">
            <div className="flex items-center gap-3">
                <InfoIcon className="w-6 h-6 flex-shrink-0" />
                <span className="text-sm font-medium">
                    A new version of this tool is available. Please finish your current task, then click here to update.
                </span>
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="px-4 py-1.5 bg-white text-blue-600 text-sm font-bold rounded-lg shadow-sm hover:bg-blue-50 transition-colors flex-shrink-0"
            >
                Update Now
            </button>
        </div>
    );
};

export default VersionChecker;
