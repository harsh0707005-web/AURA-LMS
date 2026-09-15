import { Request } from "express";
import { Role } from "../generated/prisma/enums.js";

export { Role };

export interface AuthPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role?: Role;
  department?: string;
  enrollmentNo?: string;
  employeeId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  department?: string;
  enrollmentNo?: string;
  employeeId?: string;
  avatarUrl?: string;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string | null;
  enrollmentNo: string | null;
  employeeId: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
