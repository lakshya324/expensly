import { Request, Response, NextFunction } from "express";
import { hashPassword } from "../services/auth.service.js";
import { createError } from "../utils/error.js";
import { getIO } from "../websocket/ioServer.js";
import {
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  CURRENCIES,
} from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { User } from "../models/User.model.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { IUserData } from "../types/user.types.js";
import { Types } from "mongoose";
import { IDepartmentData } from "../types/organization.types.js";

export default class AdminController {
  //! Users

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = req.user!;
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
      if (deptQ) filter["department"] = deptQ;

      const [users, total] = await Promise.all([
        User.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
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
      const user = req.user!;
      const org = req.organization!;
      const { name, email, password, department, managerId } = req.body as {
        name: string;
        email: string;
        password: string;
        department: string;
        managerId?: string;
      };

      const deptExists = org.departments.some((d) => d.name === department);
      if (!deptExists)
        createError(
          `Department "${department}" not found`,
          400,
          "INVALID_DEPARTMENT",
        );

      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) createError("Email already exists", 409, "DUPLICATE_EMAIL");

      const passwordHash = await hashPassword(password);

      const newUser = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: ROLES.USER,
        orgId: org._id,
        department,
        managerId: managerId ?? null,
      });

      const userData = await newUser.data(org);

      getIO().to(org._id.toString()).emit("user_update", {
        type: "user_update",
        userId: newUser._id.toString(),
        userData,
        timestamp: new Date().toISOString(),
      });

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
      const user = req.user!;
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
        const deptExists = org.departments.some(
          (d) => d._id.toString() === department,
        );
        if (!deptExists)
          createError(
            `Department "${department}" not found`,
            400,
            "INVALID_DEPARTMENT",
          );
        editUser.department = new Types.ObjectId(department);
      }
      if (managerId !== undefined)
        editUser.managerId =
          managerId === null ? null : new Types.ObjectId(managerId);

      await editUser.save();

      const userData = await editUser.data(org);

      getIO().to(org._id.toString()).emit("user_update", {
        type: "user_update",
        userId: editUser._id.toString(),
        userData,
        timestamp: new Date().toISOString(),
      });

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
      const admin = req.user!;
      const org = req.organization!;
      const userId = req.params["id"]!;
      const isDisabled = req.body["isDisabled"] === "true";

      const user = await User.findOne({ _id: userId, orgId: org._id });
      if (!user) createError("User not found", 404, "NOT_FOUND");

      const body = req.body as Record<string, unknown>;
      user.isDisabled = isDisabled;
      await user.save();

      const userData = await user.data(org);

      const io = getIO();
      const payload = {
        type: "user_disable",
        userId: user._id.toString(),
        userData,
        timestamp: new Date().toISOString(),
      };

      io.to(org._id.toString()).emit("user_disable", payload);
      io.to(user._id.toString()).emit("user_disable", payload);

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

  //! Departments

  static async listDepartments(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user!;
      const org = req.organization!;

      const payload: ResponsePayload<IDepartmentData[]> = {
        success: true,
        message: "Departments retrieved successfully",
        timestamp: new Date().toISOString(),
        data: org.departmentData(),
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async addDepartment(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const { name, budget, currency } = req.body as {
        name: string;
        budget?: number | string;
        currency?: string;
      };

      const duplicate = org.departments.some(
        (d) => d.name.toLowerCase() === name.toLowerCase(),
      );
      if (duplicate)
        createError(
          `Department "${name}" already exists`,
          409,
          "DUPLICATE_DEPARTMENT",
        );

      org.departments.push({
        name,
        budget: parseFloat(String(budget)) || 0,
        spent: 0,
        currency: currency ?? CURRENCIES[0],
      } as Parameters<typeof org.departments.push>[0]);
      org.totalBudget = org.departments.reduce(
        (sum, d) => sum + (d.budget ?? 0),
        0,
      );
      await org.save();

      const payload: ResponsePayload<{
        departments: IDepartmentData[];
        totalBudget: number;
      }> = {
        success: true,
        message: "Department added successfully",
        timestamp: new Date().toISOString(),
        data: {
          departments: org.departmentData(),
          totalBudget: org.totalBudget,
        },
      };

      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async editDepartment(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const deptId = req.params["id"]! as string;

      const dept = org.departments.id(deptId);
      if (!dept) createError("Department not found", 404, "NOT_FOUND");

      const { name, budget, currency } = req.body as {
        name?: string;
        budget?: number | string;
        currency?: string;
      };
      if (name !== undefined) dept.name = name;
      if (budget !== undefined) dept.budget = parseFloat(String(budget));
      if (currency !== undefined) dept.currency = currency as "USD" | "INR";

      org.totalBudget = org.departments.reduce(
        (sum, d) => sum + (d.budget ?? 0),
        0,
      );
      await org.save();

      const payload: ResponsePayload<{
        departments: IDepartmentData[];
        totalBudget: number;
      }> = {
        success: true,
        message: "Department updated successfully",
        timestamp: new Date().toISOString(),
        data: {
          departments: org.departmentData(),
          totalBudget: org.totalBudget,
        },
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  static async resetDepartmentSpent(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const user = req.user!;
      const org = req.organization!;
      const deptId = req.params["id"]! as string;

      const dept = org.departments.id(deptId);
      if (!dept) createError("Department not found", 404, "NOT_FOUND");

      dept.spent = 0;
      await org.save();

      const payload: ResponsePayload<IDepartmentData[]> = {
        success: true,
        message: "Department spent reset successfully",
        timestamp: new Date().toISOString(),
        data: org.departmentData(),
      };

      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }
}
