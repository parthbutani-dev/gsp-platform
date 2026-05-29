import { PIPELINE_STAGES, Roles, Stages } from '@gsp/shared';
import type { IApplication } from '../models/Application';
import type { IUser } from '../models/User';
import type { IAiAssessment } from '../models/AiAssessment';
import { getDisplayStageHistory } from './stageHistory.util';

const STAGE_LABELS: Record<string, string> = {
  NEW_APP: 'New Application',
  QA_REVIEW: 'QA Review',
  APP_REVIEW: 'Application Review',
  DECISION: 'Decision',
  DEPOSIT: 'Deposit',
  CAS_REVIEW: 'CAS Review',
  ENROLMENT: 'Enrolment',
  APP_REJECTED: 'Rejected',
  CLOSED_LOST: 'Closed Lost',
};

export type AgentProgressStepState = 'completed' | 'current' | 'upcoming';

export interface AgentPipelineProgress {
  steps: { stage: string; label: string; state: AgentProgressStepState }[];
  currentStepNumber: number;
  totalSteps: number;
  completedCount: number;
  remainingCount: number;
  terminalLabel?: string;
}

function buildAgentPipelineProgress(app: IApplication): AgentPipelineProgress {
  const pipelineStage = (PIPELINE_STAGES as readonly string[]).includes(app.currentStage)
    ? app.currentStage
    : [...app.stageHistory]
        .reverse()
        .map((h) => h.to)
        .find((to) => (PIPELINE_STAGES as readonly string[]).includes(to)) ?? Stages.NEW_APP;

  const currentIndex = PIPELINE_STAGES.indexOf(pipelineStage as (typeof PIPELINE_STAGES)[number]);
  const safeIndex = currentIndex >= 0 ? currentIndex : 0;

  const steps = PIPELINE_STAGES.map((stage, index) => {
    let state: AgentProgressStepState = 'upcoming';
    if (index < safeIndex) state = 'completed';
    else if (index === safeIndex) state = 'current';
    return {
      stage,
      label: STAGE_LABELS[stage] ?? stage,
      state,
    };
  });

  const terminalLabel = !(PIPELINE_STAGES as readonly string[]).includes(app.currentStage)
    ? STAGE_LABELS[app.currentStage] ?? app.currentStage
    : undefined;

  const allPipelineComplete =
    app.currentStage === Stages.ENROLMENT && app.status === 'active';

  return {
    steps: allPipelineComplete
      ? steps.map((s) => ({ ...s, state: 'completed' as const }))
      : steps,
    currentStepNumber: allPipelineComplete ? PIPELINE_STAGES.length : safeIndex + 1,
    totalSteps: PIPELINE_STAGES.length,
    completedCount: allPipelineComplete ? PIPELINE_STAGES.length : safeIndex,
    remainingCount: allPipelineComplete
      ? 0
      : Math.max(0, PIPELINE_STAGES.length - safeIndex - 1),
    terminalLabel,
  };
}

function buildSuggestions(app: IApplication): string[] {
  const suggestions: string[] = [];
  const missing = app.requiredDocuments.filter((d) => !d.uploaded);
  if (missing.length > 0) {
    suggestions.push(`Upload: ${missing.map((d) => d.label).join(', ')}`);
  }
  if (app.currentStage === Stages.QA_REVIEW) {
    suggestions.push('Your application is awaiting quality assurance review.');
  } else if (app.currentStage === Stages.APP_REVIEW) {
    suggestions.push('Your application is under admissions review.');
  } else if (app.currentStage === Stages.DECISION) {
    suggestions.push('Awaiting university decision.');
  }
  return suggestions;
}

