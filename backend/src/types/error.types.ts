export class AppError extends Error {
  statusCode: number;
  code: string | number;
  details?: any;

  constructor(
    statusCode: number,
    message: string,
    code: string | number = "ERROR",
    details?: any,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
