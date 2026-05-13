import { Response, NextFunction } from "express";
import { hashPassword } from "../services/auth.service.js";
import { createError } from "../utils/error.js";
import {
  ROLES,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  PERMISSION_KEY,
  PermissionKey,
} from "../config/constants.js";
import { AuthRequest } from "../types/types.js";
import { User } from "../models/User.model.js";
import { Department } from "../models/Department.model.js";
import { Policy } from "../models/Policy.model.js";
import {
  ResponsePaginationPayload,
  ResponsePayload,
} from "../types/payloads.types.js";
import { IUser, IUserData } from "../types/user.types.js";
import { IPolicyData } from "../types/policy.types.js";
import mongoose, { isValidObjectId, Types } from "mongoose";
import { listUsersPaginated } from "../services/user.service.js";
import {
  emitUserUpdate,
  emitUserDisable,
} from "../websocket/handlers/user.handler.js";
import { sendWelcomeEmail } from "../services/email.service.js";
import { getAuditLog, logAction } from "../services/auditLog.service.js";
import { IAuditLogData } from "../types/auditLog.types.js";
import { AUDIT_ACTION, ENTITY_TYPE, EntityType } from "../config/constants.js";
import { propagateUserRename, propagatePolicyUpdate, propagatePolicyDeletion } from "../services/propagation.service.js";
import { logError } from "../utils/logger.js";

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

      const [deptDoc, mgrDoc, passwordHash] = await Promise.all([
        Department.findById(deptObjectId).select("_id name").lean(),
        managerObjectId ? User.findById(managerObjectId).select("_id name").lean() : null,
        hashPassword(password),
      ]);

      let newUser: IUser;

      try {
        newUser = await User.create({
          name,
          email: email.toLowerCase(),
          passwordHash,
          role: ROLES.USER,
          orgId: org._id,
          department: deptObjectId,
          departmentSnapshot: deptDoc ? { _id: deptDoc._id, name: deptDoc.name } : null,
          managerId: managerId ? managerObjectId : null,
          managerSnapshot: mgrDoc ? { _id: mgrDoc._id, name: mgrDoc.name } : null,
        });
      } catch (err: any) {
        if (err.code === 11000) {
          throw createError("Email already exists", 409, "DUPLICATE_EMAIL");
        }
        throw err;
      }

      const userData = await newUser.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());
      logAction({
        orgId: org._id.toString(),
        performedBy: req.user!._id.toString(),
        performerName: req.user!.name,
        action: AUDIT_ACTION.USER_CREATED,
        entityType: ENTITY_TYPE.USER,
        entityId: newUser._id.toString(),
      }).catch(() => {});

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

      const prevName = editUser.name;
      if (name !== undefined) editUser.name = name;
      if (department !== undefined) {
        const deptDoc = await Department.findOne({
          _id: deptObjectId,
          orgId: org._id,
          isActive: true,
        }).select("_id name").lean();
        if (!deptDoc)
          throw createError(
            "Department not found or inactive",
            400,
            "INVALID_DEPARTMENT",
          );
        editUser.department = deptObjectId;
        editUser.departmentSnapshot = { _id: deptDoc._id, name: deptDoc.name };
      }
      if (managerId !== undefined) {
        if (managerId === null) {
          editUser.managerId = null;
          editUser.managerSnapshot = null;
        } else {
          const mgrDoc = await User.findOne({
            _id: managerObjectId,
            orgId: org._id,
            isDisabled: false,
          }).select("_id name").lean();
          if (!mgrDoc)
            throw createError("Manager not found", 400, "INVALID_MANAGER");
          editUser.managerId = new Types.ObjectId(managerId);
          editUser.managerSnapshot = { _id: mgrDoc._id, name: mgrDoc.name };
        }
      }

      await editUser.save();

      if (name !== undefined && name !== prevName) {
        propagateUserRename(editUser._id.toString(), name, editUser.email)
          .catch((err) => logError(err, { message: "propagateUserRename failed", code: "PROPAGATION_ERROR" }));
      }

      const userData = await editUser.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());
      logAction({
        orgId: org._id.toString(),
        performedBy: req.user!._id.toString(),
        performerName: req.user!.name,
        action: AUDIT_ACTION.USER_UPDATED,
        entityType: ENTITY_TYPE.USER,
        entityId: editUser._id.toString(),
      }).catch(() => {});

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
      logAction({
        orgId: org._id.toString(),
        performedBy: req.user!._id.toString(),
        performerName: req.user!.name,
        action: isDisabled ? AUDIT_ACTION.USER_DISABLED : AUDIT_ACTION.USER_ENABLED,
        entityType: ENTITY_TYPE.USER,
        entityId: user._id.toString(),
      }).catch(() => {});

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
      const { permissions, policyId } = req.body as {
        permissions?: Record<string, boolean | null>;
        policyId?: string | null;
      };

      if (!isValidObjectId(userId))
        throw createError("Invalid user ID", 400, "INVALID_USER_ID");

      const user = await User.findOne({ _id: userId, orgId: org._id });
      if (!user) throw createError("User not found", 404, "NOT_FOUND");

      if (permissions && typeof permissions === "object") {
        const validKeys = Object.values(PERMISSION_KEY) as string[];
        for (const [key, value] of Object.entries(permissions)) {
          if (validKeys.includes(key) && (typeof value === "boolean" || value === null)) {
            (user.permissions as Record<string, boolean | null>)[key] = value;
          }
        }
        user.markModified("permissions");
      }

      if (policyId !== undefined) {
        user.policyId = policyId ? new Types.ObjectId(policyId) : null;
        if (policyId) {
          const policyDoc = await Policy.findById(policyId).select("_id name grants").lean<{ _id: any; name: string; grants: string[] }>();
          user.policySnapshot = policyDoc
            ? { _id: policyDoc._id, name: policyDoc.name, grants: policyDoc.grants }
            : null;
        } else {
          user.policySnapshot = null;
        }
      }

      await user.save();
      logAction({
        orgId: org._id.toString(),
        performedBy: req.user!._id.toString(),
        performerName: req.user!.name,
        action: AUDIT_ACTION.PERMISSIONS_UPDATED,
        entityType: ENTITY_TYPE.USER,
        entityId: user._id.toString(),
        metadata: { permissions, policyId },
      }).catch(() => {});

      const userData = await user.data(org);
      emitUserUpdate(org._id.toString(), userData, org._id.toString());

      const payload: ResponsePayload<IUserData> = {
        success: true,
        message: "User permissions updated",
        timestamp: new Date().toISOString(),
        data: userData,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/policies */
  static async listPolicies(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const policies = await Policy.find({ orgId: org._id, isActive: true }).sort({ name: 1 }).lean();
      const data: IPolicyData[] = policies.map((p) => ({
        _id: p._id.toString(),
        orgId: p.orgId.toString(),
        name: p.name,
        description: p.description ?? null,
        isSystem: p.isSystem,
        isActive: p.isActive,
        grants: p.grants as PermissionKey[],
        createdBy: p.createdBy.toString(),
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      }));
      const payload: ResponsePayload<IPolicyData[]> = {
        success: true,
        message: "Policies retrieved successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/admin/policies */
  static async createPolicy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const admin = req.user!;
      const { name, description, grants } = req.body as {
        name: string;
        description?: string;
        grants?: string[];
      };

      if (!name?.trim()) throw createError("Policy name is required", 400, "VALIDATION_ERROR");

      const validKeys = Object.values(PERMISSION_KEY) as string[];
      const sanitizedGrants = (grants ?? []).filter((g) => validKeys.includes(g)) as PermissionKey[];

      const policy = await Policy.create({
        orgId: org._id,
        name: name.trim(),
        description: description?.trim() ?? null,
        isSystem: false,
        isActive: true,
        grants: sanitizedGrants,
        createdBy: admin._id,
      });

      const data: IPolicyData = {
        _id: policy._id.toString(),
        orgId: policy.orgId.toString(),
        name: policy.name,
        description: policy.description ?? null,
        isSystem: policy.isSystem,
        isActive: policy.isActive,
        grants: policy.grants as PermissionKey[],
        createdBy: policy.createdBy.toString(),
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      };
      const payload: ResponsePayload<IPolicyData> = {
        success: true,
        message: "Policy created successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(201).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/admin/policies/:id */
  static async updatePolicy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const policy = await Policy.findOne({ _id: req.params["id"], orgId: org._id });
      if (!policy) throw createError("Policy not found", 404, "NOT_FOUND");
      if (policy.isSystem)
        throw createError("System policies cannot be modified", 403, "FORBIDDEN");

      const { name, description, grants } = req.body as {
        name?: string;
        description?: string | null;
        grants?: string[];
      };

      if (name !== undefined) policy.name = name.trim();
      if (description !== undefined) policy.description = description ?? null;
      if (grants !== undefined) {
        const validKeys = Object.values(PERMISSION_KEY) as string[];
        policy.grants = grants.filter((g) => validKeys.includes(g)) as PermissionKey[];
      }

      await policy.save();

      propagatePolicyUpdate(policy._id.toString(), policy.name, policy.grants as string[])
        .catch((err) => logError(err, { message: "propagatePolicyUpdate failed", code: "PROPAGATION_ERROR" }));

      const data: IPolicyData = {
        _id: policy._id.toString(),
        orgId: policy.orgId.toString(),
        name: policy.name,
        description: policy.description ?? null,
        isSystem: policy.isSystem,
        isActive: policy.isActive,
        grants: policy.grants as PermissionKey[],
        createdBy: policy.createdBy.toString(),
        createdAt: policy.createdAt,
        updatedAt: policy.updatedAt,
      };
      const payload: ResponsePayload<IPolicyData> = {
        success: true,
        message: "Policy updated successfully",
        timestamp: new Date().toISOString(),
        data,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/admin/policies/:id */
  static async deletePolicy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const org = req.organization!;
      const policy = await Policy.findOne({ _id: req.params["id"], orgId: org._id });
      if (!policy) throw createError("Policy not found", 404, "NOT_FOUND");

      policy.isActive = false;
      await policy.save();

      propagatePolicyDeletion(policy._id.toString())
        .catch((err) => logError(err, { message: "propagatePolicyDeletion failed", code: "PROPAGATION_ERROR" }));

      const payload: ResponsePayload<null> = {
        success: true,
        message: "Policy deactivated successfully",
        timestamp: new Date().toISOString(),
        data: null,
      };
      res.status(200).json(payload);
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/admin/audit-log */
  static async getAuditLog(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const org = req.organization!;
      const {
        page: pageQ,
        limit: limitQ,
        entityId,
        entityType,
      } = req.query as Record<string, string | undefined>;
      const page = Math.max(1, parseInt(pageQ ?? "") || DEFAULT_PAGE);
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, parseInt(limitQ ?? "") || DEFAULT_LIMIT),
      );

      const { data, total } = await getAuditLog({
        orgId: org._id.toString(),
        entityId,
        entityType: entityType as EntityType | undefined,
        page,
        limit,
      });

      const payload: ResponsePaginationPayload<IAuditLogData> = {
        success: true,
        message: "Audit log retrieved successfully",
        timestamp: new Date().toISOString(),
        data: {
          data,
          pagination: {
            page,
            pageSize: data.length,
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
}
