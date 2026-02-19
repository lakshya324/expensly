import { AppError } from "../types/error.types.js";
import { logError } from "./logger.js";

/**
 * This function is used to create an error with a status code.
 * @param message - error message
 * @param status - status code of the error
 * @returns never - throws Error with status code
 * @throws Error with status code
 * @example
 * createError("Error message", 404);
 * // Output: Error: Error message
 * // Status Code: 404
 */
export function createError(
  message: string,
  status: number,
  code: string | number = "ERROR",
): never {
  // const error = new Error(message) as StatusError;
  // error.statusCode = status || 500;
  // throw error;
  const error = new AppError(status, message, code);
  logError(error, {
    status,
    code,
    message,
  });
  throw error;
}
