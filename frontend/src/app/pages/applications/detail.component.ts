import { Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PIPELINE_STAGES, Roles, Stages } from '@gsp/shared';
import { ApiService, ActionPreview, TransitionPreview } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { STAGE_LABELS } from '../../core/stage-labels';
import { firstValueFrom } from 'rxjs';
import type { ActionDialogState } from './action-dialog.types';

interface ApplicationDetail {
  id?: string;
  currentStage?: string;
  status?: string;
  statusLabel?: string;
  statusSummary?: string;
  progress?: {
    steps: { stage: string; label: string; state: 'completed' | 'current' | 'upcoming' }[];
    currentStepNumber: number;
    totalSteps: number;
    completedCount: number;
    remainingCount: number;
    terminalLabel?: string;
  };
  suggestions?: string[];
  reviewNote?: string;
  student?: { firstName: string; lastName: string };
  studentName?: string;
  course?: { name: string };
  university?: { name: string };
  requiredDocuments?: { key: string; label: string; uploaded: boolean }[];
  notes?: { id?: string; body: string; internal?: boolean; createdAt?: string }[];
  attachments?: { id?: string; fileName: string; description?: string; createdAt?: string }[];
  tasks?: { id?: string; title: string; completed: boolean; createdAt?: string }[];
  decisionOutcome?: string;
  stageHistory?: { from: string; to: string; at: string; reason?: string; skipped?: boolean }[];
  aiAssessment?: {
    status?: string;
    errorMessage?: string;
    result?: {
      recommendation?: string;
      readinessScore?: number;
      summary?: string;
      flags?: string[];
      missingDocuments?: string[];
      risks?: string[];
    };
  };
}

