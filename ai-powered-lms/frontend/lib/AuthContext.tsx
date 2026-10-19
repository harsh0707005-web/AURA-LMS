"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  useEffect(() => {
    let timer: number | undefined;
    try {
      const storedToken = getAuthToken();
      const storedUser = getCurrentUser();

      if (storedToken && storedUser) {
        timer = window.setTimeout(() => {
          setToken(storedToken);
          setUser(storedUser);
          setStatus("authenticated");
        }, 0);
      } else {
        timer = window.setTimeout(() => setStatus("unauthenticated"), 0);
      }
    } catch {
      timer = window.setTimeout(() => setStatus("unauthenticated"), 0);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
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
    router.push("/login");
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
