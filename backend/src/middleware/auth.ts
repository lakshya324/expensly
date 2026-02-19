import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';

/**
 * Reads Authorization: Bearer <token>, verifies JWT,
 * and attaches req.user = { id, role, orgId } to the request.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub as string,
      role: payload.role as 'user' | 'admin' | 'super_admin',
      orgId: payload.orgId as string | null,
    };
    next();
  } catch {
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_INVALID', message: 'Token is invalid or expired' },
    });
  }
};
