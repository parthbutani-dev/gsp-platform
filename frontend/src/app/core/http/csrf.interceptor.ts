import { HttpInterceptorFn } from '@angular/common/http';

const CSRF_COOKIE = 'gsp_csrf';

let csrfToken: string | null = null;

export function setCsrfToken(token: string) {
  csrfToken = token;
}

/** Read double-submit cookie when in-memory token was cleared (e.g. page refresh). */
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function resolveCsrfToken(): string | null {
  if (csrfToken) return csrfToken;
  const fromCookie = getCsrfTokenFromCookie();
  if (fromCookie) {
    csrfToken = fromCookie;
  }
  return csrfToken;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const token = mutating ? resolveCsrfToken() : null;
  if (token) {
    return next(
      req.clone({
        setHeaders: { 'X-CSRF-Token': token },
      })
    );
  }
  return next(req);
};
