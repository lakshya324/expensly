import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  MONGODB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(10),
  SUPER_ADMIN_EMAIL: z.string().email(),
  SUPER_ADMIN_PASSWORD: z.string().min(8),
  AWS_BUCKET: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).default("ap-south-1"),
  AWS_ACCESS_KEY_ID: z.string().min(1).optional(),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_SQS_QUEUE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  OTP_EXPIRES_IN: z.coerce.number().int().min(60).max(3600).default(300),
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-nano"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = z.flattenError(parsedEnv.error).fieldErrors;
  throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
}

const env = parsedEnv.data;

const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  corsOrigin: env.CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean),

  //* MongoDB
  mongodbUri: env.MONGODB_URI,

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
      secret: env.JWT_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      expiresIn: env.JWT_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
    },
    bcryptRounds: env.BCRYPT_ROUNDS,
  },

  //* Super Admin
  superAdminConfig: {
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
  },

  //* AWS S3
  awsConfig: {
    awsBucket: env.AWS_BUCKET,
    awsRegion: env.AWS_REGION,
    awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,

    sqs: {
      queueUrl: env.AWS_SQS_QUEUE_URL,
    },
  },

  //* Redis
  redisUrl: env.REDIS_URL,

  //* Email (SMTP)
  emailConfig: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },

  //* OTP
  otpExpiresIn: env.OTP_EXPIRES_IN, // seconds

  //* OpenAI
  openai: {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
  },
};

export default config;
