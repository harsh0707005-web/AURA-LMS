import prisma from "../lib/prisma.js";
import { Role, UpdateProfileInput } from "../types/auth.types.js";

export async function getAllUsers(roleFilter?: Role) {
  return await prisma.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      enrollmentNo: true,
      employeeId: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      enrollmentNo: true,
      employeeId: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  return user;
}

export async function updateUser(userId: string, input: UpdateProfileInput & { role?: Role }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  return await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name && { name: input.name.trim() }),
      ...(input.role && { role: input.role }),
      ...(input.department && { department: input.department.trim() }),
      ...(input.enrollmentNo !== undefined && { enrollmentNo: input.enrollmentNo }),
      ...(input.employeeId !== undefined && { employeeId: input.employeeId }),
      ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      enrollmentNo: true,
      employeeId: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  await prisma.user.delete({ where: { id: userId } });
  return { message: "User deleted successfully" };
}
