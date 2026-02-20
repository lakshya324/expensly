import { Redis } from "ioredis";
import config from "./env.config.js";
import { logError, logSuccess } from "../utils/logger.js";

let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redisClient.on("error", (err: Error) => {
      logError(err, { message: "Redis client error", code: "REDIS_ERROR" });
    });

    redisClient.on("connect", () => {
      logSuccess("Connected to Redis");
    });
  }
  return redisClient;
}

export async function connectToRedis(): Promise<void> {
  const client = getRedisClient();
  await client.ping();
}

export default getRedisClient;
