import mongoose from "mongoose";
import config from "./env.config.js";
import { logError, logSuccess } from "../utils/logger.js";

export async function connectToMongoDB() {
  try {
    await mongoose.connect(config.mongodbUri);
    logSuccess("Connected to MongoDB");
  } catch (error) {
    logError(error, {
      message: "Failed to connect to MongoDB",
      status: 500,
      code: "MONGODB_CONNECTION_FAILED",
    });
    process.exit(1);
  }
}
