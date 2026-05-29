import mongoose, { Schema, Document, Types } from 'mongoose';
import {
  ApplicationStatus,
  EntryPoints,
  Stages,
  type ApplicationStatusType,
  type DecisionOutcome,
  type EntryPoint,
  type Stage,
} from '@gsp/shared';

export interface IDocumentRequirement {
  key: string;
  label: string;
  uploaded: boolean;
  uploadedAt?: Date;
}

export interface INote {
  _id: Types.ObjectId;
  body: string;
  internal: boolean;
  authorId: Types.ObjectId;
  authorRole: string;
  createdAt: Date;
}

export interface IAttachment {
  _id: Types.ObjectId;
  fileName: string;
  description?: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export interface ITask {
  _id: Types.ObjectId;
  title: string;
  dueDate?: Date;
  completed: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

export interface IStageHistoryEntry {
  from: Stage;
  to: Stage;
  by: Types.ObjectId;
  at: Date;
  reason?: string;
}

export interface IAssignedOfficers {
  counsellorId?: Types.ObjectId;
  qaOfficerId?: Types.ObjectId;
  admissionOfficerId?: Types.ObjectId;
  visaOfficerId?: Types.ObjectId;
  enrolmentOfficerId?: Types.ObjectId;
}

export interface IApplication extends Document {
  createdAt: Date;
  updatedAt: Date;
  currentStage: Stage;
  status: ApplicationStatusType;
  student: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string;
    nationality: string;
  };
  course: { name: string; level: string };
  university: { name: string };
  intake: string;
  requiredDocuments: IDocumentRequirement[];
  attachments: IAttachment[];
  notes: INote[];
  tasks: ITask[];
  assignedOfficers: IAssignedOfficers;
  decisionOutcome?: DecisionOutcome;
  decisionConditions?: string;
  reviewNote?: string;
  exitReason?: string;
  requiresReReview: boolean;
  entryPoint: EntryPoint;
  offerDetails?: string;
  deferredFromStage?: Stage;
  deferredIntakeYear?: number;
  deferredIntakeTerm?: string;
  submittedByAgentId?: Types.ObjectId;
  createdById: Types.ObjectId;
  stageHistory: IStageHistoryEntry[];
  auditLog: { action: string; by: Types.ObjectId; at: Date; meta?: Record<string, unknown> }[];
}

const applicationSchema = new Schema<IApplication>(
  {
    currentStage: {
      type: String,
      required: true,
      enum: Object.values(Stages),
      default: Stages.NEW_APP,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.ACTIVE,
    },
    student: {
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: true },
      dateOfBirth: { type: String, required: true },
      nationality: { type: String, required: true },
    },
    course: {
      name: { type: String, required: true },
      level: { type: String, required: true },
    },
    university: { name: { type: String, required: true } },
    intake: { type: String, required: true },
    requiredDocuments: [
      {
        key: String,
        label: String,
        uploaded: { type: Boolean, default: false },
        uploadedAt: Date,
      },
    ],
    attachments: [
      {
        fileName: String,
        description: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    notes: [
      {
        body: String,
        internal: { type: Boolean, default: false },
        authorId: { type: Schema.Types.ObjectId, ref: 'User' },
        authorRole: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    tasks: [
      {
        title: String,
        dueDate: Date,
        completed: { type: Boolean, default: false },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    assignedOfficers: {
      counsellorId: { type: Schema.Types.ObjectId, ref: 'User' },
      qaOfficerId: { type: Schema.Types.ObjectId, ref: 'User' },
      admissionOfficerId: { type: Schema.Types.ObjectId, ref: 'User' },
      visaOfficerId: { type: Schema.Types.ObjectId, ref: 'User' },
      enrolmentOfficerId: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    decisionOutcome: String,
    decisionConditions: String,
    reviewNote: String,
    exitReason: String,
    entryPoint: {
      type: String,
      enum: Object.values(EntryPoints),
      default: EntryPoints.STANDARD,
    },
    offerDetails: String,
    deferredFromStage: String,
    deferredIntakeYear: Number,
    deferredIntakeTerm: String,
    requiresReReview: { type: Boolean, default: false },
    submittedByAgentId: { type: Schema.Types.ObjectId, ref: 'User' },
    createdById: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stageHistory: [
      {
        from: String,
        to: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        reason: String,
      },
    ],
    auditLog: [
      {
        action: String,
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        meta: Schema.Types.Mixed,
      },
    ],
  },
  { timestamps: true }
);

applicationSchema.index({ currentStage: 1 });
applicationSchema.index({ submittedByAgentId: 1 });
applicationSchema.index({ 'assignedOfficers.admissionOfficerId': 1 });

export const Application = mongoose.model<IApplication>('Application', applicationSchema);

export const DEFAULT_REQUIRED_DOCUMENTS = [
  { key: 'passport', label: 'Passport', uploaded: false },
  { key: 'transcript', label: 'Academic Transcript', uploaded: false },
  { key: 'english_test', label: 'English Language Certificate', uploaded: false },
];
