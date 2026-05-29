import { Roles, Stages, type Role, type Stage } from '@gsp/shared';

export type ValidatorKey =
  | 'requiredDocumentsComplete'
  | 'admissionReviewNotePresent'
  | 'decisionOutcomeRecorded';

export interface TransitionDef {
  from: Stage;
  to: Stage;
  allowedRoles: Role[];
  validators: ValidatorKey[];
}

const INTERNAL_ADVANCE_ROLES: Role[] = [
  Roles.COUNSELLOR,
  Roles.QA_OFFICER,
  Roles.ADMISSION_OFFICER,
  Roles.VISA_OFFICER,
  Roles.ENROLMENT_OFFICER,
];

export const TRANSITIONS: TransitionDef[] = [
  {
    from: Stages.NEW_APP,
    to: Stages.QA_REVIEW,
    allowedRoles: [Roles.COUNSELLOR],
    validators: [],
  },
  {
    from: Stages.QA_REVIEW,
    to: Stages.APP_REVIEW,
    allowedRoles: [Roles.QA_OFFICER],
    validators: ['requiredDocumentsComplete'],
  },
  {
    from: Stages.QA_REVIEW,
    to: Stages.APP_REJECTED,
    allowedRoles: [Roles.QA_OFFICER, Roles.ADMISSION_OFFICER],
    validators: [],
  },
  {
    from: Stages.APP_REVIEW,
    to: Stages.DECISION,
    allowedRoles: [Roles.ADMISSION_OFFICER],
    validators: ['admissionReviewNotePresent'],
  },
  {
    from: Stages.APP_REVIEW,
    to: Stages.APP_REJECTED,
    allowedRoles: [Roles.QA_OFFICER, Roles.ADMISSION_OFFICER],
    validators: [],
  },
  {
    from: Stages.DECISION,
    to: Stages.DEPOSIT,
    allowedRoles: [Roles.ADMISSION_OFFICER],
    validators: ['decisionOutcomeRecorded'],
  },
  {
    from: Stages.DEPOSIT,
    to: Stages.CAS_REVIEW,
    allowedRoles: [Roles.ADMISSION_OFFICER],
    validators: [],
  },
  {
    from: Stages.CAS_REVIEW,
    to: Stages.ENROLMENT,
    allowedRoles: [Roles.VISA_OFFICER, Roles.ENROLMENT_OFFICER],
    validators: [],
  },
];

export const TERMINAL_STAGES: Stage[] = [Stages.APP_REJECTED, Stages.CLOSED_LOST];

export function getTransition(from: Stage, to: Stage): TransitionDef | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function getNextPipelineStage(stage: Stage): Stage | null {
  const order: Stage[] = [
    Stages.NEW_APP,
    Stages.QA_REVIEW,
    Stages.APP_REVIEW,
    Stages.DECISION,
    Stages.DEPOSIT,
    Stages.CAS_REVIEW,
    Stages.ENROLMENT,
  ];
  const idx = order.indexOf(stage);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

export { INTERNAL_ADVANCE_ROLES };
