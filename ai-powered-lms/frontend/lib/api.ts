import { getAuthToken } from "./auth";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export async function checkBackendHealth(): Promise<{
  success: boolean;
  message: string;
  stats?: any;
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
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to reach backend server",
    };
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<{ success: boolean; message?: string; data: T }> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options?.headers as Record<string, string>) || {}),
  };

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    data = { success: response.ok, message: response.statusText };
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export default apiRequest;
