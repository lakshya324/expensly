// Environment Configuration
import 'dotenv/config';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000') || 3000,
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  corsOrigin: process.env['CORS_ORIGIN'] ?? 'http://127.0.0.1:5500',

  // MongoDB
  mongodbUri: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/expensly',

  // JWT — required at runtime; validated lazily (throw at first use if missing)
  get jwtSecret(): string {
    return requireEnv('JWT_SECRET');
  },
  get jwtRefreshSecret(): string {
    return requireEnv('JWT_REFRESH_SECRET');
  },
  jwtExpiresIn: process.env['JWT_EXPIRES_IN'] ?? '15m',
  jwtRefreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? '7d',

  // Super Admin
  superAdminEmail: process.env['SUPER_ADMIN_EMAIL'] ?? 'superadmin@expensly.com',
  superAdminPassword: process.env['SUPER_ADMIN_PASSWORD'] as string | undefined,

  // AWS S3
  awsBucket: process.env['AWS_BUCKET'] as string | undefined,
  awsRegion: process.env['AWS_REGION'] ?? 'ap-south-1',
  awsAccessKeyId: process.env['AWS_ACCESS_KEY_ID'] as string | undefined,
  awsSecretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] as string | undefined,
};
