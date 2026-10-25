import { clearAuthToken, getAuthToken, setAuthToken } from "./auth";
import { User } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface ApiErrorPayload {
  message?: string;
  [key: string]: unknown;
}

interface RefreshResponse {
  token: string;
  user: User;
}

let refreshPromise: Promise<RefreshResponse | null> | null = null;

function isAuthEndpoint(url: string): boolean {
  return /\/auth\/(login|refresh|logout)$/.test(url);
}

export async function refreshAccessToken(): Promise<RefreshResponse | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        clearAuthToken();
        return null;
      }
      const payload = (await response.json()) as { data?: RefreshResponse };
      if (!payload.data?.token || !payload.data.user) {
        clearAuthToken();
        return null;
      }
      setAuthToken(payload.data.token);
      return payload.data;
    } catch {
      clearAuthToken();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function authenticatedFetch(input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const requestHeaders = new Headers(options.headers);
  const token = getAuthToken();
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const makeRequest = () => fetch(input, {
    ...options,
    credentials: "include",
    headers: requestHeaders,
  });

  let response = await makeRequest();
  if (response.status !== 401 || isAuthEndpoint(url)) return response;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return response;
  requestHeaders.set("Authorization", `Bearer ${refreshed.token}`);
  response = await makeRequest();
  return response;
}

export async function checkBackendHealth(): Promise<{
  success: boolean;
  message: string;
  stats?: Record<string, unknown>;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/health/db`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      return { success: false, message: `HTTP error: ${res.status}` };
    }
    return await res.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : undefined;
    return {
      success: false,
      message: message || "Failed to reach backend server",
    };
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; message?: string; data: T }> {
  const bodyIsFormData = options?.body instanceof FormData;
  const requestHeaders = new Headers(options?.headers);

  if (!bodyIsFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  // The browser must generate the multipart boundary for FormData.
  if (bodyIsFormData) requestHeaders.delete("Content-Type");

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await authenticatedFetch(url, {
    ...options,
    headers: requestHeaders,
  });

  let data: ApiErrorPayload & { success?: boolean; data?: T } = {};
  try {
    data = (await response.json()) as ApiErrorPayload & { success?: boolean; data?: T };
  } catch {
    data = { success: response.ok, message: response.statusText };
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data as { success: boolean; message?: string; data: T };
}

export default apiRequest;