export function toAgentDto(app: IApplication, _user: IUser) {
  // Agents see non-internal notes (staff ↔ agent communication), not internal staff notes.
  const visibleNotes = app.notes.filter((n) => !n.internal);

  const progress = buildAgentPipelineProgress(app);

  return {
    id: app._id,
    statusLabel: STAGE_LABELS[app.currentStage] ?? app.currentStage,
    statusSummary: `Application is at ${STAGE_LABELS[app.currentStage] ?? app.currentStage}`,
    currentStage: app.currentStage,
    status: app.status,
    progress,
    suggestions: buildSuggestions(app),
    student: {
      firstName: app.student.firstName,
      lastName: app.student.lastName,
      email: app.student.email,
    },
    course: app.course,
    university: app.university,
    intake: app.intake,
    requiredDocuments: app.requiredDocuments.map((d) => ({
      key: d.key,
      label: d.label,
      uploaded: d.uploaded,
    })),
    notes: visibleNotes.map((n) => ({
      id: n._id,
      body: n.body,
      createdAt: n.createdAt,
    })),
    attachments: app.attachments.map((a) => ({
      id: a._id,
      fileName: a.fileName,
      description: a.description,
      createdAt: a.createdAt,
    })),
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export function toInternalDto(app: IApplication, aiAssessment?: IAiAssessment | null) {
  return {
    id: app._id,
    currentStage: app.currentStage,
    status: app.status,
    statusLabel: STAGE_LABELS[app.currentStage] ?? app.currentStage,
    student: app.student,
    course: app.course,
    university: app.university,
    intake: app.intake,
    entryPoint: app.entryPoint,
    offerDetails: app.offerDetails,
    requiredDocuments: app.requiredDocuments,
    attachments: app.attachments.map((a) => ({
      id: a._id,
      fileName: a.fileName,
      description: a.description,
      createdAt: a.createdAt,
    })),
    notes: app.notes.map((n) => ({
      id: n._id,
      body: n.body,
      internal: n.internal,
      authorRole: n.authorRole,
      createdAt: n.createdAt,
    })),
    tasks: app.tasks.map((t) => ({
      id: t._id,
      title: t.title,
      completed: t.completed,
      createdAt: t.createdAt,
    })),
    assignedOfficers: app.assignedOfficers,
    decisionOutcome: app.decisionOutcome,
    decisionConditions: app.decisionConditions,
    reviewNote: app.reviewNote,
    exitReason: app.exitReason,
    deferredFromStage: app.deferredFromStage,
    deferredIntakeYear: app.deferredIntakeYear,
    deferredIntakeTerm: app.deferredIntakeTerm,
    requiresReReview: app.requiresReReview,
    submittedByAgentId: app.submittedByAgentId,
    stageHistory: getDisplayStageHistory(app).map((h) => ({
      from: h.from,
      to: h.to,
      at: h.at,
      reason: h.reason,
      skipped: h.skipped ?? false,
    })),
    auditLog: app.auditLog,
    aiAssessment: aiAssessment
      ? {
          status: aiAssessment.status,
          stage: aiAssessment.stage,
          result: aiAssessment.result,
          errorMessage: aiAssessment.errorMessage,
          createdAt: aiAssessment.createdAt,
        }
      : undefined,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}

export function toApplicationDto(app: IApplication, user: IUser, ai?: IAiAssessment | null) {
  if (user.role === Roles.AGENT) {
    return toAgentDto(app, user);
  }
  return toInternalDto(app, ai);
}

export function toListItem(app: IApplication, user: IUser) {
  if (user.role === Roles.AGENT) {
    return {
      id: app._id,
      studentName: `${app.student.firstName} ${app.student.lastName}`,
      statusLabel: STAGE_LABELS[app.currentStage] ?? app.currentStage,
      currentStage: app.currentStage,
      status: app.status,
      updatedAt: app.updatedAt,
    };
  }
  return {
    id: app._id,
    studentName: `${app.student.firstName} ${app.student.lastName}`,
    currentStage: app.currentStage,
    statusLabel: STAGE_LABELS[app.currentStage] ?? app.currentStage,
    status: app.status,
    course: app.course.name,
    university: app.university.name,
    updatedAt: app.updatedAt,
  };
}

export { STAGE_LABELS, PIPELINE_STAGES };
