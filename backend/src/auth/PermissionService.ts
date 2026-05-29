import { ActionTypes, ApplicationStatus, Roles, type ActionType, type Stage } from '@gsp/shared';
import type { IApplication } from '../models/Application';
import type { IUser } from '../models/User';
import { forbidden, notFound } from '../utils/errors';
import { getActionDef, stageMatches } from '../config/actions.config';
import { getTransition } from '../config/workflow.config';
import { formatAllowedRolesMessage } from '../config/role-labels';

/**
 * Central RBAC gate — role from JWT only; resource ownership enforced here.
 */
export class PermissionService {
  canViewApplication(user: IUser, app: IApplication): boolean {
    if (user.role === Roles.AGENT) {
      return app.submittedByAgentId?.toString() === user._id.toString();
    }
    return true;
  }

  assertCanViewApplication(user: IUser, app: IApplication): void {
    if (!this.canViewApplication(user, app)) {
      throw notFound('Application not found');
    }
  }

  assertCanTransition(user: IUser, app: IApplication, targetStage: Stage): void {
    this.assertCanViewApplication(user, app);
    if (user.role === Roles.AGENT) {
      throw forbidden('Agents cannot perform stage transitions');
    }
    if (app.status !== 'active') {
      throw forbidden('Application is not in an active state');
    }
    const transition = getTransition(app.currentStage, targetStage);
    if (!transition) {
      throw forbidden('Invalid stage transition');
    }
    if (!transition.allowedRoles.includes(user.role)) {
      throw forbidden(formatAllowedRolesMessage(transition.allowedRoles));
    }
  }

  assertCanExecuteAction(user: IUser, app: IApplication, actionType: ActionType): void {
    this.assertCanViewApplication(user, app);
    const def = getActionDef(actionType);
    if (!def) throw forbidden('Unknown action');

    if (user.role === Roles.AGENT) {
      const agentAllowed =
        [Roles.AGENT].includes(user.role) && def.allowedRoles.includes(Roles.AGENT);
      if (!agentAllowed) throw forbidden('Agents cannot perform this action');
    }

    if (!def.allowedRoles.includes(user.role)) {
      throw forbidden('Your role cannot perform this action');
    }
    if (!stageMatches(def, app.currentStage)) {
      throw forbidden('Action not available at current stage');
    }

    const allowedWhenNotActive: ActionType[] = [
      ActionTypes.ADD_NOTE,
      ActionTypes.ADD_ATTACHMENT,
    ];
    if (
      app.status !== ApplicationStatus.ACTIVE &&
      !allowedWhenNotActive.includes(actionType)
    ) {
      throw forbidden('Application is not in an active state');
    }
  }

  filterListQuery(user: IUser): Record<string, unknown> {
    if (user.role === Roles.AGENT) {
      return { submittedByAgentId: user._id };
    }
    return {};
  }
}

export const permissionService = new PermissionService();
