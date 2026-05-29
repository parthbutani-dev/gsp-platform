import { AbstractControl, FormArray, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ZodSchema } from 'zod';

export function zodValidator(schema: ZodSchema): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    const result = schema.safeParse(value);
    if (result.success) return null;
    const messages = result.error.errors.map((e) => e.message).join('; ');
    return { zod: messages };
  };
}

export function zodFormGroupValidator(schema: ZodSchema): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const result = schema.safeParse(control.value);
    if (result.success) return null;
    return {
      zod: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '),
    };
  };
}

export function markFormGroupTouched(group: {
  controls: Record<string, { markAsTouched: () => void }>;
}) {
  Object.values(group.controls).forEach((c) => c.markAsTouched());
}

/** Marks the control and every nested control as touched (for submit validation UX). */
export function markAllControlsTouched(control: AbstractControl): void {
  control.markAsTouched({ onlySelf: true });
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach(markAllControlsTouched);
  } else if (control instanceof FormArray) {
    control.controls.forEach(markAllControlsTouched);
  }
}

export function getControlErrorMessage(control: AbstractControl | null): string | null {
  if (!control?.errors) return null;
  if (control.errors['zod']) return String(control.errors['zod']);
  if (control.errors['required']) return 'This field is required';
  if (control.errors['server']) return String(control.errors['server']);
  return null;
}

function clearZodErrors(control: AbstractControl): void {
  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach(clearZodErrors);
  } else if (control instanceof FormArray) {
    control.controls.forEach(clearZodErrors);
  } else if (control.errors?.['zod']) {
    const { zod: _, ...rest } = control.errors;
    control.setErrors(Object.keys(rest).length ? rest : null);
  }
}

/** Maps Zod issue paths onto form controls. Returns true when the value is valid. */
export function applyZodErrorsToForm(control: AbstractControl, schema: ZodSchema): boolean {
  clearZodErrors(control);
  const result = schema.safeParse(control.value);
  if (result.success) return true;

  for (const issue of result.error.errors) {
    const path = issue.path.map(String).join('.');
    const field = control.get(path);
    if (field) {
      field.setErrors({ ...field.errors, zod: issue.message });
      field.markAsTouched();
    }
  }
  return false;
}

export function showControlError(control: AbstractControl | null, submitted: boolean): boolean {
  if (!control) return false;
  return (submitted || control.touched) && control.invalid;
}

export function mapApiValidationErrors(
  form: { get: (path: string) => AbstractControl | null },
  errors: { path: string; message: string }[]
) {
  for (const e of errors) {
    const control = form.get(e.path);
    if (control) {
      control.setErrors({ server: e.message });
    }
  }
}
