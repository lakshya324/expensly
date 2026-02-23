import mongoose from "mongoose";
import { Request, Response } from "express";
import { ResponsePayload } from "../types/payloads.types.js";
import { createError } from "../utils/error.js";

// const DB_STATUS = new Map<number, string>([
//   [0, "disconnected"],
//   [1, "connected"],
//   [2, "connecting"],
//   [3, "disconnecting"],
// ]);

export class HealthController {
  static getHealth(_req: Request, res: Response): void {
    const readyState = mongoose.connection.readyState;
    if (readyState !== 1)
      createError(
        `Database connection is not healthy. Current state: ${readyState}`,
        503,
        "DB_CONNECTION_ERROR",
      );

    const payload: ResponsePayload = {
      success: true,
      message: "Expensly Backend is running",
      timestamp: new Date().toISOString(),
    };
    res.status(200).json(payload);
  }
}
