import { Component, inject } from '@angular/core';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (toast.active(); as t) {
      <div
        class="toast-container"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        [attr.data-type]="t.type"
      >
        <div class="toast-icon" aria-hidden="true">
          @switch (t.type) {
            @case ('success') {
              ✓
            }
            @case ('error') {
              !
            }
            @default {
              i
            }
          }
        </div>
        <div class="toast-body">
          <p class="toast-title">{{ t.title }}</p>
          @if (t.message) {
            <p class="toast-message">{{ t.message }}</p>
          }
        </div>
        <button type="button" class="toast-dismiss" (click)="toast.dismiss()" aria-label="Dismiss">
          ×
        </button>
      </div>
    }
  `,
  styles: `
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 100;
      display: flex;
      max-width: min(24rem, calc(100vw - 2rem));
      gap: 0.75rem;
      align-items: flex-start;
      padding: 0.875rem 1rem;
      border-radius: 0.75rem;
      border: 1px solid;
      box-shadow:
        0 10px 15px -3px rgb(0 0 0 / 0.1),
        0 4px 6px -4px rgb(0 0 0 / 0.1);
      animation: toast-in 0.2s ease-out;
    }
    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(-0.5rem);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    [data-type='success'] {
      border-color: #86efac;
      background: #f0fdf4;
      color: #14532d;
    }
    [data-type='error'] {
      border-color: #fca5a5;
      background: #fef2f2;
      color: #7f1d1d;
    }
    [data-type='info'] {
      border-color: #93c5fd;
      background: #eff6ff;
      color: #1e3a8a;
    }
    .toast-icon {
      flex-shrink: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    [data-type='success'] .toast-icon {
      background: #22c55e;
      color: white;
    }
    [data-type='error'] .toast-icon {
      background: #ef4444;
      color: white;
    }
    [data-type='info'] .toast-icon {
      background: #3b82f6;
      color: white;
    }
    .toast-body {
      flex: 1;
      min-width: 0;
    }
    .toast-title {
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.25;
    }
    .toast-message {
      margin-top: 0.25rem;
      font-size: 0.8125rem;
      line-height: 1.4;
      opacity: 0.9;
    }
    .toast-dismiss {
      flex-shrink: 0;
      border: none;
      background: transparent;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      opacity: 0.5;
      padding: 0;
      margin: -0.125rem -0.25rem 0 0;
    }
    .toast-dismiss:hover {
      opacity: 1;
    }
  `,
})
export class ToastComponent {
  readonly toast = inject(ToastService);
}
