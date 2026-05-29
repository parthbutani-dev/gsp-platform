import { Roles, type Role } from '@gsp/shared';

export const ROLE_LABELS: Record<Role, string> = {
  [Roles.AGENT]: 'Agent',
  [Roles.COUNSELLOR]: 'Counsellor',
  [Roles.QA_OFFICER]: 'QA Officer',
  [Roles.ADMISSION_OFFICER]: 'Admission Officer',
  [Roles.VISA_OFFICER]: 'Visa Officer',
  [Roles.ENROLMENT_OFFICER]: 'Enrolment Officer',
};

export function roleLabelsFor(roles: Role[]): string[] {
  return roles.map((r) => ROLE_LABELS[r] ?? r);
}

export function formatAllowedRolesMessage(roles: Role[]): string {
  const labels = roleLabelsFor(roles);
  if (labels.length === 0) return 'Your role cannot perform this transition';
  if (labels.length === 1) return `Only ${labels[0]} can advance to this stage.`;
  return `Only ${labels.slice(0, -1).join(', ')} or ${labels.at(-1)} can advance to this stage.`;
}
