import { IEmployeesRepository } from './employeesRepo';
import { HttpEmployeesRepository } from './http/HttpEmployeesRepo';
import { MockEmployeesRepository } from './mock/MockEmployeesRepo';

export class RepositoryFactory {
  private static instance: RepositoryFactory;
  private employeesRepo: IEmployeesRepository | null = null;

  private constructor() {}

  static getInstance(): RepositoryFactory {
    if (!RepositoryFactory.instance) {
      RepositoryFactory.instance = new RepositoryFactory();
    }
    return RepositoryFactory.instance;
  }

  getEmployeesRepository(): IEmployeesRepository {
    if (!this.employeesRepo) {
      const apiMode = process.env.NEXT_PUBLIC_API_MODE;
      
      if (apiMode === 'mock') {
        this.employeesRepo = new MockEmployeesRepository();
      } else {
        this.employeesRepo = new HttpEmployeesRepository();
      }
    }
    
    return this.employeesRepo;
  }

  // Method to force refresh of repository instances (useful for testing)
  refreshRepositories(): void {
    this.employeesRepo = null;
  }
}

// Export singleton instance
export const repositoryFactory = RepositoryFactory.getInstance();


