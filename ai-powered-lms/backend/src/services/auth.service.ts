import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../lib/prisma.js";
import {
  LoginInput,
  UpdateProfileInput,
  UserResponse,
} from "../types/auth.types.js";
import { getJwtSecret } from "../middleware/auth.middleware.js";
import { User } from "../generated/prisma/client.js";
import { objectInput, registrationError } from "./registration.service.js";
import { createRefreshSession } from "./refresh-session.service.js";
export { registerUser, verifyStudentEmail, resendVerification } from "./registration.service.js";

export function sanitizeUser(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    department: user.department,
    enrollmentNo: user.enrollmentNo,
    employeeId: user.employeeId,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function loginUser(
  input: LoginInput
): Promise<{ user: UserResponse; token: string; refreshToken: string }> {
  const body = objectInput(input);
  const { email, password } = body;
  const portalRole = body.portalRole;

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    throw Object.assign(new Error("Institutional email and password are required"), { statusCode: 400 });
  }
  if (portalRole !== undefined && portalRole !== "STUDENT" && portalRole !== "FACULTY" && portalRole !== "ADMIN") {
    throw Object.assign(new Error("Invalid portal selection"), { statusCode: 400 });
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

  if (user.status !== "ACTIVE") throw registrationError("Account is not active. Email verification or institutional approval may be required.", 403);
  if (portalRole !== undefined && portalRole !== user.role) {
    throw registrationError("This account cannot sign in to the selected portal", 403);
  }

  const secret = getJwtSecret();
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";

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

  const refreshToken = await createRefreshSession(user.id);

  return {
    user: sanitizeUser(user),
    token,
    refreshToken,
  };
}

export function issueAccessToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || "15m" } as SignOptions
  );
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
  assertSafeProfileUpdate(input);
  const { name, department, avatarUrl } = input;

  const dataToUpdate: {
    name?: string;
    department?: string;
    enrollmentNo?: string | null;
    employeeId?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (name !== undefined) dataToUpdate.name = name.trim();
  if (department !== undefined) dataToUpdate.department = department.trim();
  if (avatarUrl !== undefined) dataToUpdate.avatarUrl = avatarUrl.trim();

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  return sanitizeUser(updatedUser);
}

export function assertSafeProfileUpdate(input: unknown) {
  const body = objectInput(input);
  if (["role", "status", "email", "enrollmentNo", "employeeId", "studentRegistryId"].some(key => key in body)) throw registrationError("Role, status and institutional identity fields cannot be changed through profile updates");
  for (const key of Object.keys(body)) {
    if (!["name", "department", "avatarUrl"].includes(key) || typeof body[key] !== "string" || (body[key] as string).length > 2000) throw registrationError("Invalid profile update");
  }
}
