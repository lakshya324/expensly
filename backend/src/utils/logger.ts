export function logError(
  error: unknown,
  details?: {
    message?: string;
    status?: number;
    stackTrace?: string;
    code?: string | number;
    [key: string]: any; // Allow additional fields
  },
): void {
  let message: string = (details?.message || "An error occurred") + ": ";
  let statusCode: number = details?.status || 500;
  let stackTrace: string | undefined = details?.stackTrace;
  let code: string | number = details?.code || "ERROR";

  if (error instanceof Error) {
    message += error.message;
    statusCode = (error as any).statusCode || statusCode;
    stackTrace = error.stack;
  } else if (typeof error === "string") {
    message += error;
  } else if (typeof error === "object" && error !== null) {
    message += JSON.stringify(error);
  } else {
    message += "An unknown error occurred";
  }

  console.error(
    `\x1b[31m[ERROR]\x1b[0m ${code.toString().toUpperCase()} - ${message}${statusCode ? ` (Status: ${statusCode})` : ""}${stackTrace ? ` - Stack Trace: ${stackTrace}` : ""} ${Object.keys(details || {}).length > 0 ? ` - Details: ${JSON.stringify(details)}` : ""}`,
  );
}

export function logInfo(message: string): void {
  console.log(`\x1b[36m[INFO]\x1b[0m ${message}`);
}

export function logWarn(message: string): void {
  console.warn(`\x1b[33m[WARN]\x1b[0m ${message}`);
}

// TODO: Use these additional log types in services and controllers for better traceability and debugging
export function logDebug(message: string): void {
  console.debug(`\x1b[34m[DEBUG]\x1b[0m ${message}`);
}

export function logSuccess(message: string): void {
  console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`);
}

export function logServiceCall(serviceName: string, details?: string): void {
  console.log(
    `\x1b[35m[SERVICE CALL]\x1b[0m ${serviceName}${details ? ` - ${details}` : ""}`,
  );
}

export function logDatabaseQuery(query: string, params?: any): void {
  console.log(
    `\x1b[36m[DB QUERY]\x1b[0m ${query}${params ? ` - Params: ${JSON.stringify(params)}` : ""}`,
  );
}

export function logExternalApiCall(apiName: string, details?: string): void {
  console.log(
    `\x1b[35m[EXTERNAL API]\x1b[0m ${apiName}${details ? ` - ${details}` : ""}`,
  );
}
