import type { ErrorResponse } from '../types/api';

/** API configuration */
const API_BASE_URL = '/api';

/** API error class */
export class ApiError extends Error {
  status: number;
  statusText: string;
  data?: ErrorResponse;

  constructor(status: number, statusText: string, data?: ErrorResponse) {
    super(data?.detail || statusText);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

/** HTTP method types */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Request options */
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Make an API request with automatic JSON handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, signal } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add API key if available (for production deployment)
  const apiKey = import.meta.env.VITE_API_KEY;
  if (apiKey) {
    requestHeaders['X-API-Key'] = apiKey;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    let errorData: ErrorResponse | undefined;
    try {
      errorData = await response.json();
    } catch {
      // Response may not be JSON
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

/**
 * GET request helper
 */
export function get<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'GET', signal });
}

/**
 * POST request helper
 */
export function post<T>(
  endpoint: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'POST', body, signal });
}

/**
 * PUT request helper
 */
export function put<T>(
  endpoint: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'PUT', body, signal });
}

/**
 * DELETE request helper
 */
export function del<T>(endpoint: string, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'DELETE', signal });
}
