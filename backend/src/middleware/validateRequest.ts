import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { validationError } from '../utils/errors';

type Source = 'body' | 'params' | 'query';

export function validateRequest(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      return next(validationError(errors));
    }
    req[source] = result.data;
    next();
  };
}

export function formatZodErrors(error: ZodError) {
  return error.errors.map((e) => ({
    path: e.path.join('.'),
    message: e.message,
    code: e.code,
  }));
}
