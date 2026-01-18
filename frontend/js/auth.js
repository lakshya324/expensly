import { API_BASE } from "./config/env.config.js";
import { hashPassword } from "./utils/encode.js";
import { OrganizationStore } from "./stores/organization.store.js";

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
}
