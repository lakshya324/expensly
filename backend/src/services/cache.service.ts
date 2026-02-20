import getRedisClient from "../config/redis.config.js";
import { logError } from "../utils/logger.js";

/**
 * Get a JSON-deserialized value from Redis.
 * Returns null on miss or parse error.
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await getRedisClient().get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logError(err, { message: "Cache getJSON error", code: "CACHE_GET_ERROR", key });
    return null;
  }
}

/**
 * Store a JSON-serializable value in Redis.
 * @param ttlSeconds Optional TTL in seconds. Omit for no expiry.
 */
export async function setJSON<T>(
  key: string,
  value: T,
  ttlSeconds: number = 60, // 1 minute default
): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await getRedisClient().set(key, serialized, "EX", ttlSeconds);
    } else {
      await getRedisClient().set(key, serialized);
    }
  } catch (err) {
    logError(err, { message: "Cache setJSON error", code: "CACHE_SET_ERROR", key });
  }
}

/**
 * Delete one or more keys from Redis.
 */
export async function del(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await getRedisClient().del(...keys);
  } catch (err) {
    logError(err, { message: "Cache del error", code: "CACHE_DEL_ERROR", keys });
  }
}

/**
 * Store a raw string value with a mandatory TTL.
 */
export async function setString(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    await getRedisClient().set(key, value, "EX", ttlSeconds);
  } catch (err) {
    logError(err, { message: "Cache setString error", code: "CACHE_SET_ERROR", key });
  }
}

/**
 * Get a raw string value from Redis.
 */
export async function getString(key: string): Promise<string | null> {
  try {
    return await getRedisClient().get(key);
  } catch (err) {
    logError(err, { message: "Cache getString error", code: "CACHE_GET_ERROR", key });
    return null;
  }
}

/**
 * Delete all keys matching a pattern.
 * Uses SCAN to avoid blocking the Redis server.
 */
export async function delByPattern(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    let cursor = "0";
    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) await client.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    logError(err, { message: "Cache delByPattern error", code: "CACHE_DEL_ERROR", pattern });
  }
}
