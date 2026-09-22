import React, { useState, useEffect, useRef } from 'react';
import VersionChecker from './VersionChecker';
import { PageHeader } from './components/PageHeader';
import { Stepper } from './components/Stepper';
import { ProcessGuideModal } from './components/ProcessGuideModal';
import { AuthStep } from './components/AuthStep';
import { MethodSelector } from './components/MethodSelector';
import { TableEditorStep } from './components/TableEditorStep';
import { ExcelUploadStep } from './components/ExcelUploadStep';
import { ReviewStep } from './components/ReviewStep';
import { ProcessingStep } from './components/ProcessingStep';
import { ResultsStep } from './components/ResultsStep';
import { 
    PlandayApiCredentials, 
    Employee, 
    Department, 
    EmployeeGroup, 
    EmployeeType,
    DeactivationItem, 
    DeactivationMethod,
    DeactivationResult,
    TerminationType
} from './types';
import { 
    initializeService, 
    resetService, 
    fetchEmployees, 
    fetchDepartments, 
    fetchEmployeeGroups, 
    fetchEmployeeTypes,
    fetchPortalInfo, 
    fetchTerminationTypes,
    deactivateEmployee 
} from './services/plandayService';

const STEP_CONFIG = [
    { title: 'Authentication', subtitle: 'Connect to Planday' },
    { title: 'Configuration', subtitle: 'Deactivation Method' },
    { title: 'Selection', subtitle: 'Choose Employees' },
    { title: 'Review', subtitle: 'Check & Confirm' },
    { title: 'Process', subtitle: 'Executing API' },
    { title: 'Results', subtitle: 'Summary & Report' },
];

