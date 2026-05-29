import { z } from 'zod';
import { DecisionOutcomes, EntryPoints } from '../enums';

const studentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().email('Invalid student email'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format'),
  nationality: z.string().trim().min(2, 'Nationality is required').max(100),
});

export const createApplicationSchema = z
  .object({
    student: studentSchema,
    course: z.object({
      name: z.string().trim().min(1, 'Course name is required').max(200),
      level: z.enum(['undergraduate', 'postgraduate', 'foundation']),
    }),
    university: z.object({
      name: z.string().trim().min(1, 'University name is required').max(200),
    }),
    intake: z.string().regex(/^\d{4}-\d{2}$/, 'Intake must be YYYY-MM'),
    entryPoint: z.enum([EntryPoints.STANDARD, EntryPoints.OFFER_EXISTS]).optional(),
    offerDetails: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.entryPoint === EntryPoints.OFFER_EXISTS && !data.offerDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Offer details are required for this entry point',
        path: ['offerDetails'],
      });
    }
  });

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const transitionSchema = z.object({
  targetStage: z.string().trim().min(1, 'Target stage is required'),
  reason: z.string().trim().max(500).optional(),
});

export type TransitionInput = z.infer<typeof transitionSchema>;

export const addNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note is required').max(2000),
  internal: z.boolean().optional().default(false),
});

export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const addTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD format')
    .optional(),
});

export type AddTaskInput = z.infer<typeof addTaskSchema>;

export const uploadDocumentSchema = z.object({
  fileName: z.string().trim().min(1).max(255).optional(),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const decisionOutcomeSchema = z.object({
  outcome: z.enum([
    DecisionOutcomes.CONDITIONAL,
    DecisionOutcomes.UNCONDITIONAL,
    DecisionOutcomes.REJECTED,
  ]),
  conditions: z.string().trim().max(1000).optional(),
});

export type DecisionOutcomeInput = z.infer<typeof decisionOutcomeSchema>;

export const deferSchema = z.object({
  deferredIntakeYear: z.number().int().min(2024).max(2040),
  deferredIntakeTerm: z.string().trim().min(1, 'Intake term is required').max(100),
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500),
});

export const reviewNoteSchema = z.object({
  reviewNote: z.string().trim().min(1, 'Review note is required').max(5000),
});

export type ReviewNoteInput = z.infer<typeof reviewNoteSchema>;

export const updateTaskSchema = z.object({
  completed: z.boolean(),
});

export type DeferInput = z.infer<typeof deferSchema>;

export const changeCourseSchema = z.object({
  courseName: z.string().trim().min(1).max(200),
  courseLevel: z.enum(['undergraduate', 'postgraduate', 'foundation']),
  universityName: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(10).max(500),
});

export type ChangeCourseInput = z.infer<typeof changeCourseSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500),
});

export type RejectInput = z.infer<typeof rejectSchema>;

export const exitReasonSchema = z.object({
  reason: z.string().trim().min(5, 'Reason is required').max(500),
});

export type ExitReasonInput = z.infer<typeof exitReasonSchema>;

export const addAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  description: z.string().trim().max(500).optional(),
});

export type AddAttachmentInput = z.infer<typeof addAttachmentSchema>;
