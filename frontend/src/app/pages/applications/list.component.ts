import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { firstValueFrom } from 'rxjs';

export interface ApplicationListItem {
  id: string;
  studentName: string;
  currentStage?: string;
  statusLabel?: string;
  status?: string;
  course?: string;
  university?: string;
}

@Component({
  selector: 'app-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './list.component.html',
})
export class ListComponent {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  apps = signal<ApplicationListItem[]>([]);
  loading = signal(true);
  private lastLoadedRevision = -1;

  constructor() {
    effect(() => {
      this.auth.sessionRevision();
      const revision = this.auth.sessionRevision();
      if (revision === this.lastLoadedRevision) return;
      this.lastLoadedRevision = revision;
      void this.loadApplications();
    });
  }

  private async loadApplications() {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.getApplications());
      this.apps.set(res.applications as ApplicationListItem[]);
    } finally {
      this.loading.set(false);
    }
  }
}
