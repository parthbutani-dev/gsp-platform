import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ErrorCodes } from '@gsp/shared';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  console.error(err);
  return res.status(500).json({
    code: ErrorCodes.INTERNAL_ERROR,
    message: 'Internal server error',
  });
}
