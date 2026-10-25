"use client";

let accessToken: string | null = null;

export function setAuthToken(token: string): void {
  accessToken = token;
}

export function getAuthToken(): string | null {
  return accessToken;
}

export function clearAuthToken(): void {
  accessToken = null;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
