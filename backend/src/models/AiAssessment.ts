import mongoose, { Schema, Document, Types } from 'mongoose';
import type { Stage } from '@gsp/shared';

export interface IAiAssessmentResult {
  readinessScore: number;
  recommendation: 'READY' | 'NEEDS_ATTENTION' | 'NOT_READY';
  flags: string[];
  missingDocuments: string[];
  risks: string[];
  summary: string;
  advisory: boolean;
}

export interface IAiAssessment extends Document {
  createdAt: Date;
  updatedAt: Date;
  applicationId: Types.ObjectId;
  stage: Stage;
  status: 'pending' | 'completed' | 'failed';
  result?: IAiAssessmentResult;
  promptVersion: string;
  errorMessage?: string;
}

const aiAssessmentSchema = new Schema<IAiAssessment>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    stage: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    result: {
      readinessScore: Number,
      recommendation: String,
      flags: [String],
      missingDocuments: [String],
      risks: [String],
      summary: String,
      advisory: { type: Boolean, default: true },
    },
    promptVersion: { type: String, default: '1.0' },
    errorMessage: String,
  },
  { timestamps: true }
);

aiAssessmentSchema.index({ applicationId: 1, stage: 1 });

export const AiAssessment = mongoose.model<IAiAssessment>('AiAssessment', aiAssessmentSchema);
