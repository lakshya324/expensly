import { Request, Response, NextFunction } from "express";
import { validationResult, ValidationChain } from "express-validator";
import { createError } from "../utils/error.js";

/**
 * Runs express-validator chains and returns 400 on failure.
 *
 * Usage:
 *   router.post('/route', validate([
 *     body('email').isEmail(),
 *     body('password').notEmpty(),
 *   ]), handler)
 */
export const validate = (validations: ValidationChain[]) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    for (const validation of validations) {
      await validation.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty())
      createError("Validation failed", 400, "VALIDATION_ERROR", {
        details: errors.array().map((e) => ({
          field: e.type === "field" ? e.path : e.type,
          message: e.msg,
        })),
      });

    next();
  };
};
