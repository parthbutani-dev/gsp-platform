import { Component, effect, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Roles } from '@gsp/shared';
import { ToastComponent } from '../core/components/toast.component';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { firstValueFrom } from 'rxjs';

const ROLE_SWITCHER = [
  { email: 'agent@gsp.demo', label: 'Agent', role: Roles.AGENT },
  { email: 'counsellor@gsp.demo', label: 'Counsellor', role: Roles.COUNSELLOR },
  { email: 'qa@gsp.demo', label: 'QA', role: Roles.QA_OFFICER },
  { email: 'admission@gsp.demo', label: 'Admissions', role: Roles.ADMISSION_OFFICER },
  { email: 'visa@gsp.demo', label: 'Visa', role: Roles.VISA_OFFICER },
  { email: 'enrolment@gsp.demo', label: 'Enrolment', role: Roles.ENROLMENT_OFFICER },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastComponent, FormsModule],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  roles = ROLE_SWITCHER;
  switching = signal(false);
  /** Keeps role dropdown in sync with auth ([value] on select does not update in Angular) */
  selectedRoleEmail = signal('');

  constructor(
    public auth: AuthService,
    private toast: ToastService
  ) {
    effect(() => {
      const email = this.auth.user()?.email;
      if (email && !this.switching()) {
        this.selectedRoleEmail.set(email);
      }
    });
  }

  canCreateApplication() {
    const role = this.auth.user()?.role;
    return role === Roles.AGENT || role === Roles.COUNSELLOR;
  }

  onRoleSelect(email: string) {
    if (this.auth.user()?.email === email) return;
    this.selectedRoleEmail.set(email);
    void this.switchRole(email);
  }

  async switchRole(email: string) {
    if (this.auth.user()?.email === email) return;
    this.switching.set(true);
    try {
      await this.auth.initCsrf();
      await firstValueFrom(this.auth.login({ email, password: 'demo1234' }));
      await this.auth.loadMe();
      await this.auth.initCsrf();
      this.selectedRoleEmail.set(this.auth.user()?.email ?? email);
      const label = this.roles.find((r) => r.email === email)?.label ?? 'user';
      this.toast.success('Signed in', `You are now viewing as ${label}.`);
    } catch {
      this.selectedRoleEmail.set(this.auth.user()?.email ?? '');
      this.toast.error('Role switch failed', 'Could not sign in as that user. Please try again.');
    } finally {
      this.switching.set(false);
    }
  }

  async logout() {
    await firstValueFrom(this.auth.logout());
  }
}