export const App: React.FC = () => {
    // Application Step (0 to 5)
    const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
    const [method, setMethod] = useState<DeactivationMethod>('excel');

    // Authentication & Account State
    const [credentials, setCredentials] = useState<PlandayApiCredentials | null>(null);
    const [portalInfo, setPortalInfo] = useState<any | null>(null);

    // Organization Data
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [employeeGroups, setEmployeeGroups] = useState<EmployeeGroup[]>([]);
    const [employeeTypes, setEmployeeTypes] = useState<EmployeeType[]>([]);
    const [terminationTypes, setTerminationTypes] = useState<TerminationType[]>([]);
    const [deactivationItems, setDeactivationItems] = useState<DeactivationItem[]>([]);

    // Loading & Status
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Modal
    const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

    // Execution & Progress State
    const [processingProgress, setProcessingProgress] = useState({
        current: 0,
        total: 0,
        currentEmployeeName: '',
        currentEmployeeId: null as number | null,
        successCount: 0,
        failureCount: 0,
    });
    const abortRef = useRef<boolean>(false);
    const [results, setResults] = useState<DeactivationResult[]>([]);

    // Check for stored credentials on mount
    useEffect(() => {
        const stored = sessionStorage.getItem('plandayCredentials');
        if (stored) {
            try {
                const parsed: PlandayApiCredentials = JSON.parse(stored);
                if (parsed.clientId && parsed.refreshToken) {
                    handleConnect(parsed);
                }
            } catch (e) {
                sessionStorage.removeItem('plandayCredentials');
            }
        }
    }, []);

    // Connect & Load Initial Data
    const handleConnect = async (creds: PlandayApiCredentials) => {
        setIsLoading(true);
        setErrorMessage(null);
        setLoadingMessage('Authenticating with Planday...');

        try {
            initializeService(creds);
            
            // Validate credentials by fetching portal info and basic data
            const portal = await fetchPortalInfo();
            setPortalInfo(portal);

            setLoadingMessage('Loading departments, groups, and termination types...');
            const [depts, groups, termTypes, empTypes] = await Promise.all([
                fetchDepartments(),
                fetchEmployeeGroups(),
                fetchTerminationTypes(),
                fetchEmployeeTypes(),
            ]);
            setDepartments(depts);
            setEmployeeGroups(groups);
            setTerminationTypes(termTypes);
            setEmployeeTypes(empTypes);

            setLoadingMessage('Fetching active employees from portal...');
            const emps = await fetchEmployees((loaded, total) => {
                if (total) {
                    setLoadingMessage(`Loading active employees (${loaded} of ${total})...`);
                } else {
                    setLoadingMessage(`Loading active employees (${loaded} fetched)...`);
                }
            });
            setEmployees(emps);

            // Create lookup maps for display
            const deptMap = new Map<number, string>();
            depts.forEach(d => deptMap.set(d.id, d.name));

            const groupMap = new Map<number, string>();
            groups.forEach(g => groupMap.set(g.id, g.name));

            // Map employees to DeactivationItems
            const items: DeactivationItem[] = emps.map(emp => {
                const deptIds = emp.departmentIds || [];
                const groupIds = emp.employeeGroupIds || [];

                const deptNames = deptIds
                    .map(id => deptMap.get(id))
                    .filter((n): n is string => Boolean(n));

                const grpNames = groupIds
                    .map(id => groupMap.get(id))
                    .filter((n): n is string => Boolean(n));

                return {
                    employeeId: emp.id,
                    salaryIdentifier: emp.salaryIdentifier || '',
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    departmentNames: deptNames,
                    employeeGroupNames: grpNames,
                    departmentIds: deptIds,
                    employeeGroupIds: groupIds,
                    primaryDepartmentId: emp.primaryDepartmentId,
                    employeeTypeId: emp.employeeTypeId,
                    selected: false,
                    deactivationDate: '', // Empty = Immediate today
                    reason: '',
                    keepShifts: false, // Default: False (Unassign shifts past deactivation date)
                };
            });

            setDeactivationItems(items);
            setCredentials(creds);
            sessionStorage.setItem('plandayCredentials', JSON.stringify(creds));
            setCurrentStepIndex(1); // Proceed to Method Selection
        } catch (err: any) {
            console.error('Connection failed:', err);
            setErrorMessage(err.message || 'Failed to connect to Planday. Please verify your credentials.');
            resetService();
            setCredentials(null);
            sessionStorage.removeItem('plandayCredentials');
        } finally {
            setIsLoading(false);
            setLoadingMessage('');
        }
    };

    const handleDisconnect = () => {
        resetService();
        setCredentials(null);
        setPortalInfo(null);
        setEmployees([]);
        setTerminationTypes([]);
        setDeactivationItems([]);
        setResults([]);
        sessionStorage.removeItem('plandayCredentials');
        setCurrentStepIndex(0);
    };

    // Item updates from Table Editor
    const handleUpdateItem = (employeeId: number, changes: Partial<DeactivationItem>) => {
        setDeactivationItems(prev => prev.map(item => {
            if (item.employeeId !== employeeId) return item;
            const isModifyingData = changes.deactivationDate !== undefined || changes.reason !== undefined || changes.terminationTypeId !== undefined || changes.keepShifts !== undefined;
            const updated = { ...item, ...changes };
            if (isModifyingData && item.status === 'error') {
                updated.status = 'pending';
                updated.resultMessage = undefined;
            }
            return updated;
        }));
    };

    const handleBulkUpdate = (employeeIds: number[], changes: Partial<DeactivationItem>) => {
        const idSet = new Set(employeeIds);
        setDeactivationItems(prev => prev.map(item => {
            if (!idSet.has(item.employeeId)) return item;
            const isModifyingData = changes.deactivationDate !== undefined || changes.reason !== undefined || changes.terminationTypeId !== undefined || changes.keepShifts !== undefined;
            const updated = { ...item, ...changes };
            if (isModifyingData && item.status === 'error') {
                updated.status = 'pending';
                updated.resultMessage = undefined;
            }
            return updated;
        }));
    };

    // Execute Bulk Deactivation Process
    const handleStartDeactivation = async () => {
        const itemsToProcess = deactivationItems.filter(i => i.selected);
        if (itemsToProcess.length === 0) return;

        abortRef.current = false;
        setCurrentStepIndex(4); // Move to Processing step

        setProcessingProgress({
            current: 0,
            total: itemsToProcess.length,
            currentEmployeeName: '',
            currentEmployeeId: null,
            successCount: 0,
            failureCount: 0,
        });

        const executionResults: DeactivationResult[] = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
            if (abortRef.current) {
                // User requested cancellation
                for (let j = i; j < itemsToProcess.length; j++) {
                    const remaining = itemsToProcess[j];
                    executionResults.push({
                        employeeId: remaining.employeeId,
                        employeeName: `${remaining.firstName} ${remaining.lastName}`,
                        success: false,
                        message: 'Aborted by user prior to execution',
                        date: remaining.deactivationDate || null,
                        reason: remaining.reason || null,
                        keepShifts: remaining.keepShifts,
                    });
                }
                break;
            }

            const item = itemsToProcess[i];
            const fullName = `${item.firstName} ${item.lastName}`;

            setProcessingProgress({
                current: i + 1,
                total: itemsToProcess.length,
                currentEmployeeName: fullName,
                currentEmployeeId: item.employeeId,
                successCount,
                failureCount,
            });

            try {
                const matchedTermType = terminationTypes.find(t => t.id === item.terminationTypeId);
                const termName = item.terminationTypeName || (matchedTermType ? matchedTermType.name : null);

                await deactivateEmployee(item.employeeId, {
                    date: item.deactivationDate || null,
                    reason: item.reason || null,
                    keepShifts: item.keepShifts,
                    terminationTypeId: item.terminationTypeId || null,
                });

                successCount++;
                executionResults.push({
                    employeeId: item.employeeId,
                    employeeName: fullName,
                    success: true,
                    message: item.deactivationDate 
                        ? `Scheduled for deactivation on ${item.deactivationDate}` 
                        : 'Deactivated immediately today',
                    date: item.deactivationDate || null,
                    reason: item.reason || null,
                    keepShifts: item.keepShifts,
                    terminationTypeId: item.terminationTypeId || null,
                    terminationTypeName: termName,
                });
            } catch (err: any) {
                failureCount++;
                const matchedTermType = terminationTypes.find(t => t.id === item.terminationTypeId);
                const termName = item.terminationTypeName || (matchedTermType ? matchedTermType.name : null);

                executionResults.push({
                    employeeId: item.employeeId,
                    employeeName: fullName,
                    success: false,
                    message: err.message || 'Deactivation API call failed',
                    date: item.deactivationDate || null,
                    reason: item.reason || null,
                    keepShifts: item.keepShifts,
                    terminationTypeId: item.terminationTypeId || null,
                    terminationTypeName: termName,
                });
            }

            // Brief pacing delay between items to be gentle on API
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        setResults(executionResults);

        // Update items state with execution results while keeping all user configurations in memory
        setDeactivationItems(prevItems => {
            return prevItems.map(item => {
                const res = executionResults.find(r => r.employeeId === item.employeeId);
                if (!res) return item;
                if (res.success) {
                    return {
                        ...item,
                        status: 'success',
                        resultMessage: res.message,
                        selected: false, // Deselect deactivated employees
                    };
                } else {
                    return {
                        ...item,
                        status: 'error',
                        resultMessage: res.message,
                        selected: true, // Keep failed employees selected for instant review & retry
                    };
                }
            });
        });

        setCurrentStepIndex(5); // Move to Results step
    };

    const handleAbort = () => {
        abortRef.current = true;
    };

    const handleRestartAfterResults = () => {
        // Reset selections and return to selection method
        setDeactivationItems(prev => prev.map(item => ({
            ...item,
            selected: false,
            deactivationDate: '',
            reason: '',
            keepShifts: false,
        })));
        setCurrentStepIndex(1);
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col font-sans text-gray-800">
            {/* Live Version Notification */}
            <VersionChecker />

            {/* Deactivation Process Guide Modal */}
            <ProcessGuideModal 
                isOpen={isGuideOpen} 
                onClose={() => setIsGuideOpen(false)} 
            />

            {/* Top Navigation / App Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-2xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                            P
                        </div>
                        <div>
                            <span className="font-bold text-base text-gray-900 leading-none block">
                                Planday Bulk Deactivator
                            </span>
                            <span className="text-[11px] text-gray-500 block mt-0.5">
                                Open API Operations • Employee HR
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {portalInfo && (
                            <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-xs">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-gray-600">Portal:</span>
                                <strong className="text-gray-900">{portalInfo.portalName || portalInfo.name || 'Connected'}</strong>
                            </div>
                        )}

                        {credentials && (
                            <button
                                type="button"
                                onClick={handleDisconnect}
                                className="text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                            >
                                Disconnect
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Application Canvas */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Page Title & Guide Trigger */}
                <PageHeader onOpenGuide={() => setIsGuideOpen(true)} />

                {/* Stepper Navigation */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
                    <Stepper
                        current={currentStepIndex}
                        steps={STEP_CONFIG}
                        onStepClick={(index) => {
                            // Only allow navigating backwards or between configured steps when authenticated
                            if (credentials && index < currentStepIndex && currentStepIndex !== 4) {
                                setCurrentStepIndex(index);
                            }
                        }}
                    />
                </div>

                {/* Error Banner */}
                {errorMessage && (
                    <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-2xl flex items-start justify-between gap-3 text-xs sm:text-sm animate-in fade-in">
                        <div className="flex gap-2">
                            <span className="text-red-500 text-base">⚠️</span>
                            <div>
                                <strong className="font-semibold block mb-0.5">Attention</strong>
                                <span>{errorMessage}</span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setErrorMessage(null)}
                            className="text-red-400 hover:text-red-600 font-bold px-2 py-0.5 rounded"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Active Step Content */}
                <div>
                    {/* Step 0: Auth */}
                    {currentStepIndex === 0 && (
                        <AuthStep
                            onSuccess={handleConnect}
                            isLoading={isLoading}
                        />
                    )}

                    {/* Step 1: Method Selector */}
                    {currentStepIndex === 1 && (
                        <MethodSelector
                            method={method}
                            setMethod={setMethod}
                            onContinue={() => setCurrentStepIndex(2)}
                            onBack={() => setCurrentStepIndex(0)}
                            totalEmployeesCount={deactivationItems.length}
                        />
                    )}

                    {/* Step 2: Selection / Upload */}
                    {currentStepIndex === 2 && (
                        <>
                            {method === 'editor' ? (
                                <TableEditorStep
                                    items={deactivationItems}
                                    departments={departments}
                                    employeeGroups={employeeGroups}
                                    employeeTypes={employeeTypes}
                                    terminationTypes={terminationTypes}
                                    onUpdateItem={handleUpdateItem}
                                    onBulkUpdate={handleBulkUpdate}
                                    onBack={() => setCurrentStepIndex(1)}
                                    onNext={() => setCurrentStepIndex(3)}
                                />
                            ) : (
                                <ExcelUploadStep
                                    items={deactivationItems}
                                    departments={departments}
                                    employeeGroups={employeeGroups}
                                    employeeTypes={employeeTypes}
                                    terminationTypes={terminationTypes}
                                    onLoadedItems={setDeactivationItems}
                                    onBack={() => setCurrentStepIndex(1)}
                                    onNext={() => setCurrentStepIndex(3)}
                                />
                            )}
                        </>
                    )}

                    {/* Step 3: Review */}
                    {currentStepIndex === 3 && (
                        <ReviewStep
                            items={deactivationItems}
                            departments={departments}
                            employeeGroups={employeeGroups}
                            employeeTypes={employeeTypes}
                            terminationTypes={terminationTypes}
                            method={method}
                            onUpdateItem={handleUpdateItem}
                            onBulkUpdate={handleBulkUpdate}
                            onToggleSelect={(id, sel) => handleUpdateItem(id, { selected: sel })}
                            onAssignDefaultTerminationType={(typeId, typeName) => {
                                const selectedWithoutType = deactivationItems
                                    .filter(i => i.selected && !i.terminationTypeId)
                                    .map(i => i.employeeId);
                                handleBulkUpdate(selectedWithoutType, { 
                                    terminationTypeId: typeId, 
                                    terminationTypeName: typeName 
                                });
                            }}
                            onBack={() => setCurrentStepIndex(2)}
                            onConfirmStart={handleStartDeactivation}
                        />
                    )}

                    {/* Step 4: Processing */}
                    {currentStepIndex === 4 && (
                        <ProcessingStep
                            current={processingProgress.current}
                            total={processingProgress.total}
                            currentEmployeeName={processingProgress.currentEmployeeName}
                            currentEmployeeId={processingProgress.currentEmployeeId}
                            successCount={processingProgress.successCount}
                            failureCount={processingProgress.failureCount}
                            onAbort={handleAbort}
                        />
                    )}

                    {/* Step 5: Results */}
                    {currentStepIndex === 5 && (
                        <ResultsStep
                            results={results}
                            onBack1Step={() => setCurrentStepIndex(3)}
                            onBackToEditor={() => setCurrentStepIndex(method === 'excel' ? 3 : 2)}
                            onFixErrors={() => {
                                // Filter selection to only failed items so the user can easily review, fix, and retry
                                const failedIds = new Set(results.filter(r => !r.success).map(r => r.employeeId));
                                setDeactivationItems(prev => prev.map(item => ({
                                    ...item,
                                    selected: failedIds.has(item.employeeId),
                                })));
                                setCurrentStepIndex(method === 'excel' ? 3 : 2);
                            }}
                            onRestart={handleRestartAfterResults}
                        />
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="mt-auto border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-500">
                <p>
                    Planday Bulk Deactivator • Built for HR and Operations Managers • Uses Planday Open API
                </p>
            </footer>
        </div>
    );
};

export default App;
