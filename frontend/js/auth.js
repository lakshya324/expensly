import { API_BASE, SUPER_ADMIN } from "./config/env.config.js";
import { hashPassword } from "./utils/encode.js";
import { OrganizationStore } from "./models/organization.store.js";
import { UserSession } from "./storage/session.js";
import { UserStore } from "./models/user.store.js";

export class AuthManager {
  
  static async login(email, password) {
    try {
      // if super admin
      if (email === SUPER_ADMIN.email && password === SUPER_ADMIN.password) {
        return await this.loginSuperAdmin(email);
      }

      // if org admin
      const org = await OrganizationStore.getOrganizationByAdminEmail(email);
      if (org) {
        return await this.loginAdmin(email, password, org);
      }

      // otherwise regular user
      return await this.loginUser(email, password);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  static async loginSuperAdmin(email) {
    const response = await fetch(`${API_BASE}/auth/superadmin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: SUPER_ADMIN.password }),
    });

    if (!response.ok) {
      throw new Error("Super Admin authentication failed");
    }

    const session = {
      userId: "superadmin",
      email: email,
      name: "Super Administrator",
      department: null,
      managerId: null,
      orgId: null,
      orgName: "Expensly Platform",
      loginTime: new Date().toISOString(),
      isAdmin: false,
      isFinance: false,
      isSuperAdmin: true,
    };

    UserSession.set(session);
    return session;
  }

  static async loginAdmin(email, password, org) {
    const hashedpassword = await hashPassword(password);
    if (org.adminPassword !== hashedpassword) {
      throw new Error("Invalid credentials");
    }

    const response = await fetch(`${API_BASE}/auth/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }

    const adminId = "admin_" + org.id;
    const session = {
      userId: adminId,
      email: email,
      name: "Administrator",
      department: null,
      managerId: null,
      orgId: org.id,
      orgName: org.name,
      loginTime: new Date().toISOString(),
      isAdmin: true,
      isFinance: false,
      isSuperAdmin: false,
    };

    UserSession.set(session);
    return session;
  }

  static async loginUser(email, password) {
    const response = await fetch(`${API_BASE}/auth/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }

    const user = await UserStore.getUserByEmail(email);
    if (!user) {
      throw new Error("User not found. Please contact your administrator.");
    }

    const hashedpassword = await hashPassword(password);
    if (user.password !== hashedpassword) {
      throw new Error("Invalid credentials");
    }

    // verify organization
    const org = await OrganizationStore.getOrganizationById(user.orgId);
    if (!org) {
      throw new Error("Organization not found. Please contact support.");
    }

    const session = {
      userId: user.id,
      email: user.email,
      name: user.name,
      department: user.department,
      managerId: user.managerId || null,
      orgId: user.orgId,
      orgName: org.name,
      loginTime: new Date().toISOString(),
      isAdmin: false,
      isFinance: user.department === "Finance",
      isSuperAdmin: false,
    };

    UserSession.set(session);
    return session;
  }

  static async createOrganization(orgName, adminEmail, adminPassword) {
    try {
      // if already exists
      const existingOrg = await OrganizationStore.getOrganizationByAdminEmail(
        adminEmail
      );
      if (existingOrg) {
        throw new Error("Organization with this admin email already exists.");
      }

      const org = {
        name: orgName,
        adminEmail: adminEmail,
        adminPassword: await hashPassword(adminPassword),
      };

      await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(org),
      });

      const savedOrg = await OrganizationStore.createOrganization(org);
      console.log("Organization created:", orgName);

      return savedOrg;
    } catch (error) {
      console.error("Organization creation failed:", error);
      throw error;
    }
  }
}
