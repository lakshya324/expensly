import { Request, Response, NextFunction } from 'express';
import type { Role } from '../config/constants.js';

/**
 * authorize(...roles) — middleware factory.
 * Must be used after authenticate.
 *
 * Usage: router.get('/route', authenticate, authorize('admin', 'super_admin'), handler)
 */
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${roles.join(' or ')}`,
        },
      });
      return;
    }

    next();
  };
};
