// Health Check Controller
import mongoose from 'mongoose';
import { Request, Response } from 'express';

const DB_STATUS = new Map<number, string>([
  [0, 'disconnected'],
  [1, 'connected'],
  [2, 'connecting'],
  [3, 'disconnecting'],
]);

export class HealthController {
  static getHealth(_req: Request, res: Response): void {
    const readyState = mongoose.connection.readyState;
    res.status(200).json({
      success: true,
      message: 'Expensly Backend is running',
      timestamp: new Date().toISOString(),
      db: DB_STATUS.get(readyState) ?? 'unknown',
    });
  }
}
