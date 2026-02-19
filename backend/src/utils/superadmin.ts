import { ROLES } from "../config/constants.js";
import config from "../config/env.config.js";
import { User } from "../models/User.model.js";
import { hashPassword } from "../services/auth.service.js";
import { logInfo, logSuccess } from "./logger.js";

export async function seedSuperAdmin(): Promise<void> {
  const { email, password } = config.superAdminConfig;
  if (email && password) {
    const existing = await User.findOne({ email });
    if (!existing) {
      const passwordHash = await hashPassword(password);
      await User.create({
        name: "Super Admin",
        email: email,
        passwordHash,
        role: ROLES.SUPER_ADMIN,
        orgId: null,
      });
      logSuccess("Super admin user created with email: " + email);
      return;
    }
    logInfo("Super admin user already exists with email: " + email);
  }
}
