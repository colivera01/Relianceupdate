import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositoryFactory } from '@/data/factory';
import type {
  Employee,
  CreateEmployeeDTO,
  UpdateEmployeeDTO,
  EmployeesResponse,
  EmployeeResponse,
  MessageResponse
} from '@/data/employeesRepo';

// Query keys
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters: string) => [...employeeKeys.lists(), { filters }] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
};

// Hooks
export const useListEmployees = () => {
  return useQuery({
    queryKey: employeeKeys.lists(),
    queryFn: async (): Promise<EmployeesResponse> => {
      const repo = repositoryFactory.getEmployeesRepository();
      return repo.listEmployees();
    },
  });
};

export const useGetEmployee = (id: string) => {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: async (): Promise<EmployeeResponse> => {
      const repo = repositoryFactory.getEmployeesRepository();
      return repo.getEmployee(id);
    },
    enabled: !!id,
  });
};

export const useCreateEmployee = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateEmployeeDTO): Promise<EmployeeResponse> => {
      const repo = repositoryFactory.getEmployeesRepository();
      return repo.createEmployee(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

export const useUpdateEmployee = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateEmployeeDTO }): Promise<EmployeeResponse> => {
      const repo = repositoryFactory.getEmployeesRepository();
      return repo.updateEmployee(id, data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};

export const useDeleteEmployee = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string): Promise<MessageResponse> => {
      const repo = repositoryFactory.getEmployeesRepository();
      return repo.deleteEmployee(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.lists() });
    },
  });
};


