import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  getApplications() {
    return this.http.get<{ applications: unknown[] }>('/api/applications');
  }

  getApplication(id: string) {
    return this.http.get<{ application: unknown }>(`/api/applications/${id}`);
  }

  createApplication(body: unknown) {
    return this.http.post<{ application: unknown }>('/api/applications', body);
  }

  getAvailableTransitions(id: string) {
    return this.http.get<{ transitions: TransitionPreview[]; forward: TransitionPreview | null }>(
      `/api/applications/${id}/available-transitions`
    );
  }

  getAvailableActions(id: string) {
    return this.http.get<{ actions: ActionPreview[] }>(`/api/applications/${id}/available-actions`);
  }

  transition(id: string, body: { targetStage: string; reason?: string }) {
    return this.http.post<{ application: unknown }>(`/api/applications/${id}/transition`, body);
  }

  addNote(id: string, body: { body: string; internal?: boolean }) {
    return this.http.post<{ application: unknown }>(`/api/applications/${id}/notes`, body);
  }

  addTask(id: string, body: { title: string; dueDate?: string }) {
    return this.http.post<{ application: unknown }>(`/api/applications/${id}/tasks`, body);
  }

  uploadDocument(id: string, key: string, body?: { fileName?: string }) {
    return this.http.post<{ application: unknown }>(
      `/api/applications/${id}/documents/${key}/upload`,
      body ?? {}
    );
  }

  recordDecision(id: string, body: { outcome: string; conditions?: string }) {
    return this.http.post<{ application: unknown }>(`/api/applications/${id}/decision`, body);
  }

  executeAction(id: string, type: string, body: unknown) {
    return this.http.post<{ application: unknown }>(
      `/api/applications/${id}/actions/${type}`,
      body
    );
  }

  getAiAssessment(id: string, stage?: string, refresh = false) {
    const params = new URLSearchParams();
    if (stage) params.set('stage', stage);
    if (refresh) params.set('refresh', 'true');
    const q = params.toString() ? `?${params}` : '';
    return this.http.get<{ assessment: unknown }>(`/api/applications/${id}/ai-assessment${q}`);
  }

  saveReviewNote(id: string, reviewNote: string) {
    return this.http.patch<{ application: unknown }>(`/api/applications/${id}/review-note`, {
      reviewNote,
    });
  }

  updateTask(appId: string, taskId: string, completed: boolean) {
    return this.http.patch<{ application: unknown }>(
      `/api/applications/${appId}/tasks/${taskId}`,
      { completed }
    );
  }
}

export interface TransitionPreview {
  to: string;
  label: string;
  allowed: boolean;
  reasons: string[];
  allowedRoleLabels?: string[];
}

export interface ActionPreview {
  type: string;
  label: string;
  destructive: boolean;
}
