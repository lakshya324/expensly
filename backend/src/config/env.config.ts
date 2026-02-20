import "dotenv/config";
import { createError } from "../utils/error.js";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) createError(`Missing required environment variable: ${key}`, 500);
  return val;
}

const config = {
  port: parseInt(process.env["PORT"] ?? "3000") || 3000,
  nodeEnv: process.env["NODE_ENV"] ?? "development",
  corsOrigin: (process.env["CORS_ORIGIN"] ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map(s => s.trim()),

  //* MongoDB
  mongodbUri: requireEnv("MONGODB_URI"),

  //* Rate Limiting
  ratelimit: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
    },
    api: {
      windowMs: 60 * 1000, // 1 minute
      max: 200, // limit each IP to 200 requests per windowMs
    },
  },

  //* Authentication & Authorization
  authConfig: {
    jwt: {
      secret: requireEnv("JWT_SECRET"),
      refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
      expiresIn: process.env["JWT_EXPIRES_IN"] ?? "15m",
      refreshExpiresIn: process.env["JWT_REFRESH_EXPIRES_IN"] ?? "7d",
    },
    bcryptRounds: parseInt(process.env["BCRYPT_ROUNDS"] ?? "10") || 10,
  },

  //* Super Admin
  superAdminConfig: {
    email: requireEnv("SUPER_ADMIN_EMAIL"),
    password: requireEnv("SUPER_ADMIN_PASSWORD"),
  },

  //* AWS S3
  awsConfig: {
    awsBucket: process.env["AWS_BUCKET"] as string | undefined,
    awsRegion: process.env["AWS_REGION"] ?? "ap-south-1",
    awsAccessKeyId: process.env["AWS_ACCESS_KEY_ID"] as string | undefined,
    awsSecretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
  },

  //* Redis
  redisUrl: requireEnv("REDIS_URL"),

  //* Email (SMTP)
  emailConfig: {
    host: requireEnv("SMTP_HOST"),
    port: parseInt(process.env["SMTP_PORT"] ?? "587") || 587,
    user: requireEnv("SMTP_USER"),
    pass: requireEnv("SMTP_PASS"),
  },

  //* OTP
  otpExpiresIn: parseInt(process.env["OTP_EXPIRES_IN"] ?? "300") || 300, // seconds
};

export default config;
