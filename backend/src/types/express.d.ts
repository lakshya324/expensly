import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'user' | 'admin' | 'super_admin';
        orgId: string | null;
      };
    }
  }
}
