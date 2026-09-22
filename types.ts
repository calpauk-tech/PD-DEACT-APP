export interface PlandayApiCredentials {
  clientId: string;
  refreshToken: string;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  departmentIds?: number[];
  employeeGroupIds?: number[];
  departments?: number[];
  employeeGroups?: number[];
  departmentNames?: string[];
  employeeGroupNames?: string[];
  salaryIdentifier?: string | null;
  employeeTypeId?: number;
  primaryDepartmentId?: number;
}

export interface IdName {
  id: number;
  name: string;
}

export interface Department extends IdName {}
export interface EmployeeGroup extends IdName {}
export interface EmployeeType extends IdName {}

export interface TerminationType {
  id: number;
  name: string;
  isActive?: boolean;
}

export interface DeactivationItem {
  employeeId: number;
  salaryIdentifier?: string | null;
  firstName: string;
  lastName: string;
  departmentNames?: string[];
  employeeGroupNames?: string[];
  departmentIds?: number[];
  employeeGroupIds?: number[];
  primaryDepartmentId?: number;
  employeeTypeId?: number;
  selected: boolean;
  deactivationDate: string; // '' for immediate, or 'YYYY-MM-DD'
  reason: string;
  keepShifts: boolean;
  terminationTypeId?: number | null;
  terminationTypeName?: string | null;
  status?: 'pending' | 'processing' | 'success' | 'error' | 'aborted';
  resultMessage?: string;
}

export interface DeactivationPayload {
  date: string | null; // YYYY-MM-DD or null
  reason: string | null;
  keepShifts: boolean;
  terminationTypeId?: number | null;
}

export interface DeactivationResult {
  employeeId: number;
  employeeName: string;
  success: boolean;
  message: string;
  date: string | null;
  reason: string | null;
  keepShifts: boolean;
  terminationTypeId?: number | null;
  terminationTypeName?: string | null;
}

export type AppStep = 'auth' | 'configure' | 'select' | 'upload' | 'review' | 'processing' | 'results';
export type DeactivationMethod = 'editor' | 'excel';
