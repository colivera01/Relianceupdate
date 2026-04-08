import { api } from '@/lib/api';
import {
  IEmployeesRepository,
  Employee,
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  EmployeesResponse,
  EmployeeResponse,
  MessageResponse
} from '../employeesRepo';

export class HttpEmployeesRepository implements IEmployeesRepository {
  async listEmployees(): Promise<EmployeesResponse> {
    const response = await api.get<EmployeesResponse>('/api/employees');
    return response;
  }

  async getEmployee(id: string): Promise<EmployeeResponse> {
    const response = await api.get<EmployeeResponse>(`/api/employees/${id}`);
    return response;
  }

  async createEmployee(data: CreateEmployeeDTO): Promise<EmployeeResponse> {
    const response = await api.post<EmployeeResponse>('/api/employees', data);
    return response;
  }

  async updateEmployee(id: string, data: UpdateEmployeeDTO): Promise<EmployeeResponse> {
    const response = await api.put<EmployeeResponse>(`/api/employees/${id}`, data);
    return response;
  }

  async deleteEmployee(id: string): Promise<MessageResponse> {
    const response = await api.delete<MessageResponse>(`/api/employees/${id}`);
    return response;
  }
}


