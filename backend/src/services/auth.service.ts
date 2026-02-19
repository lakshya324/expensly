import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { BCRYPT_ROUNDS } from '../config/constants.js';
import { RefreshToken } from '../models/index.js';
import type { Types } from 'mongoose';

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  role: 'user' | 'admin' | 'super_admin';
  orgId: string | null;
}

interface TokenInput {
  id: Types.ObjectId | string;
  role: 'user' | 'admin' | 'super_admin';
  orgId: Types.ObjectId | string | null;
}

// ─── Password ────────────────────────────────────────────────────────────────

export const hashPassword = async (plain: string): Promise<string> => {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
};

export const comparePassword = async (plain: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(plain, hash);
};

// ─── Access Token ─────────────────────────────────────────────────────────────

export const generateAccessToken = ({ id, role, orgId }: TokenInput): string => {
  return jwt.sign(
    { sub: id.toString(), role, orgId: orgId ? orgId.toString() : null },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as AccessTokenPayload;
};

// ─── Refresh Token ────────────────────────────────────────────────────────────

const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

export const generateRefreshToken = async (
  userId: Types.ObjectId | string
): Promise<string> => {
  const raw = crypto.randomBytes(64).toString('hex');
  const tokenHash = hashToken(raw);

  const expiresAt = new Date();
  const match = config.jwtRefreshExpiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const value = parseInt(match[1]!);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
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
};

export const verifyRefreshToken = async (
  raw: string
): Promise<Types.ObjectId> => {
  const tokenHash = hashToken(raw);
  const record = await RefreshToken.findOne({ tokenHash });

  if (!record) throw new Error('Refresh token not found or already used');
  if (record.expiresAt < new Date()) {
    await record.deleteOne();
    throw new Error('Refresh token expired');
  }

  await record.deleteOne();
  return record.userId;
};

export const revokeRefreshToken = async (raw: string): Promise<void> => {
  const tokenHash = hashToken(raw);
  await RefreshToken.deleteOne({ tokenHash });
};

export const revokeAllUserTokens = async (
  userId: Types.ObjectId | string
): Promise<void> => {
  await RefreshToken.deleteMany({ userId });
};
