export class AppError extends Error {
  statusCode: number;
  code: string | number;

  constructor(statusCode: number, message: string, code: string | number = 'ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    // Maintains proper stack trace for where error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
