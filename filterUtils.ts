import { DeactivationItem } from './types';

export interface FilterOptionsState {
    searchQuery?: string;
    filterDepartment: number[];
    filterPrimaryDepartment: boolean;
    filterGroup: number[];
    filterType?: number[];
    showOnlyChecked?: boolean;
    showOnlyErrors?: boolean;
}

/**
 * Evaluates deactivation items against Department, Group, Type, and text search filters
 * implementing the All vs. None ([-1]) vs. Subset ID filter model.
 */
export function filterDeactivationItems(
    items: DeactivationItem[],
    options: FilterOptionsState
): DeactivationItem[] {
    const {
        searchQuery = '',
        filterDepartment = [],
        filterPrimaryDepartment = false,
        filterGroup = [],
        filterType = [],
        showOnlyChecked = false,
        showOnlyErrors = false,
    } = options;

    return items.filter(emp => {
        // Quick filter checkboxes
        if (showOnlyChecked && !emp.selected) return false;
        if (showOnlyErrors && emp.status !== 'error') return false;

        // Search text matching (name, ID, department name, group name)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            const idStr = String(emp.employeeId);
            const salaryStr = String(emp.salaryIdentifier || '').toLowerCase();
            const deptStr = (emp.departmentNames || []).join(' ').toLowerCase();
            const grpStr = (emp.employeeGroupNames || []).join(' ').toLowerCase();
            if (!fullName.includes(query) && !idStr.includes(query) && !salaryStr.includes(query) && !deptStr.includes(query) && !grpStr.includes(query)) {
                return false;
            }
        }

        // 1. Department Filter
        if (filterPrimaryDepartment) {
            // Strict primary department match
            const primDept = emp.primaryDepartmentId;
            if (filterDepartment.length === 1 && filterDepartment[0] === -1) {
                return false; // Deselected all
            }
            if (filterDepartment.length > 0) {
                if (!primDept || !filterDepartment.includes(primDept)) {
                    return false;
                }
            }
        } else {
            // Multi-membership check (any matching department)
            if (filterDepartment.length === 1 && filterDepartment[0] === -1) {
                return false; // Deselected all
            }
            if (filterDepartment.length > 0) {
                const deps = emp.departmentIds || [];
                if (!filterDepartment.some(d => deps.includes(d))) {
                    return false;
                }
            }
        }

        // 2. Employee Group Filter (multi-membership check)
        if (filterGroup.length === 1 && filterGroup[0] === -1) {
            return false; // Deselected all
        }
        if (filterGroup.length > 0) {
            const groups = emp.employeeGroupIds || [];
            if (!filterGroup.some(g => groups.includes(g))) {
                return false;
            }
        }

        // 3. Employee Type Filter (single ID match)
        if (filterType && filterType.length > 0) {
            if (filterType.length === 1 && filterType[0] === -1) {
                return false; // Deselected all
            }
            if (!filterType.includes(emp.employeeTypeId ?? -1)) {
                return false;
            }
        }

        return true;
    });
}
