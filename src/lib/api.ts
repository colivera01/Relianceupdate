// API Configuration
export const API_BASE = process.env.NEXT_PUBLIC_API_MODE === 'mock' 
  ? (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001')
  : '';

// Standalone typedFetch function
export async function typedFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    try {
      const err = await res.json();
      throw err;
    } catch {
      throw new Error(res.statusText);
    }
  }
  return (await res.json()) as T;
}

// HTTP Client with TypeScript support
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // Generic fetch method with error handling
  private async typedFetch<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    
    const config: RequestInit = {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
      ...init,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorBody.message || errorMessage;
        } catch {
          // If error body can't be parsed, use default message
        }
        
        throw new Error(errorMessage);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      
      return {} as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error occurred');
    }
  }

  // HTTP Method helpers
  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = params ? this.buildUrl(path, params) : path;
    return this.typedFetch<T>(url, { method: 'GET' });
  }

  async post<T>(path: string, body?: any): Promise<T> {
    return this.typedFetch<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(path: string, body?: any): Promise<T> {
    return this.typedFetch<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(path: string, body?: any): Promise<T> {
    return this.typedFetch<T>(path, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(path: string): Promise<T> {
    return this.typedFetch<T>(path, { method: 'DELETE' });
  }

  // Helper to build URLs with query parameters
  private buildUrl(path: string, params: Record<string, any>): string {
    const url = new URL(path, this.baseUrl);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });
    
    return url.pathname + url.search;
  }

  // Helper to add authorization header
  setAuthToken(token: string): void {
    // Store token for future requests
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token);
    }
  }

  // Helper to get authorization header
  private getAuthHeaders(): Record<string, string> {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        return { Authorization: `Bearer ${token}` };
      }
    }
    return {};
  }

  // Method to make authenticated requests
  async authenticatedRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: any,
    params?: Record<string, any>
  ): Promise<T> {
    const headers = this.getAuthHeaders();
    
    switch (method) {
      case 'GET':
        return this.get<T>(path, params);
      case 'POST':
        return this.post<T>(path, body);
      case 'PUT':
        return this.put<T>(path, body);
      case 'PATCH':
        return this.patch<T>(path, body);
      case 'DELETE':
        return this.delete<T>(path);
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE);

// Export individual methods for convenience
export const { get, post, put, patch, del: delete_ } = api;
