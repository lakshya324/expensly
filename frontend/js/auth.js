import { API_BASE, SESSION_KEYS } from "./config/env.config.js";
import { CURRENCY } from "./utils/currency.js";
import { hashPassword } from "./utils/encode.js";
import { OrganizationStore } from "./stores/organization.store.js";
import { UserPreferenceLocal } from "./storage/local.js";

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
      const user = await window.UserStore.getUserByEmail(email);

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
        currency: currency,
        loginTime: new Date().toISOString(),
        isAdmin: false,
        isFinance: user.department === "Finance", // Finance dept has approve/reject privileges
      };

      // store inside session
      sessionStorage.setItem(SESSION_KEYS.user, JSON.stringify(session));

      return session;
    } catch (error) {
      console.error("User login failed:", error);
      throw error;
    }
  }
}
