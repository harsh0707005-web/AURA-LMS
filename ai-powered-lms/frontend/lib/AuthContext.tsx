"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "./types";
import {
  getAuthToken,
  getCurrentUser,
  setAuthSession,
  removeAuthSession,
} from "./auth";

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  token: string | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    try {
      const storedToken = getAuthToken();
      const storedUser = getCurrentUser();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
        setStatus("authenticated");
      } else {
        setStatus("unauthenticated");
      }
    } catch {
      setStatus("unauthenticated");
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    setAuthSession(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
    setStatus("authenticated");
  };

  const logout = () => {
    removeAuthSession();
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updatedFields };
    setUser(updated);
    if (token) {
      setAuthSession(token, updated);
    }
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
