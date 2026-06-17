type LogContext = {
  message?: string;
  status?: number;
  stackTrace?: string;
  code?: string | number;
  requestId?: string;
  traceId?: string;
  jobId?: string;
  [key: string]: unknown;
};

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const statusCode = "statusCode" in error ? (error as { statusCode?: number }).statusCode : undefined;
    const code = "code" in error ? (error as { code?: string | number }).code : undefined;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      statusCode,
      code,
    };
  }
  return { value: error };
}

function writeLog(level: string, message: string, context: Record<string, unknown> = {}): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "expensly-backend",
    ...context,
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}

export function logError(
  error: unknown,
  details?: LogContext,
): void {
  writeLog("error", details?.message ?? "An error occurred", {
    ...details,
    code: details?.code ?? "ERROR",
    error: serializeError(error),
  });
}

export function logInfo(message: string, context?: LogContext): void {
  writeLog("info", message, context);
}

export function logWarn(message: string, context?: LogContext): void {
  writeLog("warn", message, context);
}

export function logDebug(message: string, context?: LogContext): void {
  writeLog("debug", message, context);
}

export function logSuccess(message: string, context?: LogContext): void {
  writeLog("info", message, { ...context, outcome: "success" });
}

export function logServiceCall(serviceName: string, details?: string): void {
  writeLog("info", "Service call", { serviceName, details });
}

export function logDatabaseQuery(query: string, params?: unknown): void {
  writeLog("debug", "Database query", { query, params });
}

export function logExternalApiCall(apiName: string, details?: string): void {
  writeLog("info", "External API call", { apiName, details });
}
