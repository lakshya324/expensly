import { connectToMongoDB } from "./config/db.config.js";
import { logInfo } from "./utils/logger.js";
import { seedSuperAdmin } from "./utils/superadmin.js";

export default async function databases(): Promise<void> {
  //! Connect to MongoDB
  await connectToMongoDB();
  logInfo("Connected to MongoDB");

  //! Seed Super Admin
  await seedSuperAdmin();
}
