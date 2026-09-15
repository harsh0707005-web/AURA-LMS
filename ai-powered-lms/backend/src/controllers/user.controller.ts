import { Response, NextFunction } from "express";
import { AuthRequest, Role } from "../types/auth.types.js";
import { getParam } from "../lib/param.js";
import {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../services/user.service.js";

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = req.query;
    const users = await getAllUsers(role ? (String(role).toUpperCase() as Role) : undefined);
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const user = await getUserById(id);
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
}

export async function modifyUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const updated = await updateUser(id, req.body);
    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = getParam(req.params.id);
    const result = await deleteUser(id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}
