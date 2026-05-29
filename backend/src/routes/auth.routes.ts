import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { loginSchema } from '@gsp/shared';
import { User } from '../models/User';
import { validateRequest } from '../middleware/validateRequest';
import { issueCsrfToken } from '../middleware/csrf';
import { authenticate, COOKIE_NAME, requireAuth } from '../middleware/auth';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { code: 'RATE_LIMIT', message: 'Too many login attempts' },
});

router.get('/csrf', issueCsrfToken);

router.post('/login', loginLimiter, validateRequest(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) throw unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw unauthorized('Invalid credentials');

    const token = jwt.sign(
      { sub: user._id.toString(), role: user.role, email: user.email },
      env.jwtAccessSecret,
      { expiresIn: env.jwtAccessExpires as jwt.SignOptions['expiresIn'], issuer: 'gsp' }
    );

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: 'lax',
      path: '/api',
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/api' });
  res.json({ message: 'Logged out' });
});

router.get(
  '/me',
  authenticate,
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await User.findById(req.user!.id).select('-passwordHash');
      if (!user) throw unauthorized();
      res.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;
