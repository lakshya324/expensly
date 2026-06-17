import mongoose from "mongoose";
import { Request, Response } from "express";
import { ResponsePayload } from "../types/payloads.types.js";
import { createError } from "../utils/error.js";
import getRedisClient from "../config/redis.config.js";

const DB_STATUS = new Map<number, string>([
  [0, "disconnected"],
  [1, "connected"],
  [2, "connecting"],
  [3, "disconnecting"],
]);

export class HealthController {
  static live(_req: Request, res: Response): void {
    const payload: ResponsePayload = {
      success: true,
      message: "Expensly Backend process is live",
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(payload);
  }

  static ready(_req: Request, res: Response): void {
    const readyState = mongoose.connection.readyState;
    if (readyState !== 1)
      createError(
        `Database connection is not ready. Current state: ${DB_STATUS.get(readyState) ?? readyState}`,
        503,
        "DB_CONNECTION_ERROR",
      );

    const payload: ResponsePayload = {
      success: true,
      message: "Expensly Backend is ready",
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(payload);
  }

  static async dependencies(_req: Request, res: Response): Promise<void> {
    const mongoReadyState = mongoose.connection.readyState;
    const redis = getRedisClient();
    let redisStatus = redis.status;
    let redisHealthy = redisStatus === "ready";

    try {
      await redis.ping();
      redisStatus = redis.status;
      redisHealthy = true;
    } catch {
      redisHealthy = false;
    }

    const healthy = mongoReadyState === 1 && redisHealthy;
    const payload: ResponsePayload<{
      mongo: { status: string; readyState: number };
      redis: { status: string };
    }> = {
      success: healthy,
      message: healthy ? "Dependencies are healthy" : "One or more dependencies are unhealthy",
      timestamp: new Date().toISOString(),
      data: {
        mongo: {
          status: DB_STATUS.get(mongoReadyState) ?? "unknown",
          readyState: mongoReadyState,
        },
        redis: {
          status: redisStatus,
        },
      },
    };

    res.status(healthy ? 200 : 503).json(payload);
  }

  static getHealth(req: Request, res: Response): void {
    return HealthController.ready(req, res);
  }
}
