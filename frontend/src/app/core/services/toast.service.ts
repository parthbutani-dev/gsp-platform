import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly active = signal<Toast | null>(null);

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(toast: Omit<Toast, 'id'>, durationMs = 5500) {
    if (this.timer) clearTimeout(this.timer);
    const entry: Toast = { ...toast, id: ++this.seq };
    this.active.set(entry);
    this.timer = setTimeout(() => this.dismiss(), durationMs);
  }

  success(title: string, message?: string) {
    this.show({ type: 'success', title, message });
  }

  error(title: string, message?: string) {
    this.show({ type: 'error', title, message }, 7000);
  }

  info(title: string, message?: string) {
    this.show({ type: 'info', title, message });
  }

  dismiss() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.active.set(null);
  }
}
