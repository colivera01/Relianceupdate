import { mockEmployees } from '@/mocks/fixtures/employees';
import {
  IEmployeesRepository,
  Employee,
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  EmployeesResponse,
  EmployeeResponse,
  MessageResponse
} from '../employeesRepo';

export class MockEmployeesRepository implements IEmployeesRepository {
  private employees = [...mockEmployees];

  async listEmployees(): Promise<EmployeesResponse> {
    // Simulate async delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      data: this.employees,
      pagination: {
        page: 1,
        limit: 10,
        total: this.employees.length,
        totalPages: 1
      }
    };
  }

  async getEmployee(id: string): Promise<EmployeeResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const employee = this.employees.find(emp => emp.id === id);
    if (!employee) {
      throw new Error('Employee not found');
    }
    
    return {
      success: true,
      data: employee
    };
  }

  async createEmployee(data: CreateEmployeeDTO): Promise<EmployeeResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newEmployee: Employee = {
      ...data,
      id: Date.now().toString(),
      status: 'active',
      hireDate: new Date().toISOString().split('T')[0],
      performance: {
        rating: 0,
        completedJobs: 0,
        customerSatisfaction: 0
      }
    };
    
    this.employees.push(newEmployee);
    
    return {
      success: true,
      data: newEmployee
    };
  }

  async updateEmployee(id: string, data: UpdateEmployeeDTO): Promise<EmployeeResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const index = this.employees.findIndex(emp => emp.id === id);
    if (index === -1) {
      throw new Error('Employee not found');
    }
    
    this.employees[index] = { ...this.employees[index], ...data };
    
    return {
      success: true,
      data: this.employees[index]
    };
  }

  async deleteEmployee(id: string): Promise<MessageResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const index = this.employees.findIndex(emp => emp.id === id);
    if (index === -1) {
      throw new Error('Employee not found');
    }
    
    this.employees.splice(index, 1);
    
    return {
      success: true,
      message: 'Employee deleted successfully'
    };
  }
}


