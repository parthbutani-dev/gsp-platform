import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EntryPoints, Roles, createApplicationSchema } from '@gsp/shared';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import {
  applyZodErrorsToForm,
  getControlErrorMessage,
  markAllControlsTouched,
  showControlError,
} from '../../core/validation/zod-validator';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-create',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './create.component.html',
})
export class CreateComponent {
  private fb = inject(FormBuilder);
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);

  private lastCheckedRevision = -1;

  constructor() {
    effect(() => {
      this.auth.sessionRevision();
      const revision = this.auth.sessionRevision();
      if (revision === this.lastCheckedRevision) return;
      this.lastCheckedRevision = revision;
      const role = this.auth.user()?.role;
      if (role && role !== Roles.AGENT && role !== Roles.COUNSELLOR) {
        void this.router.navigate(['/']);
      }
    });
  }

  readonly EntryPoints = EntryPoints;
  readonly intakeMonths = [
    { value: '01', label: 'January' },
    { value: '02', label: 'February' },
    { value: '03', label: 'March' },
    { value: '04', label: 'April' },
    { value: '05', label: 'May' },
    { value: '06', label: 'June' },
    { value: '07', label: 'July' },
    { value: '08', label: 'August' },
    { value: '09', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ] as const;
  readonly intakeYears = this.buildIntakeYears();
  loading = false;
  error = '';
  submitted = false;

  isOfferExistsEntry() {
    return String(this.form.value.entryPoint) === EntryPoints.OFFER_EXISTS;
  }

  form = this.fb.group(
    {
      student: this.fb.group({
        firstName: ['', Validators.required],
        lastName: ['', Validators.required],
        email: ['', Validators.required],
        dateOfBirth: ['', Validators.required],
        nationality: ['', Validators.required],
      }),
      course: this.fb.group({
        name: ['', Validators.required],
        level: ['undergraduate', Validators.required],
      }),
      university: this.fb.group({ name: ['', Validators.required] }),
      intakeMonth: ['', Validators.required],
      intakeYear: ['', Validators.required],
      intake: [''],
      entryPoint: [EntryPoints.STANDARD],
      offerDetails: [''],
    }
  );

  fieldError(path: string): string | null {
    return getControlErrorMessage(this.form.get(path));
  }

  showFieldError(path: string): boolean {
    return showControlError(this.form.get(path), this.submitted);
  }

  showIntakeError(): boolean {
    return (
      this.showFieldError('intakeMonth') ||
      this.showFieldError('intakeYear') ||
      this.showFieldError('intake')
    );
  }

  intakeFieldError(): string | null {
    return (
      this.fieldError('intakeMonth') ??
      this.fieldError('intakeYear') ??
      this.fieldError('intake')
    );
  }

  async submit() {
    this.submitted = true;
    this.syncIntakeFromPickers();
    markAllControlsTouched(this.form);
    if (!applyZodErrorsToForm(this.form, createApplicationSchema)) return;

    const parsed = createApplicationSchema.safeParse(this.form.value);
    if (!parsed.success) return;

    this.loading = true;
    this.error = '';
    try {
      const { entryPoint, offerDetails, ...rest } = parsed.data;
      const body = {
        ...rest,
        student: {
          ...parsed.data.student,
          dateOfBirth: this.formatDate(parsed.data.student.dateOfBirth),
        },
        entryPoint: entryPoint ?? EntryPoints.STANDARD,
        ...(entryPoint === EntryPoints.OFFER_EXISTS && offerDetails
          ? { offerDetails }
          : {}),
      };
      const res = await firstValueFrom(this.api.createApplication(body));
      const app = res.application as { id: string };
      await this.router.navigate(['/applications', app.id]);
    } catch (e: unknown) {
      const err = e as { error?: { message?: string } };
      this.error = err.error?.message ?? 'Failed to create';
    } finally {
      this.loading = false;
    }
  }

  private formatDate(v: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    return v.slice(0, 10);
  }

  private buildIntakeYears(): number[] {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - 1 + i);
  }

  private syncIntakeFromPickers(): void {
    const month = this.form.get('intakeMonth')?.value;
    const year = this.form.get('intakeYear')?.value;
    const intake =
      month && year ? `${year}-${month}` : '';
    this.form.patchValue({ intake }, { emitEvent: false });
  }
}
