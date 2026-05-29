import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { getCsrfTokenFromCookie, setCsrfToken } from '../http/csrf.interceptor';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.user()) {
    const user = await auth.loadMe();
    if (!user) return router.createUrlTree(['/login']);
  }

  const cookieToken = getCsrfTokenFromCookie();
  if (cookieToken) {
    setCsrfToken(cookieToken);
  } else {
    await auth.initCsrf();
  }

  return true;
};
