import type { IApplication } from '../models/Application';
import type { ValidatorKey } from '../config/workflow.config';

const REQUIRED_DOCUMENT_COUNT = 3;

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
  missing?: string[];
}

export const validators: Record<ValidatorKey, (app: IApplication) => ValidationResult> = {
  requiredDocumentsComplete(app) {
    const uploaded = app.requiredDocuments.filter((d) => d.uploaded).length;
    if (uploaded >= REQUIRED_DOCUMENT_COUNT) {
      return { ok: true, reasons: [] };
    }
    return {
      ok: false,
      reasons: [
        `${uploaded}/${REQUIRED_DOCUMENT_COUNT} required documents uploaded. Upload all documents before advancing.`,
      ],
      missing: app.requiredDocuments.filter((d) => !d.uploaded).map((d) => d.label),
    };
  },

  admissionReviewNotePresent(app) {
    if (app.reviewNote && app.reviewNote.trim().length > 0) {
      return { ok: true, reasons: [] };
    }
    return {
      ok: false,
      reasons: ['Admission Officer must record a review note before advancing to Decision.'],
    };
  },

  decisionOutcomeRecorded(app) {
    if (!app.decisionOutcome) {
      return {
        ok: false,
        reasons: ['Decision outcome must be recorded before moving to Deposit'],
      };
    }
    return { ok: true, reasons: [] };
  },
};
