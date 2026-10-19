import { getAuthToken } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface ApiErrorPayload {
  message?: string;
  [key: string]: unknown;
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
  const token = getAuthToken();
  const bodyIsFormData = options?.body instanceof FormData;
  const requestHeaders = new Headers(options?.headers);

  if (!bodyIsFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  // The browser must generate the multipart boundary for FormData.
  if (bodyIsFormData) requestHeaders.delete("Content-Type");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
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
