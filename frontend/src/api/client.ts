import type { ErrorResponse } from '../types/api';

const API_BASE_URL = '/api';

/** Token getter function type */
type TokenGetter = () => Promise<string | null>;

/** Stored token getter */
let tokenGetter: TokenGetter | null = null;

/**
 * Set the token getter function.
 * This should be called once during app initialization with the Clerk getToken function.
 */
export function setTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

/**
 * Clear the token getter (e.g., on sign out).
 */
export function clearTokenGetter(): void {
  tokenGetter = null;
}

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

/** Extract a user-facing error message from a caught exception. */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.data?.detail || err.message;
  }
  return fallback;
}

/** HTTP method types */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Request options */
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip authentication headers */
  skipAuth?: boolean;
}

/**
 * Make an API request with automatic JSON handling and authentication.
 *
 * Authentication priority:
 * 1. Bearer token from Clerk (if tokenGetter is set and returns a token)
 * 2. API key from VITE_API_KEY environment variable
 * 3. No authentication (will likely fail for protected endpoints)
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, headers = {}, signal, skipAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (!skipAuth) {
    // Try to get Bearer token from Clerk
    if (tokenGetter) {
      try {
        const token = await tokenGetter();
        if (token) {
          requestHeaders['Authorization'] = `Bearer ${token}`;
        }
      } catch (error) {
        // Log detailed error for debugging token acquisition issues
        console.error('Failed to acquire auth token:', {
          error,
          endpoint,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        // Continue without token - request may fail with 401, but that's more
        // informative than blocking the request entirely
      }
    }

    // Always include API key when available — in hybrid auth mode the backend
    // tries JWT first and falls back to the API key, so sending both ensures
    // requests succeed even when the JWT is expired or invalid.
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey) {
      requestHeaders['X-API-Key'] = apiKey;
    }
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
      // Response may not be JSON (e.g., HTML error page from proxy)
      const contentType = response.headers.get('content-type');
      console.warn('Could not parse error response as JSON:', {
        status: response.status,
        statusText: response.statusText,
        contentType,
        endpoint,
      });
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

/**
 * PATCH request helper
 */
export function patch<T>(
  endpoint: string,
  body?: unknown,
  signal?: AbortSignal
): Promise<T> {
  return apiRequest<T>(endpoint, { method: 'PATCH', body, signal });
}