@Component({
  selector: 'app-detail',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, DatePipe],
  templateUrl: './detail.component.html',
})
export class DetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private fb = inject(FormBuilder);

  readonly pipelineStages = PIPELINE_STAGES;
  readonly stageLabels = STAGE_LABELS;

  app = signal<ApplicationDetail | null>(null);
  transitions = signal<TransitionPreview[]>([]);
  forward = signal<TransitionPreview | null>(null);
  actions = signal<ActionPreview[]>([]);
  /** Full-page load — initial visit only */
  loading = signal(true);
  transitioning = signal(false);
  refreshingAi = signal(false);
  /** Disables contextual action buttons while a request is in flight */
  busyAction = signal(false);
  /** From available-actions; section UI owns add attachment/task (not contextual bar) */
  canAddAttachment = signal(false);
  canAddTask = signal(false);
  actionDialog = signal<ActionDialogState | null>(null);
  dialogSubmitting = signal(false);

  readonly deferIntakeMonths = [
    { value: '01', label: 'January' },
    { value: '09', label: 'September' },
  ] as const;
  readonly deferIntakeYears = Array.from({ length: 2040 - 2024 + 1 }, (_, i) => 2024 + i);
  readonly courseLevels = [
    { value: 'undergraduate', label: 'Undergraduate' },
    { value: 'postgraduate', label: 'Postgraduate' },
    { value: 'foundation', label: 'Foundation' },
  ] as const;

  /** Shown in dedicated sections instead of the contextual actions bar */
  private static readonly SECTION_OWNED_ACTIONS = new Set([
    'ADD_NOTE',
    'ADD_ATTACHMENT',
    'ADD_TASK',
  ]);

  noteForm = this.fb.group({ body: [''], internal: [false] });
  reviewNoteForm = this.fb.group({ reviewNote: [''] });
  deferForm = this.fb.group({
    deferredIntakeYear: [new Date().getFullYear() + 1, Validators.required],
    intakeMonth: ['09', Validators.required],
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
  });
  reasonForm = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
  });
  changeCourseForm = this.fb.group({
    courseName: ['', [Validators.required, Validators.maxLength(200)]],
    courseLevel: ['postgraduate', Validators.required],
    universityName: ['', Validators.maxLength(200)],
    reason: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
  });
  attachmentForm = this.fb.group({
    fileName: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', Validators.maxLength(500)],
  });
  taskForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
  });
  decisionConditionsForm = this.fb.group({
    conditions: ['', Validators.maxLength(1000)],
  });

  private lastLoadedRevision = -1;

  constructor() {
    effect(() => {
      this.auth.sessionRevision();
      const revision = this.auth.sessionRevision();
      if (revision === this.lastLoadedRevision) return;
      this.lastLoadedRevision = revision;
      void this.loadInitial();
    });
  }

  private applicationId(): string {
    return this.app()?.id ?? this.route.snapshot.paramMap.get('id')!;
  }

  isAgent() {
    return this.auth.user()?.role === Roles.AGENT;
  }

  showAi() {
    if (this.isAgent()) return false;
    const stage = this.app()?.currentStage;
    return stage === Stages.QA_REVIEW || stage === Stages.APP_REVIEW;
  }

  private studentDisplayName(): string {
    return this.studentName();
  }

  labelStage(stage: string): string {
    return this.stageLabels[stage] ?? stage;
  }

  private stageLabel(stage?: string): string {
    const s = stage ?? this.app()?.currentStage ?? '';
    return this.stageLabels[s] ?? s;
  }

  private apiErrorMessage(e: unknown, fallback: string): string {
    const err = e as { error?: { message?: string } };
    return err.error?.message ?? fallback;
  }

  showReviewNote() {
    const role = this.auth.user()?.role;
    return (
      !this.isAgent() &&
      role === Roles.ADMISSION_OFFICER &&
      this.app()?.currentStage === Stages.APP_REVIEW
    );
  }

  showDecisionForm() {
    const role = this.auth.user()?.role;
    return (
      !this.isAgent() &&
      role === Roles.ADMISSION_OFFICER &&
      this.app()?.currentStage === Stages.DECISION
    );
  }

  /** Apply API payload without clearing the page */
  private applyApplication(application: ApplicationDetail) {
    this.app.set(application);
    if (application.reviewNote !== undefined) {
      this.reviewNoteForm.patchValue(
        { reviewNote: application.reviewNote ?? '' },
        { emitEvent: false }
      );
    }
  }

  private async refreshWorkflow() {
    if (this.isAgent()) return;
    const id = this.applicationId();
    const [tr, ac] = await Promise.all([
      firstValueFrom(this.api.getAvailableTransitions(id)),
      firstValueFrom(this.api.getAvailableActions(id)),
    ]);
    this.transitions.set(tr.transitions);
    this.forward.set(tr.forward);
    this.canAddAttachment.set(ac.actions.some((a) => a.type === 'ADD_ATTACHMENT'));
    this.canAddTask.set(ac.actions.some((a) => a.type === 'ADD_TASK'));
    this.actions.set(
      ac.actions.filter((a) => !DetailComponent.SECTION_OWNED_ACTIONS.has(a.type))
    );
  }

  showAddAttachment() {
    return this.isAgent() || this.canAddAttachment();
  }

  showAddTask() {
    return this.canAddTask();
  }

  /**
   * Silent update after a mutation — uses response body; no full-page loading.
   */
  private async patchFromResponse(
    res: { application: unknown },
    options: { workflow?: boolean; ai?: boolean } = {}
  ) {
    const prevStage = this.app()?.currentStage;
    this.applyApplication(res.application as ApplicationDetail);
    const app = this.app()!;

    if (options.workflow !== false && !this.isAgent()) {
      await this.refreshWorkflow();
    }

    const stageChanged = prevStage !== app.currentStage;
    if (options.ai && stageChanged && this.showAi()) {
      void this.loadAi(this.applicationId(), false);
    }
  }

  private clearWorkflowState() {
    this.transitions.set([]);
    this.forward.set(null);
    this.actions.set([]);
    this.canAddAttachment.set(false);
    this.canAddTask.set(false);
  }

  async loadInitial() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loading.set(true);
    try {
      const res = await firstValueFrom(this.api.getApplication(id));
      this.applyApplication(res.application as ApplicationDetail);
      if (this.isAgent()) {
        this.clearWorkflowState();
        this.noteForm.patchValue({ internal: false }, { emitEvent: false });
      } else {
        await this.refreshWorkflow();
        const app = this.app()!;
        if (this.showAi() && !app.aiAssessment) {
          await this.loadAi(id, false);
        }
      }
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse && (e.status === 403 || e.status === 404)) {
        this.toast.info(
          'Application not available',
          'This role cannot access that application. Showing your applications list.'
        );
        await this.router.navigate(['/']);
        return;
      }
      this.toast.error(
        'Could not load application',
        this.apiErrorMessage(e, 'Please try again.')
      );
    } finally {
      this.loading.set(false);
    }
  }

  async loadAi(id: string, refresh: boolean) {
    this.refreshingAi.set(refresh);
    try {
      const aiRes = await firstValueFrom(
        this.api.getAiAssessment(id, this.app()?.currentStage, refresh)
      );
      const assessment = aiRes.assessment as ApplicationDetail['aiAssessment'];
      this.app.update((a) => (a ? { ...a, aiAssessment: assessment } : a));
      if (assessment?.status === 'pending') {
        setTimeout(() => void this.pollAi(id), 1500);
      }
    } finally {
      this.refreshingAi.set(false);
    }
  }

  async pollAi(id: string) {
    const aiRes = await firstValueFrom(this.api.getAiAssessment(id, this.app()?.currentStage));
    const assessment = aiRes.assessment as ApplicationDetail['aiAssessment'];
    this.app.update((a) => (a ? { ...a, aiAssessment: assessment } : a));
    if (assessment?.status === 'pending') {
      setTimeout(() => void this.pollAi(id), 1500);
    }
  }

  async advanceStage() {
    const t = this.forward();
    if (!t) return;
    if (!t.allowed) {
      this.toast.error('Cannot advance stage', t.reasons.join(' '));
      return;
    }
    this.transitioning.set(true);
    try {
      const res = await firstValueFrom(
        this.api.transition(this.applicationId(), { targetStage: t.to })
      );
      await this.patchFromResponse(res, { workflow: true, ai: true });
      this.toast.success(
        `Moved to ${t.label}`,
        `${this.studentDisplayName()} is now at ${this.stageLabel()}.`
      );
    } catch (e: unknown) {
      this.toast.error('Stage transition failed', this.apiErrorMessage(e, 'Please try again.'));
    } finally {
      this.transitioning.set(false);
    }
  }

  async saveReviewNote() {
    const reviewNote = this.reviewNoteForm.value.reviewNote?.trim();
    if (!reviewNote) return;
    try {
      const res = await firstValueFrom(
        this.api.saveReviewNote(this.applicationId(), reviewNote)
      );
      await this.patchFromResponse(res, { workflow: true });
      this.toast.success(
        'Review note saved',
        'You can now advance to Decision when ready.'
      );
    } catch (e: unknown) {
      this.toast.error('Could not save review note', this.apiErrorMessage(e, 'Please try again.'));
    }
  }

  async uploadDoc(key: string) {
    const label =
      this.app()?.requiredDocuments?.find((d) => d.key === key)?.label ?? 'Document';
    try {
      const res = await firstValueFrom(
        this.api.uploadDocument(this.applicationId(), key, {})
      );
      await this.patchFromResponse(res, { workflow: true });
      const uploaded =
        res.application as ApplicationDetail;
      const remaining =
        uploaded.requiredDocuments?.filter((d) => !d.uploaded).length ?? 0;
      const detail =
        remaining === 0
          ? 'All required documents are now on file.'
          : `${remaining} required document(s) still outstanding.`;
      this.toast.success(`${label} marked as uploaded`, detail);
    } catch (e: unknown) {
      this.toast.error(`Could not upload ${label}`, this.apiErrorMessage(e, 'Please try again.'));
    }
  }

  async addNote() {
    const body = this.noteForm.value.body?.trim();
    if (!body) return;
    try {
      const res = await firstValueFrom(
        this.api.addNote(this.applicationId(), {
          body,
          internal: this.noteForm.value.internal ?? false,
        })
      );
      const internal = this.noteForm.value.internal ?? false;
      this.noteForm.reset({ body: '', internal: false });
      await this.patchFromResponse(res, { workflow: false });
      this.toast.success(
        internal ? 'Internal note added' : 'Note added',
        internal
          ? 'Visible to staff only — not shown to agents.'
          : 'Visible on this application record.'
      );
    } catch (e: unknown) {
      this.toast.error('Could not add note', this.apiErrorMessage(e, 'Please try again.'));
    }
  }

  async addAttachment() {
    this.attachmentForm.reset({ fileName: '', description: '' });
    this.actionDialog.set({ mode: 'attachment', title: 'Add attachment', reasonMinLength: 0, reasonLabel: '' });
  }

  async addTask() {
    this.taskForm.reset({ title: '' });
    this.actionDialog.set({ mode: 'task', title: 'Add task', reasonMinLength: 0, reasonLabel: '' });
  }

  async toggleTask(taskId: string, completed: boolean) {
    const prev = this.app()?.tasks;
    if (prev) {
      this.app.update((a) =>
        a
          ? {
              ...a,
              tasks: prev.map((t) => (t.id === taskId ? { ...t, completed } : t)),
            }
          : a
      );
    }
    try {
      const res = await firstValueFrom(
        this.api.updateTask(this.applicationId(), taskId, completed)
      );
      await this.patchFromResponse(res, { workflow: false });
      const task = prev?.find((t) => t.id === taskId);
      this.toast.info(
        completed ? 'Task completed' : 'Task reopened',
        task?.title ? `"${task.title}" was updated.` : undefined
      );
    } catch (e: unknown) {
      if (prev) {
        this.app.update((a) => (a ? { ...a, tasks: prev } : a));
      }
      this.toast.error('Could not update task', this.apiErrorMessage(e, 'Please try again.'));
    }
  }

  recordDecision(outcome: string) {
    if (outcome === 'conditional') {
      this.decisionConditionsForm.reset({ conditions: '' });
      this.actionDialog.set({
        mode: 'decision_conditions',
        title: 'Conditional offer — conditions',
        decisionOutcome: outcome,
        reasonMinLength: 0,
        reasonLabel: '',
      });
      return;
    }
    void this.submitDecision(outcome);
  }

  private async submitDecision(outcome: string, conditions?: string) {
    try {
      const res = await firstValueFrom(
        this.api.recordDecision(this.applicationId(), {
          outcome,
          conditions: conditions?.trim() || undefined,
        })
      );
      await this.patchFromResponse(res, { workflow: true });
      const labels: Record<string, string> = {
        unconditional: 'Unconditional offer',
        conditional: 'Conditional offer',
        rejected: 'Rejected by university',
      };
      this.toast.success(
        'Decision recorded',
        `${labels[outcome] ?? outcome} — you can advance to Deposit when ready.`
      );
    } catch (e: unknown) {
      this.toast.error('Could not record decision', this.apiErrorMessage(e, 'Please try again.'));
    }
  }

  closeActionDialog() {
    if (this.dialogSubmitting()) return;
    this.actionDialog.set(null);
  }

  private reasonMinForAction(type: string): number {
    return type === 'APP_REJECTED' ? 10 : 5;
  }

  runAction(a: ActionPreview) {
    if (a.type === 'DEFER') {
      this.deferForm.reset({
        deferredIntakeYear: new Date().getFullYear() + 1,
        intakeMonth: '09',
        reason: '',
      });
      this.actionDialog.set({
        mode: 'defer',
        action: a,
        title: a.label,
        reasonMinLength: 10,
        reasonLabel: 'Reason for deferral',
      });
      return;
    }
    if (a.type === 'CHANGE_COURSE') {
      this.changeCourseForm.reset({
        courseName: this.app()?.course?.name ?? '',
        courseLevel: 'postgraduate',
        universityName: this.app()?.university?.name ?? '',
        reason: '',
      });
      this.actionDialog.set({
        mode: 'change_course',
        action: a,
        title: a.label,
        reasonMinLength: 10,
        reasonLabel: 'Reason for change',
      });
      return;
    }
    if (['WITHDRAW', 'CANCEL', 'REFUND', 'DROP_OUT', 'APP_REJECTED'].includes(a.type)) {
      const min = this.reasonMinForAction(a.type);
      this.reasonForm.reset({ reason: '' });
      this.reasonForm.controls.reason.setValidators([
        Validators.required,
        Validators.minLength(min),
        Validators.maxLength(500),
      ]);
      this.reasonForm.controls.reason.updateValueAndValidity();
      this.actionDialog.set({
        mode: 'reason',
        action: a,
        title: a.label,
        destructive: a.destructive,
        reasonMinLength: min,
        reasonLabel: 'Reason',
      });
    }
  }

  async submitActionDialog() {
    const dialog = this.actionDialog();
    if (!dialog) return;

    if (dialog.mode === 'defer') {
      this.deferForm.markAllAsTouched();
      if (this.deferForm.invalid) return;
      const { deferredIntakeYear, intakeMonth, reason } = this.deferForm.getRawValue();
      const monthLabel =
        this.deferIntakeMonths.find((m) => m.value === intakeMonth)?.label ?? 'September';
      await this.executeDialogAction(dialog, {
        deferredIntakeYear: Number(deferredIntakeYear),
        deferredIntakeTerm: `${monthLabel} ${deferredIntakeYear}`,
        reason: reason!.trim(),
      });
      return;
    }

    if (dialog.mode === 'reason') {
      this.reasonForm.markAllAsTouched();
      if (this.reasonForm.invalid) return;
      await this.executeDialogAction(dialog, { reason: this.reasonForm.value.reason!.trim() });
      return;
    }

    if (dialog.mode === 'change_course') {
      this.changeCourseForm.markAllAsTouched();
      if (this.changeCourseForm.invalid) return;
      const v = this.changeCourseForm.getRawValue();
      await this.executeDialogAction(dialog, {
        courseName: v.courseName!.trim(),
        courseLevel: v.courseLevel,
        universityName: v.universityName?.trim() || this.app()?.university?.name,
        reason: v.reason!.trim(),
      });
      return;
    }

    if (dialog.mode === 'attachment') {
      this.attachmentForm.markAllAsTouched();
      if (this.attachmentForm.invalid) return;
      const v = this.attachmentForm.getRawValue();
      this.dialogSubmitting.set(true);
      try {
        const res = await firstValueFrom(
          this.api.executeAction(this.applicationId(), 'ADD_ATTACHMENT', {
            fileName: v.fileName!.trim(),
            description: v.description?.trim() || undefined,
          })
        );
        await this.patchFromResponse(res, { workflow: false });
        this.closeActionDialog();
        this.toast.success('Attachment added', `"${v.fileName!.trim()}" is listed under Attachments.`);
      } catch (e: unknown) {
        this.toast.error('Could not add attachment', this.apiErrorMessage(e, 'Please try again.'));
      } finally {
        this.dialogSubmitting.set(false);
      }
      return;
    }

    if (dialog.mode === 'task') {
      this.taskForm.markAllAsTouched();
      if (this.taskForm.invalid) return;
      const title = this.taskForm.value.title!.trim();
      this.dialogSubmitting.set(true);
      try {
        const res = await firstValueFrom(this.api.addTask(this.applicationId(), { title }));
        await this.patchFromResponse(res, { workflow: false });
        this.closeActionDialog();
        this.toast.success('Task created', `"${title}" added to the task list.`);
      } catch (e: unknown) {
        this.toast.error('Could not add task', this.apiErrorMessage(e, 'Please try again.'));
      } finally {
        this.dialogSubmitting.set(false);
      }
      return;
    }

    if (dialog.mode === 'decision_conditions' && dialog.decisionOutcome) {
      this.decisionConditionsForm.markAllAsTouched();
      const conditions = this.decisionConditionsForm.value.conditions?.trim();
      this.closeActionDialog();
      await this.submitDecision(dialog.decisionOutcome, conditions);
    }
  }

  private async executeDialogAction(
    dialog: ActionDialogState,
    payload: Record<string, unknown>
  ) {
    const a = dialog.action;
    if (!a) return;

    this.dialogSubmitting.set(true);
    this.busyAction.set(true);
    try {
      const res = await firstValueFrom(this.api.executeAction(this.applicationId(), a.type, payload));
      let successTitle = a.label;
      let successMessage: string | undefined;

      if (a.type === 'DEFER') {
        successTitle = 'Application deferred';
        successMessage = `${this.studentDisplayName()} deferred to ${payload['deferredIntakeTerm']}. Status: deferred.`;
      } else if (a.type === 'CHANGE_COURSE') {
        successTitle = 'Course updated';
        successMessage = `Now ${payload['courseName']}. Application may require re-review.`;
      } else {
        const actionCopy: Record<string, { title: string; message: string }> = {
          WITHDRAW: {
            title: 'Application withdrawn',
            message: `${this.studentDisplayName()} has been withdrawn from the pipeline.`,
          },
          CANCEL: {
            title: 'Application cancelled',
            message: `${this.studentDisplayName()} was cancelled before substantive review.`,
          },
          REFUND: {
            title: 'Refund recorded',
            message: 'Deposit refund noted — application remains open.',
          },
          DROP_OUT: {
            title: 'Drop out recorded',
            message: `${this.studentDisplayName()} marked as closed lost post-enrolment.`,
          },
          APP_REJECTED: {
            title: 'Application rejected',
            message: `${this.studentDisplayName()} is now rejected and closed to further progression.`,
          },
        };
        const copy = actionCopy[a.type];
        if (copy) {
          successTitle = copy.title;
          successMessage = copy.message;
        }
      }

      const stageChanging = [
        'DEFER',
        'WITHDRAW',
        'CANCEL',
        'DROP_OUT',
        'APP_REJECTED',
        'CHANGE_COURSE',
      ].includes(a.type);
      await this.patchFromResponse(res, { workflow: true, ai: stageChanging });
      if (stageChanging) {
        const stage = this.stageLabel();
        const status = this.app()?.status ?? 'updated';
        successMessage = `${successMessage ?? ''} Current stage: ${stage}. Status: ${status}.`.trim();
      }
      this.closeActionDialog();
      this.toast.success(successTitle, successMessage);
    } catch (e: unknown) {
      this.toast.error(`${a.label} failed`, this.apiErrorMessage(e, 'Please try again.'));
    } finally {
      this.dialogSubmitting.set(false);
      this.busyAction.set(false);
    }
  }

  dialogFieldError(form: 'defer' | 'reason' | 'changeCourse' | 'attachment' | 'task', field: string): string | null {
    const group =
      form === 'defer'
        ? this.deferForm
        : form === 'reason'
          ? this.reasonForm
          : form === 'changeCourse'
            ? this.changeCourseForm
            : form === 'attachment'
              ? this.attachmentForm
              : this.taskForm;
    const control = (group as typeof this.deferForm).get(field);
    if (!control || !control.touched || !control.errors) return null;
    if (control.errors['required']) return 'This field is required';
    if (control.errors['minlength']) {
      return `At least ${control.errors['minlength'].requiredLength} characters required`;
    }
    if (control.errors['maxlength']) {
      return `Maximum ${control.errors['maxlength'].requiredLength} characters`;
    }
    return 'Invalid value';
  }

  studentName() {
    const app = this.app();
    const s = app?.student;
    if (!s) return app?.studentName ?? 'Application';
    return `${s.firstName} ${s.lastName}`;
  }

  pipelineIndex(stage: string) {
    return this.pipelineStages.indexOf(stage as (typeof PIPELINE_STAGES)[number]);
  }

  recommendationClass(rec?: string) {
    if (rec === 'READY') return 'bg-green-100 text-green-800';
    if (rec === 'NOT_READY') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  }

}
