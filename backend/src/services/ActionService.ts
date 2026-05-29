import { ActionTypes, ApplicationStatus, Roles, Stages, type ActionType } from '@gsp/shared';
import { Types } from 'mongoose';
import { ACTION_DEFINITIONS } from '../config/actions.config';
import type { IApplication } from '../models/Application';
import type { IUser } from '../models/User';
import { permissionService } from '../auth/PermissionService';
import { workflowService } from './WorkflowService';
import { domainEvents } from '../utils/domainEvents';

export interface ActionPreview {
  type: ActionType;
  label: string;
  destructive: boolean;
}

export class ActionService {
  getAvailableActions(app: IApplication, user: IUser): ActionPreview[] {
    return ACTION_DEFINITIONS.filter((d) => this.isActionAvailable(app, d.type, user)).map((d) => ({
      type: d.type,
      label: d.label,
      destructive: d.destructive,
    }));
  }

  private isActionAvailable(app: IApplication, type: ActionType, user: IUser): boolean {
    try {
      permissionService.assertCanExecuteAction(user, app, type);
      return true;
    } catch {
      return false;
    }
  }

  async execute(
    app: IApplication,
    user: IUser,
    actionType: ActionType,
    payload: Record<string, unknown>
  ): Promise<IApplication> {
    permissionService.assertCanExecuteAction(user, app, actionType);

    switch (actionType) {
      case ActionTypes.ADD_TASK: {
        app.tasks.push({
          _id: new Types.ObjectId(),
          title: payload.title as string,
          dueDate: payload.dueDate ? new Date(payload.dueDate as string) : undefined,
          completed: false,
          createdBy: user._id as Types.ObjectId,
          createdAt: new Date(),
        });
        break;
      }
      case ActionTypes.CHANGE_COURSE: {
        app.course.name = payload.courseName as string;
        if (payload.courseLevel) {
          app.course.level = payload.courseLevel as string;
        }
        if (payload.universityName) {
          app.university.name = payload.universityName as string;
        }
        if (
          app.currentStage === Stages.QA_REVIEW ||
          app.currentStage === Stages.APP_REVIEW
        ) {
          app.currentStage = Stages.NEW_APP;
          app.requiresReReview = true;
          app.reviewNote = undefined;
        }
        break;
      }
      case ActionTypes.DEFER: {
        app.deferredFromStage = app.currentStage;
        app.deferredIntakeYear = payload.deferredIntakeYear as number;
        app.deferredIntakeTerm = payload.deferredIntakeTerm as string;
        app.status = ApplicationStatus.DEFERRED;
        app.exitReason = payload.reason as string | undefined;
        break;
      }
      case ActionTypes.REFUND:
      case ActionTypes.WITHDRAW:
      case ActionTypes.CANCEL:
      case ActionTypes.DROP_OUT: {
        app.exitReason = payload.reason as string | undefined;
        await workflowService.closeAsLost(app, user, payload.reason as string);
        break;
      }
      case ActionTypes.APP_REJECTED: {
        await workflowService.transition(app, Stages.APP_REJECTED, user, payload.reason as string);
        break;
      }
      default:
        throw new Error(`Unhandled action: ${actionType}`);
    }

    app.auditLog.push({
      action: actionType,
      by: user._id as Types.ObjectId,
      at: new Date(),
      meta: payload,
    });

    await app.save();

    domainEvents.emitEvent({
      type: 'action.executed',
      applicationId: app._id.toString(),
      action: actionType,
      by: user._id.toString(),
    });

    return app;
  }
}

export const actionService = new ActionService();
