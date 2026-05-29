import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AppError } from '../utils/errors';
import { ErrorCodes } from '@gsp/shared';

const CSRF_COOKIE = 'gsp_csrf';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(_req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: envCookieSecure(),
    path: '/',
  });
  res.json({ csrfToken: token });
}

function envCookieSecure() {
  return process.env.COOKIE_SECURE === 'true';
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!mutating) return next();

  if (req.path.startsWith('/api/auth/login') || req.path.startsWith('/api/auth/seed')) {
    return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(new AppError(403, ErrorCodes.CSRF_INVALID, 'Invalid or missing CSRF token'));
  }
  next();
}

export { CSRF_COOKIE, CSRF_HEADER };
