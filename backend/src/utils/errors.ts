import { ErrorCodes, type ErrorCode } from '@gsp/shared';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function validationError(errors: { path: string; message: string; code?: string }[]) {
  return new AppError(400, ErrorCodes.VALIDATION_ERROR, 'Request validation failed', {
    errors,
  });
}

export function businessRuleError(message: string, missing?: string[]) {
  return new AppError(422, ErrorCodes.BUSINESS_RULE_FAILED, message, { missing });
}

export function forbidden(message = 'Forbidden') {
  return new AppError(403, ErrorCodes.FORBIDDEN, message);
}

export function notFound(message = 'Not found') {
  return new AppError(404, ErrorCodes.NOT_FOUND, message);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(401, ErrorCodes.UNAUTHORIZED, message);
}
