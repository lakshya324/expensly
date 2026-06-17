import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export const requestContext = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const incoming = req.header("x-request-id");
  const requestId = incoming?.trim() || randomUUID();

  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
};
