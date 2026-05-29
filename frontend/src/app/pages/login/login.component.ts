import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Roles, loginSchema } from '@gsp/shared';
import { AuthService } from '../../core/services/auth.service';
import { zodFormGroupValidator, markFormGroupTouched } from '../../core/validation/zod-validator';
import { firstValueFrom } from 'rxjs';

const DEMO_USERS = [
  { email: 'agent@gsp.demo', label: 'Agent', role: Roles.AGENT },
  { email: 'counsellor@gsp.demo', label: 'Counsellor', role: Roles.COUNSELLOR },
  { email: 'qa@gsp.demo', label: 'QA Officer', role: Roles.QA_OFFICER },
  { email: 'admission@gsp.demo', label: 'Admission Officer', role: Roles.ADMISSION_OFFICER },
  { email: 'visa@gsp.demo', label: 'Visa Officer', role: Roles.VISA_OFFICER },
  { email: 'enrolment@gsp.demo', label: 'Enrolment Officer', role: Roles.ENROLMENT_OFFICER },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  demoUsers = DEMO_USERS;
  loading = false;
  error = '';

  form = this.fb.group(
    { email: ['', Validators.required], password: ['', Validators.required] },
    { validators: zodFormGroupValidator(loginSchema) }
  );

  async ngOnInit() {
    await this.auth.initCsrf();
  }

  quickLogin(email: string) {
    this.form.patchValue({ email, password: 'demo1234' });
    void this.submit();
  }

  async submit() {
    markFormGroupTouched(this.form);
    const parsed = loginSchema.safeParse(this.form.value);
    if (!parsed.success) return;

    this.loading = true;
    this.error = '';
    try {
      await this.auth.initCsrf();
      await firstValueFrom(this.auth.login(parsed.data));
      await this.auth.initCsrf();
      await this.router.navigate(['/']);
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.error = err.error?.message ?? 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}
