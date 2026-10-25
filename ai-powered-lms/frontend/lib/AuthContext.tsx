"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, UserRole } from "./types";
import {
  setAuthToken,
  clearAuthToken,
} from "./auth";
import { apiRequest, refreshAccessToken } from "./api";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const authEpoch = useRef(0);

  useEffect(() => {
    let timer: number | undefined;
    let cancelled = false;
    const requestEpoch = authEpoch.current;
    refreshAccessToken().then((session) => {
      if (cancelled || authEpoch.current !== requestEpoch) return;
      timer = window.setTimeout(() => {
        if (session) {
          setToken(session.token);
          setUser(session.user);
          setStatus("authenticated");
        } else {
          setStatus("unauthenticated");
        }
      }, 0);
    });
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const login = (newToken: string, newUser: User) => {
    authEpoch.current += 1;
    setAuthToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus("authenticated");
  };

  const logout = async () => {
    authEpoch.current += 1;
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {
      // Clear the local access token even if the network is unavailable.
    }
    clearAuthToken();
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    router.push("/login");
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updatedFields };
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user ? user.role : null,
        token,
        status,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
