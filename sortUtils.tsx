import React from 'react';
import { DeactivationItem, TerminationType } from './types';

export type SortField = 
    | 'none'
    | 'name'
    | 'id'
    | 'date'
    | 'reason'
    | 'terminationType'
    | 'keepShifts'
    | 'selected'
    | 'errors'
    | 'missingTermType';

export type SortDirection = 'asc' | 'desc';

export function sortDeactivationItems(
    items: DeactivationItem[], 
    sortField: SortField, 
    sortDirection: SortDirection,
    terminationTypes: TerminationType[] = [],
    todayStr: string = new Date().toISOString().split('T')[0]
): DeactivationItem[] {
    if (sortField === 'none') return items;

    return [...items].sort((a, b) => {
        let cmp = 0;
        switch (sortField) {
            case 'errors': {
                // Required errors (status === 'error') first
                const aErr = a.status === 'error' ? 1 : 0;
                const bErr = b.status === 'error' ? 1 : 0;
                cmp = bErr - aErr;
                break;
            }
            case 'missingTermType': {
                // Termination type info error (blank termination type field) first
                const aMissing = (terminationTypes.length > 0 && !a.terminationTypeId) ? 1 : 0;
                const bMissing = (terminationTypes.length > 0 && !b.terminationTypeId) ? 1 : 0;
                cmp = bMissing - aMissing;
                break;
            }
            case 'selected': {
                const aSel = a.selected ? 1 : 0;
                const bSel = b.selected ? 1 : 0;
                cmp = bSel - aSel;
                break;
            }
            case 'id': {
                cmp = a.employeeId - b.employeeId;
                break;
            }
            case 'name': {
                const aName = `${a.lastName} ${a.firstName}`.toLowerCase();
                const bName = `${b.lastName} ${b.firstName}`.toLowerCase();
                cmp = aName.localeCompare(bName);
                break;
            }
            case 'date': {
                const aDate = a.deactivationDate || todayStr;
                const bDate = b.deactivationDate || todayStr;
                cmp = aDate.localeCompare(bDate);
                break;
            }
            case 'reason': {
                const aReason = (a.reason || '').trim().toLowerCase();
                const bReason = (b.reason || '').trim().toLowerCase();
                if (!aReason && bReason) cmp = 1;
                else if (aReason && !bReason) cmp = -1;
                else cmp = aReason.localeCompare(bReason);
                break;
            }
            case 'terminationType': {
                const aMissing = !a.terminationTypeId ? 1 : 0;
                const bMissing = !b.terminationTypeId ? 1 : 0;
                if (aMissing !== bMissing) {
                    cmp = aMissing - bMissing;
                } else {
                    const aName = (a.terminationTypeName || (terminationTypes.find(t => t.id === a.terminationTypeId)?.name) || '').toLowerCase();
                    const bName = (b.terminationTypeName || (terminationTypes.find(t => t.id === b.terminationTypeId)?.name) || '').toLowerCase();
                    cmp = aName.localeCompare(bName);
                }
                break;
            }
            case 'keepShifts': {
                const aKeep = a.keepShifts ? 1 : 0;
                const bKeep = b.keepShifts ? 1 : 0;
                cmp = bKeep - aKeep;
                break;
            }
        }

        if (cmp === 0) {
            cmp = a.employeeId - b.employeeId;
        }

        return sortDirection === 'desc' ? -cmp : cmp;
    });
}

export function getNextSort(
    currentField: SortField, 
    currentDir: SortDirection, 
    targetField: SortField
): { field: SortField; direction: SortDirection } {
    if (targetField === 'terminationType') {
        // Special 3-way cycle for terminationType:
        // 1. missingTermType (blank info error first)
        // 2. terminationType asc (A-Z)
        // 3. terminationType desc (Z-A)
        // 4. none
        if (currentField !== 'missingTermType' && currentField !== 'terminationType') {
            return { field: 'missingTermType', direction: 'asc' };
        }
        if (currentField === 'missingTermType') {
            return { field: 'terminationType', direction: 'asc' };
        }
        if (currentField === 'terminationType' && currentDir === 'asc') {
            return { field: 'terminationType', direction: 'desc' };
        }
        return { field: 'none', direction: 'asc' };
    }

    if (currentField === targetField) {
        if (currentDir === 'asc') {
            return { field: targetField, direction: 'desc' };
        }
        return { field: 'none', direction: 'asc' };
    }
    return { field: targetField, direction: 'asc' };
}

export const SortIndicator: React.FC<{ 
    field: SortField; 
    currentField: SortField; 
    direction: SortDirection;
    isSpecialMissing?: boolean;
    isSpecialError?: boolean;
}> = ({ field, currentField, direction, isSpecialMissing, isSpecialError }) => {
    if (isSpecialMissing) {
        return (
            <span 
                className="inline-flex items-center text-[10px] bg-amber-400 text-amber-950 font-bold px-1 rounded shadow-2xs"
                title="Sorted by blank/missing termination type (info error) first"
            >
                ⚠️▲
            </span>
        );
    }
    if (isSpecialError) {
        return (
            <span 
                className="inline-flex items-center text-[10px] bg-red-600 text-white font-bold px-1 rounded shadow-2xs"
                title="Sorted by required / failed errors first"
            >
                ⚠️▲
            </span>
        );
    }
    if (currentField !== field) {
        return (
            <span className="text-gray-400 opacity-30 group-hover:opacity-100 text-[11px] ml-0.5 inline-block transition-opacity">
                ⇅
            </span>
        );
    }
    return (
        <span className="text-blue-600 font-bold text-xs ml-0.5 inline-block">
            {direction === 'asc' ? '▲' : '▼'}
        </span>
    );
};
