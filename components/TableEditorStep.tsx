import React, { useState, useMemo } from 'react';
import { DeactivationItem, Department, EmployeeGroup, EmployeeType, TerminationType } from '../types';
import { formatDisplayDate } from '../dateUtils';
import { MultiSelectMenu } from './MultiSelectMenu';
import { filterDeactivationItems } from '../filterUtils';

interface TableEditorStepProps {
    items: DeactivationItem[];
    departments: Department[];
    employeeGroups: EmployeeGroup[];
    employeeTypes?: EmployeeType[];
    terminationTypes: TerminationType[];
    onUpdateItem: (employeeId: number, changes: Partial<DeactivationItem>) => void;
    onBulkUpdate: (employeeIds: number[], changes: Partial<DeactivationItem>) => void;
    onBack: () => void;
    onNext: () => void;
}

export const TableEditorStep: React.FC<TableEditorStepProps> = ({
    items,
    departments,
    employeeGroups,
    employeeTypes = [],
    terminationTypes,
    onUpdateItem,
    onBulkUpdate,
    onBack,
    onNext
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDepartment, setFilterDepartment] = useState<number[]>([]);
    const [filterPrimaryDepartment, setFilterPrimaryDepartment] = useState<boolean>(false);
    const [filterGroup, setFilterGroup] = useState<number[]>([]);
    const [filterType, setFilterType] = useState<number[]>([]);
    const [showOnlyChecked, setShowOnlyChecked] = useState(false);
    const [showOnlyErrors, setShowOnlyErrors] = useState(false);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const failedItemsCount = useMemo(() => {
        return items.filter(i => i.status === 'error').length;
    }, [items]);

    // Count missing required fields for selected items
    const missingTermTypeCount = useMemo(() => {
        return terminationTypes.length > 0 
            ? items.filter(i => i.selected && !i.terminationTypeId).length 
            : 0;
    }, [items, terminationTypes]);

    // Bulk actions state
    const [bulkDate, setBulkDate] = useState<string>('');
    const [bulkReason, setBulkReason] = useState<string>('');
    const [bulkTerminationType, setBulkTerminationType] = useState<string>('');
    const [showBulkMenu, setShowBulkMenu] = useState(false);

    // Filter items using the All ([]) vs None ([-1]) vs Subset ID model
    const filteredItems = useMemo(() => {
        return filterDeactivationItems(items, {
            searchQuery,
            filterDepartment,
            filterPrimaryDepartment,
            filterGroup,
            filterType,
            showOnlyChecked,
            showOnlyErrors
        });
    }, [items, searchQuery, filterDepartment, filterPrimaryDepartment, filterGroup, filterType, showOnlyChecked, showOnlyErrors]);

    const hasActiveFilters = Boolean(
        searchQuery.trim() ||
        filterDepartment.length > 0 ||
        filterPrimaryDepartment ||
        filterGroup.length > 0 ||
        filterType.length > 0 ||
        showOnlyChecked ||
        showOnlyErrors
    );

    const handleResetFilters = () => {
        setSearchQuery('');
        setFilterDepartment([]);
        setFilterPrimaryDepartment(false);
        setFilterGroup([]);
        setFilterType([]);
        setShowOnlyChecked(false);
        setShowOnlyErrors(false);
    };

    const selectedCount = useMemo(() => {
        return items.filter(i => i.selected).length;
    }, [items]);

    const visibleSelectedCount = useMemo(() => {
        return filteredItems.filter(i => i.selected).length;
    }, [filteredItems]);

    // Bulk handlers
    const handleSelectAllVisible = (checked: boolean) => {
        const ids = filteredItems.map(i => i.employeeId);
        onBulkUpdate(ids, { selected: checked });
    };

    const handleApplyBulkDate = (dateVal: string) => {
        const selectedIds = items.filter(i => i.selected).map(i => i.employeeId);
        if (selectedIds.length === 0) return;
        onBulkUpdate(selectedIds, { deactivationDate: dateVal || todayStr });
    };

    const handleApplyBulkKeepShifts = (keep: boolean) => {
        const selectedIds = items.filter(i => i.selected).map(i => i.employeeId);
        if (selectedIds.length === 0) return;
        onBulkUpdate(selectedIds, { keepShifts: keep });
    };

    const handleApplyBulkReason = () => {
        const selectedIds = items.filter(i => i.selected).map(i => i.employeeId);
        if (selectedIds.length === 0) return;
        onBulkUpdate(selectedIds, { reason: bulkReason });
        setBulkReason('');
    };

    const handleApplyBulkTerminationType = () => {
        if (!bulkTerminationType) return;
        const selectedIds = items.filter(i => i.selected).map(i => i.employeeId);
        if (selectedIds.length === 0) return;
        const typeId = Number(bulkTerminationType);
        const typeObj = terminationTypes.find(t => t.id === typeId);
        onBulkUpdate(selectedIds, {
            terminationTypeId: typeId,
            terminationTypeName: typeObj?.name || null
        });
    };

    const handleAutoAssignMissingTypes = () => {
        if (terminationTypes.length === 0) return;
        const defaultType = terminationTypes[0];
        const missingIds = items
            .filter(i => i.selected && !i.terminationTypeId)
            .map(i => i.employeeId);
        if (missingIds.length === 0) return;
        onBulkUpdate(missingIds, {
            terminationTypeId: defaultType.id,
            terminationTypeName: defaultType.name
        });
    };

    return (
        <div className="space-y-6">
            {/* Termination Types Notice Banner if active in portal */}
            {terminationTypes.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                        <span className="text-base">📋</span>
                        <div>
                            <span className="font-semibold text-blue-950">Portal Termination Types Active: </span>
                            <span className="text-blue-800">
                                This portal requires a termination type. Available options: <strong>{terminationTypes.map(t => t.name).join(', ')}</strong>.
                            </span>
                        </div>
                    </div>
                    <span className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-[11px] shrink-0">
                        {terminationTypes.length} Types
                    </span>
                </div>
            )}

            {/* Previous Error Notice & Quick Recovery Banner */}
            {failedItemsCount > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                        <span className="text-xl">⚠️</span>
                        <div>
                            <h4 className="text-sm font-bold text-red-900">
                                {failedItemsCount} employee{failedItemsCount > 1 ? 's' : ''} had deactivation errors in the previous attempt
                            </h4>
                            <p className="text-xs text-red-800 mt-0.5">
                                All your configured fields have been preserved. Inspect the error messages below, make changes (e.g. select a Termination Type or adjust date), and click Review & Confirm to retry.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setShowOnlyErrors(prev => !prev);
                            if (!showOnlyErrors) setShowOnlyChecked(false);
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-colors ${
                            showOnlyErrors ? 'bg-red-700 text-white' : 'bg-white border border-red-300 text-red-900 hover:bg-red-100'
                        }`}
                    >
                        {showOnlyErrors ? 'Show All Employees' : `Filter to Errors Only (${failedItemsCount})`}
                    </button>
                </div>
            )}

            {/* Top Toolbar / Filters */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                    {/* Search & Filters */}
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                        {/* Search input */}
                        <div className="relative min-w-[220px] flex-1">
                            <input
                                type="text"
                                placeholder="Search by name, ID, department..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                            />
                            <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>

                        {/* Department filter (with Primary Department toggle) */}
                        <MultiSelectMenu
                            label="Department"
                            options={departments}
                            selectedIds={filterDepartment}
                            onChange={setFilterDepartment}
                            toggleOptionLabel="Primary Dept Only"
                            toggleOptionEnabled={filterPrimaryDepartment}
                            onToggleOption={setFilterPrimaryDepartment}
                            toggleTooltipText="When enabled, only matches the employee's designated Primary Department"
                        />

                        {/* Employee Group filter */}
                        <MultiSelectMenu
                            label="Employee Group"
                            options={employeeGroups}
                            selectedIds={filterGroup}
                            onChange={setFilterGroup}
                        />

                        {/* Employee Type filter (if available) */}
                        {employeeTypes.length > 0 && (
                            <MultiSelectMenu
                                label="Employee Type"
                                options={employeeTypes}
                                selectedIds={filterType}
                                onChange={setFilterType}
                            />
                        )}

                        {/* Show only checked toggle */}
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm text-gray-600 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl hover:bg-gray-100">
                            <input
                                type="checkbox"
                                checked={showOnlyChecked}
                                onChange={e => {
                                    setShowOnlyChecked(e.target.checked);
                                    if (e.target.checked) setShowOnlyErrors(false);
                                }}
                                className="w-4 h-4 text-blue-600 rounded"
                            />
                            <span>Only Checked ({selectedCount})</span>
                        </label>

                        {/* Show only errors toggle if errors exist */}
                        {failedItemsCount > 0 && (
                            <label className={`flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm px-3 py-2 border rounded-xl transition-colors ${
                                showOnlyErrors ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                            }`}>
                                <input
                                    type="checkbox"
                                    checked={showOnlyErrors}
                                    onChange={e => {
                                        setShowOnlyErrors(e.target.checked);
                                        if (e.target.checked) setShowOnlyChecked(false);
                                    }}
                                    className="w-4 h-4 text-red-600 rounded"
                                />
                                <span>⚠️ Errors ({failedItemsCount})</span>
                            </label>
                        )}

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline px-2 py-1.5 cursor-pointer ml-auto sm:ml-0"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>

                    {/* Quick selection status */}
                    <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-gray-500">
                            Showing <strong>{filteredItems.length}</strong> of {items.length}
                        </span>
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
                            {selectedCount} selected for deactivation
                        </span>
                    </div>
                </div>

                {/* Bulk Actions Panel */}
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500 font-medium">Bulk Selection:</span>
                        <button
                            type="button"
                            onClick={() => handleSelectAllVisible(true)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-semibold"
                        >
                            Select Visible ({filteredItems.length})
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            type="button"
                            onClick={() => handleSelectAllVisible(false)}
                            className="text-gray-600 hover:text-gray-800 hover:underline"
                        >
                            Deselect Visible
                        </button>
                        {selectedCount > 0 && (
                            <>
                                <span className="text-gray-300">|</span>
                                <button
                                    type="button"
                                    onClick={() => onBulkUpdate(items.map(i => i.employeeId), { selected: false })}
                                    className="text-red-600 hover:text-red-800 hover:underline"
                                >
                                    Clear All ({selectedCount})
                                </button>
                            </>
                        )}
                    </div>

                    {/* Bulk setters for checked items */}
                    {selectedCount > 0 && (
                        <div className="flex flex-wrap items-center gap-2 bg-blue-50/70 p-2 rounded-xl border border-blue-200">
                            <span className="font-semibold text-blue-900">For {selectedCount} Selected:</span>

                            {/* Set Immediate */}
                            <button
                                type="button"
                                onClick={() => handleApplyBulkDate(todayStr)}
                                className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 px-2.5 py-1 rounded-lg font-medium shadow-2xs cursor-pointer"
                                title="Set today's date for immediate deactivation"
                            >
                                Set Immediate (Today)
                            </button>

                            {/* Set Specific Date */}
                            <div className="flex items-center gap-1">
                                <input
                                    type="date"
                                    value={bulkDate}
                                    onChange={e => setBulkDate(e.target.value)}
                                    className="bg-white border border-gray-300 px-2 py-0.5 rounded-lg text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => bulkDate && handleApplyBulkDate(bulkDate)}
                                    disabled={!bulkDate}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg font-medium cursor-pointer"
                                >
                                    Apply Date
                                </button>
                            </div>

                            {/* Keep shifts toggles */}
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleApplyBulkKeepShifts(false)}
                                    className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 px-2 py-1 rounded-lg font-medium"
                                    title="Unassign employee from shifts past deactivation date"
                                >
                                    Keep Shifts: False
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyBulkKeepShifts(true)}
                                    className="bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 px-2 py-1 rounded-lg font-medium"
                                    title="Retain shifts assigned to employee"
                                >
                                    Keep Shifts: True
                                </button>
                            </div>

                            {/* Bulk reason input */}
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    placeholder="Bulk reason..."
                                    value={bulkReason}
                                    onChange={e => setBulkReason(e.target.value)}
                                    className="bg-white border border-gray-300 px-2 py-0.5 rounded-lg text-xs w-28"
                                />
                                <button
                                    type="button"
                                    onClick={handleApplyBulkReason}
                                    disabled={!bulkReason.trim()}
                                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg font-medium cursor-pointer"
                                >
                                    Set Reason
                                </button>
                            </div>

                            {/* Bulk termination type input */}
                            {terminationTypes.length > 0 && (
                                <div className="flex items-center gap-1">
                                    <select
                                        value={bulkTerminationType}
                                        onChange={e => setBulkTerminationType(e.target.value)}
                                        className="bg-white border border-gray-300 px-2 py-1 rounded-lg text-xs"
                                    >
                                        <option value="">Bulk Term. Type...</option>
                                        {terminationTypes.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleApplyBulkTerminationType}
                                        disabled={!bulkTerminationType}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg font-medium cursor-pointer"
                                    >
                                        Set Type
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Warning if selected employees are missing required Termination Type */}
                    {missingTermTypeCount > 0 && (
                        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900">
                            <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs shrink-0">!</span>
                                <div className="text-xs">
                                    <span className="font-bold">Required field missing: </span>
                                    <span><strong>{missingTermTypeCount}</strong> marked employee{missingTermTypeCount > 1 ? 's require' : ' requires'} a Termination Type before deactivation.</span>
                                </div>
                            </div>
                            {terminationTypes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleAutoAssignMissingTypes}
                                    className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg shadow-xs cursor-pointer shrink-0 transition-colors"
                                >
                                    Set to "{terminationTypes[0].name}" for all {missingTermTypeCount}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Table of Employees */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-10 border-b border-gray-200">
                            <tr>
                                <th className="p-3 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredItems.length > 0 && visibleSelectedCount === filteredItems.length}
                                        onChange={e => handleSelectAllVisible(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                        title="Select/Deselect All Visible"
                                    />
                                </th>
                                <th className="p-3 w-24">ID</th>
                                <th className="p-3">Employee Name</th>
                                <th className="p-3 min-w-[200px]">
                                    Deactivation Date
                                    <span className="block text-[11px] font-normal text-gray-500">
                                        Defaults to Today
                                    </span>
                                </th>
                                <th className="p-3 min-w-[180px]">
                                    Reason
                                    <span className="block text-[11px] font-normal text-gray-500">
                                        Optional note
                                    </span>
                                </th>
                                <th className="p-3 min-w-[190px]">
                                    <div className="flex items-center gap-1.5">
                                        <span>Termination Type</span>
                                        {terminationTypes.length > 0 && (
                                            <span className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-300 px-1.5 py-0.2 rounded">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <span className="block text-[11px] font-normal text-gray-500">
                                        {terminationTypes.length > 0 ? "Mandatory for deactivation" : "Optional"}
                                    </span>
                                </th>
                                <th className="p-3 w-40">
                                    Keep Shifts?
                                    <span className="block text-[11px] font-normal text-gray-500">
                                        Default: False (Unassign)
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-400 italic">
                                        {items.length === 0 ? "No active employees loaded." : "No employees match your search/filter criteria."}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => {
                                    const effectiveDate = item.deactivationDate || todayStr;
                                    const isTypeMissing = item.selected && terminationTypes.length > 0 && !item.terminationTypeId;

                                    return (
                                        <tr 
                                            key={item.employeeId} 
                                            className={`transition-colors hover:bg-blue-50/30 ${
                                                item.selected ? (isTypeMissing ? 'bg-red-50/30 font-medium' : 'bg-blue-50/50 font-medium') : ''
                                            }`}
                                        >
                                            {/* Checkbox */}
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={item.selected}
                                                    onChange={e => onUpdateItem(item.employeeId, { selected: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                                />
                                            </td>

                                            {/* ID */}
                                            <td className="p-3 font-mono text-gray-500 text-xs">
                                                <div>{item.employeeId}</div>
                                                {item.salaryIdentifier && (
                                                    <div className="text-[10px] text-gray-400 font-sans tracking-tight" title="Salary Identifier (Payroll ID)">
                                                        PID: <span className="font-mono text-gray-600 font-medium">{item.salaryIdentifier}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Name & Error badge if applicable */}
                                            <td className="p-3 text-gray-900 font-semibold">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span>{item.firstName} {item.lastName}</span>
                                                    {isTypeMissing && (
                                                        <span className="inline-flex items-center text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-1.5 py-0.5 rounded">
                                                            ⚠️ Type Required
                                                        </span>
                                                    )}
                                                </div>
                                                {item.status === 'error' && (
                                                    <div className="mt-1 flex items-start gap-1 text-[11px] text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md font-normal leading-tight">
                                                        <span className="shrink-0 font-bold">⚠️ Error:</span>
                                                        <span className="font-mono text-[10px] break-all">{item.resultMessage || 'Failed'}</span>
                                                    </div>
                                                )}
                                                {item.status === 'success' && (
                                                    <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-normal">
                                                        <span>✓ Deactivated</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Deactivation Date */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5">
                                                    <input
                                                        type="date"
                                                        value={effectiveDate}
                                                        onChange={e => onUpdateItem(item.employeeId, { 
                                                            deactivationDate: e.target.value || todayStr,
                                                            selected: true // Auto-check row if date is entered
                                                        })}
                                                        className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white font-medium text-gray-800"
                                                    />
                                                    {effectiveDate !== todayStr && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onUpdateItem(item.employeeId, { deactivationDate: todayStr })}
                                                            className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline shrink-0 font-medium cursor-pointer"
                                                            title="Reset date to today"
                                                        >
                                                            Set Today
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Reason */}
                                            <td className="p-3">
                                                <input
                                                    type="text"
                                                    placeholder="e.g. Resigned, End of contract..."
                                                    value={item.reason || ''}
                                                    onChange={e => onUpdateItem(item.employeeId, { 
                                                        reason: e.target.value,
                                                        selected: e.target.value ? true : item.selected // Auto-check if reason entered
                                                    })}
                                                    className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                                                />
                                            </td>

                                            {/* Termination Type */}
                                            <td className="p-3">
                                                {terminationTypes.length > 0 ? (
                                                    <div>
                                                        <select
                                                            value={item.terminationTypeId !== undefined && item.terminationTypeId !== null ? item.terminationTypeId : ''}
                                                            onChange={e => {
                                                                const val = e.target.value ? Number(e.target.value) : null;
                                                                const found = terminationTypes.find(t => t.id === val);
                                                                onUpdateItem(item.employeeId, {
                                                                    terminationTypeId: val,
                                                                    terminationTypeName: found ? found.name : null,
                                                                    selected: true
                                                                });
                                                            }}
                                                            className={`w-full px-2.5 py-1 text-xs rounded-lg focus:outline-none focus:ring-1 font-medium ${
                                                                isTypeMissing
                                                                    ? 'border-2 border-red-500 bg-red-50/80 text-red-950 font-bold focus:ring-red-500 shadow-2xs'
                                                                    : 'border border-gray-300 bg-white text-gray-800 focus:ring-blue-500'
                                                            }`}
                                                        >
                                                            <option value="">{isTypeMissing ? '⚠️ Select Type (Required)' : '-- Select Type --'}</option>
                                                            {terminationTypes.map(t => (
                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                        {isTypeMissing && (
                                                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100/90 border border-red-200 px-1.5 py-0.5 rounded">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                                                                <span>Required field</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-xs italic">N/A</span>
                                                )}
                                            </td>

                                            {/* Keep Shifts */}
                                            <td className="p-3">
                                                <select
                                                    value={item.keepShifts ? 'true' : 'false'}
                                                    onChange={e => onUpdateItem(item.employeeId, { 
                                                        keepShifts: e.target.value === 'true' 
                                                    })}
                                                    className={`w-full px-2 py-1 text-xs rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${
                                                        item.keepShifts 
                                                            ? 'bg-amber-50 text-amber-900 border-amber-300' 
                                                            : 'bg-white text-gray-700 border-gray-300'
                                                    }`}
                                                >
                                                    <option value="false">FALSE (Unassign)</option>
                                                    <option value="true">TRUE (Keep)</option>
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer info */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
                    <div>
                        Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> employees
                        {selectedCount > 0 && (
                            <span className="ml-2 font-semibold text-blue-700">
                                ({selectedCount} marked for deactivation)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        <span>Date defaults to today</span>
                    </div>
                </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-lg border border-gray-100">
                <button
                    type="button"
                    onClick={onBack}
                    className="px-5 py-2.5 border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
                >
                    &larr; Back to Method
                </button>

                <div className="flex items-center gap-4">
                    {missingTermTypeCount > 0 && (
                        <span className="text-xs font-bold text-red-700 bg-red-100/90 border border-red-300 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            ⚠️ {missingTermTypeCount} Missing Termination Type
                        </span>
                    )}

                    <span className="text-sm text-gray-600 hidden sm:inline">
                        <strong>{selectedCount}</strong> employee{selectedCount === 1 ? '' : 's'} selected
                    </span>

                    <button
                        type="button"
                        onClick={onNext}
                        disabled={selectedCount === 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center gap-2 text-sm cursor-pointer"
                    >
                        <span>Review & Confirm Deactivations ({selectedCount})</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
