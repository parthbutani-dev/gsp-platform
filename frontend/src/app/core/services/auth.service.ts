import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, firstValueFrom } from 'rxjs';
import { loginSchema, type LoginInput } from '@gsp/shared';
import { setCsrfToken } from '../http/csrf.interceptor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  /** Bumped on login / role switch so views reload with new permissions */
  readonly sessionRevision = signal(0);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private bumpSession() {
    this.sessionRevision.update((n) => n + 1);
  }

  async initCsrf() {
    const res = await firstValueFrom(this.http.get<{ csrfToken: string }>('/api/auth/csrf'));
    setCsrfToken(res.csrfToken);
  }

  login(input: LoginInput) {
    const parsed = loginSchema.parse(input);
    return this.http
      .post<{ user: AuthUser }>('/api/auth/login', parsed)
      .pipe(
        tap((res) => {
          this.user.set(res.user);
          this.bumpSession();
        })
      );
  }

  async loadMe() {
    try {
      const res = await firstValueFrom(this.http.get<{ user: AuthUser }>('/api/auth/me'));
      this.user.set(res.user);
      return res.user;
    } catch {
      this.user.set(null);
      return null;
    }
  }

  logout() {
    return this.http.post('/api/auth/logout', {}).pipe(
      tap(() => {
        this.user.set(null);
        this.router.navigate(['/login']);
      })
    );
  }
}
