import { AppError } from "../types/error.types.js";
import { logError } from "./logger.js";

/**
 * This function is used to create an error with a status code.
 * @param message - error message
 * @param status - status code of the error
 * @param code - optional error code for better identification (default: "ERROR")
 * @returns never - throws Error with status code
 * @throws Error with status code and custom error code
 * @example
 * createError("Error message", 404);
 * // Output: Error: Error message
 * // Status Code: 404
 * createError("Validation failed", 400, "VALIDATION_ERROR");
 * // Output: Error: Validation failed
 * // Status Code: 400
 * // Error Code: VALIDATION_ERROR
 */
export function createError(
  message: string,
  status: number = 500,
  code: string | number = "ERROR",
  details?: any,
): never {
  // const error = new Error(message) as StatusError;
  // error.statusCode = status || 500;
  // throw error;
  const error = new AppError(status, message, code, details);
  if (code === "ERROR" && status >= 500)
    logError(error, {
      status,
      code,
      message,
      details,
    });

  throw error;
}
