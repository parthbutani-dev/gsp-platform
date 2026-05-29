export const Stages = {
  NEW_APP: 'NEW_APP',
  QA_REVIEW: 'QA_REVIEW',
  APP_REVIEW: 'APP_REVIEW',
  DECISION: 'DECISION',
  DEPOSIT: 'DEPOSIT',
  CAS_REVIEW: 'CAS_REVIEW',
  ENROLMENT: 'ENROLMENT',
  APP_REJECTED: 'APP_REJECTED',
  CLOSED_LOST: 'CLOSED_LOST',
} as const;

export type Stage = (typeof Stages)[keyof typeof Stages];

export const PIPELINE_STAGES: Stage[] = [
  Stages.NEW_APP,
  Stages.QA_REVIEW,
  Stages.APP_REVIEW,
  Stages.DECISION,
  Stages.DEPOSIT,
  Stages.CAS_REVIEW,
  Stages.ENROLMENT,
];

export const Roles = {
  AGENT: 'AGENT',
  COUNSELLOR: 'COUNSELLOR',
  QA_OFFICER: 'QA_OFFICER',
  ADMISSION_OFFICER: 'ADMISSION_OFFICER',
  VISA_OFFICER: 'VISA_OFFICER',
  ENROLMENT_OFFICER: 'ENROLMENT_OFFICER',
} as const;

export type Role = (typeof Roles)[keyof typeof Roles];

export const ApplicationStatus = {
  ACTIVE: 'active',
  DEFERRED: 'deferred',
  REJECTED: 'rejected',
  CLOSED_LOST: 'closed_lost',
  CLOSED: 'closed',
} as const;

export const EntryPoints = {
  STANDARD: 'standard',
  OFFER_EXISTS: 'offer_exists',
} as const;

export type EntryPoint = (typeof EntryPoints)[keyof typeof EntryPoints];

export const AiRecommendations = {
  READY: 'READY',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  NOT_READY: 'NOT_READY',
} as const;

export type AiRecommendation = (typeof AiRecommendations)[keyof typeof AiRecommendations];

export type ApplicationStatusType = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const ActionTypes = {
  ADD_NOTE: 'ADD_NOTE',
  ADD_ATTACHMENT: 'ADD_ATTACHMENT',
  ADD_TASK: 'ADD_TASK',
  CHANGE_COURSE: 'CHANGE_COURSE',
  DEFER: 'DEFER',
  WITHDRAW: 'WITHDRAW',
  CANCEL: 'CANCEL',
  REFUND: 'REFUND',
  DROP_OUT: 'DROP_OUT',
  APP_REJECTED: 'APP_REJECTED',
} as const;

export type ActionType = (typeof ActionTypes)[keyof typeof ActionTypes];

export const DecisionOutcomes = {
  CONDITIONAL: 'conditional',
  UNCONDITIONAL: 'unconditional',
  REJECTED: 'rejected',
} as const;

export type DecisionOutcome = (typeof DecisionOutcomes)[keyof typeof DecisionOutcomes];
