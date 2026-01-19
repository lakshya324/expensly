import { API_BASE } from "./config/env.config.js";
import { CURRENCY } from "./utils/currency.js";
import { hashPassword } from "./utils/encode.js";
import { OrganizationStore } from "./models/organization.store.js";
import { UserPreferenceLocal } from "./storage/local.js";
import { UserSession } from "./storage/session.js";
import { UserStore } from "./models/user.store.js";

export class AuthManager {
  static async signupOrganization(orgName, adminEmail, adminPassword) {
    try {
      // Checking if already exists
      const existingOrg = await OrganizationStore.getOrganizationByAdminEmail(
        adminEmail
      );
      if (existingOrg) {
        throw new Error("Organization with this admin email already exists.");
      }

      // new org
      const org = {
        name: orgName,
        adminEmail: adminEmail,
        adminPassword: await hashPassword(adminPassword),
      };

      // dummy backend call
      // TODO: add this endpoint while making backend
      await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(org),
      });

      const savedOrg = await OrganizationStore.createOrganization(org);
      console.log("Organization created:", orgName);

      return savedOrg;
    } catch (error) {
      console.error("Signup failed:", error);
      throw error;
    }
  }

  static async loginUser(email, password) {
    try {
      // dummy backend endpoint
      const response = await fetch(`${API_BASE}/auth/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // TODO: Set token from response

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      // Check user exist locally
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

      // user currency preference
      let currency = UserPreferenceLocal.get()?.currency;
      if (!currency || !CURRENCY.includes(currency)) {
        currency = CURRENCY[0]; // default
        UserPreferenceLocal.set({ currency: currency });
      }

      // user session object
      const session = {
        userId: user.id,
        email: user.email,
        name: user.name,
        department: user.department,
        managerId: user.managerId || null,
        orgId: user.orgId,
        orgName: org.name,
        // currency: currency,
        loginTime: new Date().toISOString(),
        isAdmin: false,
        isFinance: user.department === "Finance", // Finance dept has approve/reject privileges
      };

      // store inside session
      UserSession.set(session);

      return session;
    } catch (error) {
      console.error("User login failed:", error);
      throw error;
    }
  }

  static async loginAdmin(email, password) {
    try {
      // finding organization
      const org = await OrganizationStore.getOrganizationByAdminEmail(email);

      if (!org) {
        throw new Error("No organization found with this admin email.");
      }

      // Verify password
      const hashedpassword = await hashPassword(password);
      if (org.adminPassword !== hashedpassword) {
        throw new Error("Invalid admin credentials");
      }

      // dummy backend call
      const response = await fetch(`${API_BASE}/auth/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      // TODO: get jwt token as response and set it for future requests

      if (!response.ok) {
        throw new Error("Invalid admin credentials");
      }

      // user currency preference
      let currency = UserPreferenceLocal.get()?.currency;
      if (!currency || !CURRENCY.includes(currency)) {
        currency = CURRENCY[0]; // default
        UserPreferenceLocal.set({ currency: currency });
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
        // currency: currency,
        loginTime: new Date().toISOString(),
        isAdmin: true,
        isFinance: false,
      };

      UserSession.set(session);

      return session;
    } catch (error) {
      console.error("Admin login failed:", error);
      throw error;
    }
  }
}
