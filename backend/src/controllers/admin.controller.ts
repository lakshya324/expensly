import { Response, NextFunction } from "express";
import { hashPassword } from "../services/auth.service.js";
import { createError } from "../utils/error.js";
import { ROLES, DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT } from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { IUserData, IUserPermissions } from "../types/user.types.js";
import { Types } from "mongoose";
import {
  emitUserUpdate,
  emitUserDisable,
} from "../websocket/handlers/user.handler.js";

export default class AdminController {
  //! Users

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const {
        page: pageQ,
        limit: limitQ,
        department: deptQ,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const skip = (page - 1) * limit;

      const filter: Record<string, unknown> = {
        orgId: org._id,
        role: { $ne: ROLES.SUPER_ADMIN },
      };
      if (deptQ) filter["department"] = new Types.ObjectId(deptQ);

      const [users, total] = await Promise.all([
        User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(filter),
      ]);

      const payload: ResponsePaginationPayload<IUserData> = {
        success: true,
        message: "Users retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: await Promise.all(users.map((u) => new User(u).data(org))),
          pagination: {
            page,
            pageSize: users.length,
            totalItems: total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async createUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const { name, email, password, department, managerId } = req.body as {
        name: string;
        email: string;
        password: string;
        department: string;
        managerId?: string;
      };

      const dept = await Department.findOne({
        _id: new Types.ObjectId(department),
        orgId: org._id,
        isActive: true,
      });
      if (!dept)
        throw createError("Department not found or inactive", 400, "INVALID_DEPARTMENT");

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing)
        throw createError("Email already exists", 409, "DUPLICATE_EMAIL");

      const passwordHash = await hashPassword(password);

      const newUser = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: ROLES.USER,
        orgId: org._id,
        department: new Types.ObjectId(department),
        managerId: managerId ? new Types.ObjectId(managerId) : null,
      });

      const userData = await newUser.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());

      const payload: ResponsePayload<IUserData> = {
        success: true,
        message: "User created successfully",
        timestamp: new Date().toISOString(),
        data: userData,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async editUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const userId = req.params["id"]!;

      const editUser = await User.findOne({ _id: userId, orgId: org._id });
      if (!editUser) throw createError("User not found", 404, "NOT_FOUND");

      const { name, department, managerId } = req.body as {
        name?: string;
        department?: string;
        managerId?: string | null;
      };

      if (name !== undefined) editUser.name = name;
      if (department !== undefined) {
        const dept = await Department.findOne({
          _id: new Types.ObjectId(department),
          orgId: org._id,
          isActive: true,
        });
        if (!dept)
          throw createError("Department not found or inactive", 400, "INVALID_DEPARTMENT");
        editUser.department = new Types.ObjectId(department);
      }
      if (managerId !== undefined)
        editUser.managerId =
          managerId === null ? null : new Types.ObjectId(managerId);

      await editUser.save();

      const userData = await editUser.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());

      const payload: ResponsePayload<IUserData> = {
        success: true,
        message: "User updated successfully",
        timestamp: new Date().toISOString(),
        data: userData,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async toggleUserStatus(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const userId = req.params["id"]!;
      const isDisabled = req.body["isDisabled"] === true || req.body["isDisabled"] === "true";

      const user = await User.findOne({ _id: userId, orgId: org._id });
      if (!user) throw createError("User not found", 404, "NOT_FOUND");

      user.isDisabled = isDisabled;
      await user.save();

      const userData = await user.data(org);
      emitUserDisable(
        org._id.toString(),
        user._id.toString(),
        userData,
        org._id.toString(),
      );

      const responsePayload: ResponsePayload<boolean> = {
        success: true,
        message: `User ${isDisabled ? "disabled" : "enabled"} successfully`,
        timestamp: new Date().toISOString(),
        data: isDisabled,
      };
      res.status(200).json(responsePayload);
    } catch (err) {
      next(err);
    }
  }

  static async updateUserPermissions(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const userId = req.params["id"]!;
      const { canViewAllTickets, canApprove } = req.body as {
        canViewAllTickets?: boolean | null;
        canApprove?: boolean | null;
      };

      const user = await User.findOne({ _id: userId, orgId: org._id });
      if (!user) throw createError("User not found", 404, "NOT_FOUND");

      if (canViewAllTickets !== undefined)
        user.permissions.canViewAllTickets = canViewAllTickets;
      if (canApprove !== undefined) user.permissions.canApprove = canApprove;
      await user.save();

      const userData = await user.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());

      const payload: ResponsePayload<IUserPermissions> = {
        success: true,
        message: "User permissions updated",
        timestamp: new Date().toISOString(),
        data: {
          canViewAllTickets: user.permissions.canViewAllTickets ?? null,
          canApprove: user.permissions.canApprove ?? null,
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
