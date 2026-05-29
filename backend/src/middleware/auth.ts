import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { type Role } from '@gsp/shared';
import { User } from '../models/User';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const COOKIE_NAME = 'gsp_access';

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    if (req.cookies?.[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } else if (env.allowHeaderAuth && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7);
    } else if (env.allowHeaderAuth && req.headers['x-user-id'] && req.headers['x-role']) {
      const user = await User.findById(req.headers['x-user-id'] as string);
      if (!user) throw unauthorized();
      req.user = {
        id: user._id.toString(),
        email: user.email,
        role: req.headers['x-role'] as Role,
        name: user.name,
      };
      return next();
    }

    if (!token) throw unauthorized();

    const payload = jwt.verify(token, env.jwtAccessSecret) as {
      sub: string;
      role: Role;
      email: string;
    };

    const user = await User.findById(payload.sub);
    if (!user) throw unauthorized();

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: payload.role,
      name: user.name,
    };
    next();
  } catch {
    next(unauthorized());
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized());
  next();
}

export { COOKIE_NAME };
