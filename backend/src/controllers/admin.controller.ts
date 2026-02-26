import { Response, NextFunction } from "express";
import { hashPassword } from "../services/auth.service.js";
import { createError } from "../utils/error.js";
import {
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
} from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { IUser, IUserData, IUserPermissions } from "../types/user.types.js";
import mongoose, { isValidObjectId, Types } from "mongoose";
import { listUsersPaginated } from "../services/user.service.js";
import {
  emitUserUpdate,
  emitUserDisable,
} from "../websocket/handlers/user.handler.js";
import { sendWelcomeEmail } from "../services/email.service.js";

export default class AdminController {
  //! Users

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const {
        page: pageQ,
        limit: limitQ,
        department: deptQ,
        search: searchQ,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );
      const filter: Record<string, unknown> = {
        orgId: org._id,
        role: { $ne: ROLES.SUPER_ADMIN },
      };
      if (deptQ) filter["department"] = new Types.ObjectId(deptQ);
      if (searchQ) {
        filter["$or"] = [
          { name: { $regex: searchQ, $options: "i" } },
          { email: { $regex: searchQ, $options: "i" } },
        ];
      }

      const { data: usersData, total } = await listUsersPaginated(
        filter,
        page,
        limit,
        org.data(),
      );

      const payload: ResponsePaginationPayload<IUserData> = {
        success: true,
        message: "Users retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data: usersData,
          pagination: {
            page,
            pageSize: usersData.length,
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

      const managerObjectId = managerId ? new Types.ObjectId(managerId) : null;
      const deptObjectId = new Types.ObjectId(department);

      const dept = await Department.exists({
        _id: deptObjectId,
        orgId: org._id,
        isActive: true,
      });
      if (!dept)
        throw createError(
          "Department not found or inactive",
          400,
          "INVALID_DEPARTMENT",
        );

      // check manager is valid
      if (managerObjectId) {
        const managerExists = await User.exists({
          _id: managerObjectId,
          orgId: org._id,
          department: deptObjectId,
          isDisabled: false,
        });
        if (!managerExists)
          throw createError("Manager not found", 400, "INVALID_MANAGER");
      }

      const passwordHash = await hashPassword(password);

      let newUser: IUser;

      try {
        newUser = await User.create({
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: ROLES.USER,
          orgId: org._id,
          department: deptObjectId,
          managerId: managerId ? managerObjectId : null,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw createError("Email already exists", 409, "DUPLICATE_EMAIL");
        }
        throw err;
      }

      const userData = await newUser.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());

      // Welcome email (non-blocking)
      sendWelcomeEmail(newUser.email, newUser.name, org.name, password);

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

      const managerObjectId = managerId ? new Types.ObjectId(managerId) : null;
      const deptObjectId = department ? new Types.ObjectId(department) : null;

      if (name !== undefined) editUser.name = name;
      if (department !== undefined) {
        const dept = await Department.exists({
          _id: deptObjectId,
          orgId: org._id,
          isActive: true,
        });
        if (!dept)
          throw createError(
            "Department not found or inactive",
            400,
            "INVALID_DEPARTMENT",
          );
        editUser.department = deptObjectId;
      }
      if (managerId !== undefined) {
        const exist = await User.exists({
          _id: managerObjectId,
          orgId: org._id,
          department: deptObjectId,
          isDisabled: false,
        });
        if (!exist)
          throw createError("Manager not found", 400, "INVALID_MANAGER");

        editUser.managerId =
          managerId === null ? null : new Types.ObjectId(managerId);
      }

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
      const userId = req.params["id"]! as string;
      const isDisabled =
        req.body["isDisabled"] === true || req.body["isDisabled"] === "true";

      if (!isValidObjectId(userId))
        throw createError("Invalid user ID", 400, "INVALID_USER_ID");

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
      const userId = req.params["id"]! as string;
      const { canViewAllTickets, canApprove } = req.body as {
        canViewAllTickets?: boolean | null;
        canApprove?: boolean | null;
      };

      if (!isValidObjectId(userId))
        throw createError("Invalid user ID", 400, "INVALID_USER_ID");

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
