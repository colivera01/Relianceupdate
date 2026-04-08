import { MockEmployee } from '@/mocks/fixtures/employees';

export interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  hireDate: string;
  department: string;
  performance: {
    rating: number;
    completedJobs: number;
    customerSatisfaction: number;
  };
}

export interface CreateEmployeeDTO {
  name: string;
  role: string;
  email: string;
  phone: string;
  department: string;
}

export interface UpdateEmployeeDTO {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive';
  department?: string;
}

export interface EmployeesResponse {
  success: boolean;
  data: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EmployeeResponse {
  success: boolean;
  data: Employee;
}

export interface MessageResponse {
  success: boolean;
  message: string;
}

export interface IEmployeesRepository {
  listEmployees(): Promise<EmployeesResponse>;
  getEmployee(id: string): Promise<EmployeeResponse>;
  createEmployee(data: CreateEmployeeDTO): Promise<EmployeeResponse>;
  updateEmployee(id: string, data: UpdateEmployeeDTO): Promise<EmployeeResponse>;
  deleteEmployee(id: string): Promise<MessageResponse>;
}


