import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import {
  RegisterInput,
  LoginInput,
  UpdateProfileInput,
  UserResponse,
  Role,
} from "../types/auth.types.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";

const BCRYPT_SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DatabaseUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  department: string | null;
  enrollmentNo: string | null;
  employeeId: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function sanitizeUser(user: DatabaseUser): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department,
    enrollmentNo: user.enrollmentNo,
    employeeId: user.employeeId,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<UserResponse> {
  const { name, email, password, role, department, enrollmentNo, employeeId } = input;

  if (!name || name.trim().length === 0) {
    throw Object.assign(new Error("Full name is required"), { statusCode: 400 });
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    throw Object.assign(new Error("Valid institutional email address is required"), { statusCode: 400 });
  }

  if (!password || password.length < 8) {
    throw Object.assign(new Error("Password must be at least 8 characters long"), { statusCode: 400 });
  }

  // Security Rule: Disallow public registration as ADMIN
  if (role === "ADMIN") {
    throw Object.assign(
      new Error("Public registration for Administrator role is strictly prohibited. Admin accounts must be created by existing admins or system seed."),
      { statusCode: 400 }
    );
  }

  const assignedRole: Role = role === "FACULTY" ? "FACULTY" : "STUDENT";
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw Object.assign(new Error("An account with this email address already exists"), { statusCode: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: hashedPassword,
      role: assignedRole,
      department: department?.trim() || "Computer Engineering",
      enrollmentNo: assignedRole === "STUDENT" ? enrollmentNo?.trim() || null : null,
      employeeId: assignedRole === "FACULTY" ? employeeId?.trim() || null : null,
    },
  });

  return sanitizeUser(newUser);
}

export async function loginUser(
  input: LoginInput
): Promise<{ user: UserResponse; token: string }> {
  const { email, password } = input;

  if (!email || !password) {
    throw Object.assign(new Error("Institutional email and password are required"), { statusCode: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
  }

  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  // Minimal clean JWT payload
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn } as SignOptions
  );

  return {
    user: sanitizeUser(user),
    token,
  };
}

export async function getUserProfile(userId: string): Promise<UserResponse> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw Object.assign(new Error("User profile not found"), { statusCode: 404 });
  }

  return sanitizeUser(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserResponse> {
  const { name, department, enrollmentNo, employeeId, avatarUrl } = input;

  const dataToUpdate: {
    name?: string;
    department?: string;
    enrollmentNo?: string | null;
    employeeId?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (name !== undefined) dataToUpdate.name = name.trim();
  if (department !== undefined) dataToUpdate.department = department.trim();
  if (enrollmentNo !== undefined) dataToUpdate.enrollmentNo = enrollmentNo.trim();
  if (employeeId !== undefined) dataToUpdate.employeeId = employeeId.trim();
  if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl.trim();

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  return sanitizeUser(updatedUser);
}
