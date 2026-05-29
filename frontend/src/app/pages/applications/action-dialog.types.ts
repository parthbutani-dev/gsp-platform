import type { ActionPreview } from '../../core/services/api.service';

export type ActionDialogMode =
  | 'defer'
  | 'reason'
  | 'change_course'
  | 'attachment'
  | 'task'
  | 'decision_conditions';

export interface ActionDialogState {
  mode: ActionDialogMode;
  title: string;
  action?: ActionPreview;
  decisionOutcome?: string;
  destructive?: boolean;
  reasonMinLength: number;
  reasonLabel: string;
}
