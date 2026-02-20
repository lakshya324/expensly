import { connectToMongoDB } from "./config/db.config.js";
import { connectToRedis } from "./config/redis.config.js";
// import { logInfo, logSuccess } from "./utils/logger.js";
import { seedSuperAdmin } from "./utils/superadmin.js";

export default async function databases(): Promise<void> {
  //! Connect to MongoDB
  await connectToMongoDB();
  // logSuccess("Connected to MongoDB");

  //! Connect to Redis
  await connectToRedis();
  // logInfo("Connected to Redis");

  //! Seed Super Admin
  await seedSuperAdmin();
}
