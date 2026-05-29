import { ApplicationStatus, Roles, Stages, type Stage } from '@gsp/shared';
import { Application } from '../models/Application';
import { Types } from 'mongoose';
import {
  TRANSITIONS,
  TERMINAL_STAGES,
  getTransition,
  getNextPipelineStage,
  type ValidatorKey,
} from '../config/workflow.config';
import { formatAllowedRolesMessage, roleLabelsFor } from '../config/role-labels';
import { validators } from '../workflow/validators';
import type { IApplication } from '../models/Application';
import type { IUser } from '../models/User';
import { businessRuleError, forbidden } from '../utils/errors';
import { domainEvents } from '../utils/domainEvents';
import { STAGE_LABELS } from './dto.mapper';
import { aiAssessmentService } from './AiAssessmentService';

export interface TransitionPreview {
  to: Stage;
  label: string;
  allowed: boolean;
  reasons: string[];
  /** Human-readable roles allowed to perform this transition (from workflow config) */
  allowedRoleLabels: string[];
}

/**
 * Config-driven workflow engine with pluggable transition validators.
 */
export class WorkflowService {
  getForwardTransition(app: IApplication, user: IUser): TransitionPreview | null {
    if (TERMINAL_STAGES.includes(app.currentStage)) return null;
    const next = getNextPipelineStage(app.currentStage);
    if (!next) return null;
    return this.canTransition(app, next, user);
  }

  canTransition(app: IApplication, targetStage: Stage, user: IUser): TransitionPreview {
    const label = STAGE_LABELS[targetStage] ?? targetStage;
    const reasons: string[] = [];

    const transition = getTransition(app.currentStage, targetStage);
    if (!transition) {
      return {
        to: targetStage,
        label,
        allowed: false,
        reasons: ['Invalid transition'],
        allowedRoleLabels: [],
      };
    }

    const allowedRoleLabels = roleLabelsFor(transition.allowedRoles);

    if (user.role === Roles.AGENT) {
      reasons.push('Agents cannot perform stage transitions');
    } else if (app.status !== 'active') {
      reasons.push('Application is not in an active state');
    } else if (!transition.allowedRoles.includes(user.role)) {
      reasons.push(formatAllowedRolesMessage(transition.allowedRoles));
    }

    for (const key of transition.validators) {
      const result = validators[key as ValidatorKey](app);
      if (!result.ok) reasons.push(...result.reasons);
    }

    return {
      to: targetStage,
      label,
      allowed: reasons.length === 0,
      reasons,
      allowedRoleLabels,
    };
  }

  getAvailableTransitions(app: IApplication, user: IUser): TransitionPreview[] {
    const candidates = TRANSITIONS.filter((t) => t.from === app.currentStage);
    const seen = new Set<string>();
    return candidates
      .filter((t) => {
        if (seen.has(t.to)) return false;
        seen.add(t.to);
        return true;
      })
      .map((t) => this.canTransition(app, t.to, user));
  }

  async transition(
    app: IApplication,
    targetStage: Stage,
    user: IUser,
    reason?: string
  ): Promise<IApplication> {
    const preview = this.canTransition(app, targetStage, user);
    if (!preview.allowed) {
      throw businessRuleError(preview.reasons.join('; '), preview.reasons);
    }

    const from = app.currentStage;
    app.stageHistory.push({
      from,
      to: targetStage,
      by: user._id as Types.ObjectId,
      at: new Date(),
      reason,
    });
    app.currentStage = targetStage;
    app.auditLog.push({
      action: 'transition',
      by: user._id as Types.ObjectId,
      at: new Date(),
      meta: { from, to: targetStage },
    });

    if (targetStage === Stages.APP_REJECTED) {
      app.status = ApplicationStatus.REJECTED;
    } else if (targetStage === Stages.CLOSED_LOST) {
      app.status = ApplicationStatus.CLOSED_LOST;
    }

    await app.save();

    domainEvents.emitEvent({
      type: 'stage.entered',
      applicationId: app._id.toString(),
      stage: targetStage,
      by: user._id.toString(),
    });

    if (targetStage === Stages.QA_REVIEW || targetStage === Stages.APP_REVIEW) {
      void aiAssessmentService.runForStage(app._id.toString(), targetStage);
    }

    return (await Application.findById(app._id))!;
  }

  /** Terminal exit via contextual action (Withdraw, Cancel, Refund, Drop Out) — not a pipeline transition. */
  async closeAsLost(app: IApplication, user: IUser, reason?: string): Promise<IApplication> {
    if (user.role === Roles.AGENT) {
      throw forbidden('Agents cannot perform stage transitions');
    }
    if (app.status !== ApplicationStatus.ACTIVE) {
      throw businessRuleError('Application is not in an active state');
    }
    if (TERMINAL_STAGES.includes(app.currentStage)) {
      throw businessRuleError('Application is already closed');
    }

    const from = app.currentStage;
    app.stageHistory.push({
      from,
      to: Stages.CLOSED_LOST,
      by: user._id as Types.ObjectId,
      at: new Date(),
      reason,
    });
    app.currentStage = Stages.CLOSED_LOST;
    app.status = ApplicationStatus.CLOSED_LOST;
    app.auditLog.push({
      action: 'close_lost',
      by: user._id as Types.ObjectId,
      at: new Date(),
      meta: { from, reason },
    });

    await app.save();

    domainEvents.emitEvent({
      type: 'stage.entered',
      applicationId: app._id.toString(),
      stage: Stages.CLOSED_LOST,
      by: user._id.toString(),
    });

    return (await Application.findById(app._id))!;
  }
}

export const workflowService = new WorkflowService();
