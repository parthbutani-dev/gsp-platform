import { ActionTypes, Roles, Stages, type ActionType, type Role, type Stage } from '@gsp/shared';

export interface ActionDef {
  type: ActionType;
  label: string;
  destructive: boolean;
  /** '*' = any active pipeline stage */
  allowedStages: Stage[] | '*';
  allowedRoles: Role[];
}

const ALL_PIPELINE_STAGES = [
  Stages.NEW_APP,
  Stages.QA_REVIEW,
  Stages.APP_REVIEW,
  Stages.DECISION,
  Stages.DEPOSIT,
  Stages.CAS_REVIEW,
  Stages.ENROLMENT,
] as Stage[];

const INTERNAL_ROLES: Role[] = [
  Roles.COUNSELLOR,
  Roles.QA_OFFICER,
  Roles.ADMISSION_OFFICER,
  Roles.VISA_OFFICER,
  Roles.ENROLMENT_OFFICER,
];

export const ACTION_DEFINITIONS: ActionDef[] = [
  {
    type: ActionTypes.ADD_NOTE,
    label: 'Add Note',
    destructive: false,
    allowedStages: '*',
    allowedRoles: [...INTERNAL_ROLES, Roles.AGENT],
  },
  {
    type: ActionTypes.ADD_ATTACHMENT,
    label: 'Add Attachment',
    destructive: false,
    allowedStages: '*',
    allowedRoles: [Roles.AGENT, Roles.COUNSELLOR, Roles.QA_OFFICER],
  },
  {
    type: ActionTypes.ADD_TASK,
    label: 'Add Task',
    destructive: false,
    allowedStages: '*',
    allowedRoles: INTERNAL_ROLES,
  },
  {
    type: ActionTypes.CHANGE_COURSE,
    label: 'Change Course',
    destructive: false,
    allowedStages: [Stages.NEW_APP, Stages.QA_REVIEW, Stages.APP_REVIEW],
    allowedRoles: [Roles.COUNSELLOR, Roles.ADMISSION_OFFICER],
  },
  {
    type: ActionTypes.DEFER,
    label: 'Defer Application',
    destructive: false,
    allowedStages: [Stages.NEW_APP, Stages.QA_REVIEW, Stages.APP_REVIEW, Stages.DECISION],
    allowedRoles: [Roles.COUNSELLOR, Roles.ADMISSION_OFFICER],
  },
  {
    type: ActionTypes.WITHDRAW,
    label: 'Withdraw',
    destructive: true,
    allowedStages: [Stages.NEW_APP, Stages.QA_REVIEW, Stages.APP_REVIEW, Stages.DECISION],
    allowedRoles: [Roles.COUNSELLOR, Roles.ADMISSION_OFFICER],
  },
  {
    type: ActionTypes.CANCEL,
    label: 'Cancel',
    destructive: true,
    allowedStages: [Stages.NEW_APP, Stages.QA_REVIEW],
    allowedRoles: [Roles.COUNSELLOR],
  },
  {
    type: ActionTypes.REFUND,
    label: 'Refund',
    destructive: true,
    allowedStages: [Stages.DEPOSIT, Stages.CAS_REVIEW, Stages.ENROLMENT],
    allowedRoles: [Roles.ADMISSION_OFFICER],
  },
  {
    type: ActionTypes.DROP_OUT,
    label: 'Drop Out',
    destructive: true,
    allowedStages: [Stages.ENROLMENT],
    allowedRoles: [Roles.ENROLMENT_OFFICER],
  },
  {
    type: ActionTypes.APP_REJECTED,
    label: 'Reject Application',
    destructive: true,
    allowedStages: [Stages.QA_REVIEW, Stages.APP_REVIEW],
    allowedRoles: [Roles.QA_OFFICER, Roles.ADMISSION_OFFICER],
  },
];

export function getActionDef(type: ActionType): ActionDef | undefined {
  return ACTION_DEFINITIONS.find((a) => a.type === type);
}

export function stageMatches(def: ActionDef, stage: Stage): boolean {
  if (def.allowedStages === '*') return ALL_PIPELINE_STAGES.includes(stage);
  return def.allowedStages.includes(stage);
}
