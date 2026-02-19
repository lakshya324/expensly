import bcrypt from "bcryptjs";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import config from "../config/env.config.js";
import { BCRYPT_ROUNDS } from "../config/constants.js";
import { createError } from "../utils/error.js";
import { logError } from "../utils/logger.js";
import { Types } from "mongoose";
import { RefreshToken } from "../models/RefreshToken.model.js";

//! Password
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

//! Access Token
export function generateAccessToken(id: Types.ObjectId | string): string {
  return (
    "Bearer " +
    jwt.sign({ id }, config.authConfig.jwt.secret, {
      expiresIn: config.authConfig.jwt.expiresIn,
    } as jwt.SignOptions)
  );
}
export function verifyAccessToken(header: string | undefined): JwtPayload {
  try {
    // Checking Authorization header
    if (!header) createError("Not authenticated.", 401, "UNAUTHORIZED");

    // Bearer token
    const set = header.split(" ");
    const token = set[set.length - 1];
    let decodedToken: JwtPayload;

    // Decode token
    decodedToken = jwt.verify(
      token,
      config.authConfig.jwt.secret,
    ) as JwtPayload;
    if (!decodedToken) createError("Not authenticated.", 401, "UNAUTHORIZED");
    return decodedToken;
  } catch (err) {
    logError(err, {
      message: "Error verifying access token",
      code: "TOKEN_VERIFY_ERROR",
      details: { header },
    });
    createError("Not authenticated.", 401, "UNAUTHORIZED");
  }
}

//! Refresh Token

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

export async function generateRefreshToken(
  userId: Types.ObjectId,
): Promise<string> {
  const raw = crypto.randomBytes(64).toString("hex");
  const tokenHash = hashToken(raw);

  const expiresAt = new Date();
  const match = config.authConfig.jwt.refreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const value = parseInt(match[1]!);
    const unit = match[2] as "s" | "m" | "h" | "d";
    const multipliers: Record<typeof unit, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    expiresAt.setTime(expiresAt.getTime() + value * (multipliers[unit] ?? 0));
  }

  await RefreshToken.create({ tokenHash, userId, expiresAt });
  return raw;
}
export async function verifyRefreshToken(raw: string): Promise<Types.ObjectId> {
  const tokenHash = hashToken(raw);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record)
    createError(
      "Refresh token not found or already used",
      401,
      "INVALID_REFRESH_TOKEN",
    );
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    createError("Refresh token expired", 401, "EXPIRED_REFRESH_TOKEN");
  }

  // delete token after use to prevent reuse (single-use token)
  await record.deleteOne();
  return record.userId;
}

export async function revokeRefreshToken(raw: string): Promise<void> {
  const tokenHash = hashToken(raw);
  await RefreshToken.deleteOne({ tokenHash });
}
export async function revokeAllUserTokens(
  userId: Types.ObjectId,
): Promise<void> {
  await RefreshToken.deleteMany({ userId });
}
