import { Router, Request, Response, NextFunction } from 'express';
import mongoose, { Types } from 'mongoose';
import { ZodSchema } from 'zod';
import {
  ActionTypes,
  Roles,
  Stages,
  type ActionType,
  type Stage,
  addAttachmentSchema,
  addNoteSchema,
  addTaskSchema,
  changeCourseSchema,
  createApplicationSchema,
  decisionOutcomeSchema,
  deferSchema,
  EntryPoints,
  exitReasonSchema,
  rejectSchema,
  reviewNoteSchema,
  transitionSchema,
  updateTaskSchema,
  uploadDocumentSchema,
} from '@gsp/shared';
import { Application, DEFAULT_REQUIRED_DOCUMENTS } from '../models/Application';
import { User, IUser } from '../models/User';
import { authenticate, requireAuth } from '../middleware/auth';
import { validateRequest, formatZodErrors } from '../middleware/validateRequest';
import { permissionService } from '../auth/PermissionService';
import { workflowService } from '../services/WorkflowService';
import { actionService } from '../services/ActionService';
import { aiAssessmentService } from '../services/AiAssessmentService';
import { toApplicationDto, toListItem } from '../services/dto.mapper';
import { buildOfferExistsInitialHistory } from '../services/stageHistory.util';
import {
  notFound,
  forbidden,
  unauthorized,
  businessRuleError,
  validationError,
} from '../utils/errors';
import type { Role } from '@gsp/shared';

const router = Router();

function paramId(req: Request, key = 'id'): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? '');
}

router.use(authenticate, requireAuth);

const actionSchemas: Partial<Record<ActionType, ZodSchema>> = {
  [ActionTypes.ADD_TASK]: addTaskSchema,
  [ActionTypes.DEFER]: deferSchema,
  [ActionTypes.CHANGE_COURSE]: changeCourseSchema,
  [ActionTypes.APP_REJECTED]: rejectSchema,
  [ActionTypes.WITHDRAW]: exitReasonSchema,
  [ActionTypes.CANCEL]: exitReasonSchema,
  [ActionTypes.REFUND]: exitReasonSchema,
  [ActionTypes.DROP_OUT]: exitReasonSchema,
  [ActionTypes.ADD_NOTE]: addNoteSchema,
  [ActionTypes.ADD_ATTACHMENT]: addAttachmentSchema,
};

function parseObjectId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw notFound('Application not found');
}

async function getUserDoc(req: Request): Promise<IUser> {
  const user = await User.findById(req.user!.id);
  if (!user) throw unauthorized();
  return user;
}

async function loadApp(id: string) {
  parseObjectId(id);
  const app = await Application.findById(id);
  if (!app) throw notFound('Application not found');
  return app;
}

function validateActionPayload(type: string, body: unknown): Record<string, unknown> {
  const schema = actionSchemas[type as ActionType];
  if (!schema) throw notFound('Unknown action');
  const result = schema.safeParse(body);
  if (!result.success) {
    throw validationError(formatZodErrors(result.error));
  }
  return result.data as Record<string, unknown>;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserDoc(req);
    const filter = permissionService.filterListQuery(user);
    const apps = await Application.find(filter).sort({ updatedAt: -1 }).limit(100);
    res.json({ applications: apps.map((a) => toListItem(a, user)) });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/',
  validateRequest(createApplicationSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      if (user.role !== Roles.AGENT && user.role !== Roles.COUNSELLOR) {
        throw forbidden('Only agents and counsellors can create applications');
      }

      const entryPoint = req.body.entryPoint ?? EntryPoints.STANDARD;
      const isOfferExists = entryPoint === EntryPoints.OFFER_EXISTS;
      const initialStage = isOfferExists ? Stages.DECISION : Stages.NEW_APP;

      const app = await Application.create({
        ...req.body,
        entryPoint,
        currentStage: initialStage,
        requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS.map((d) => ({ ...d })),
        createdById: user._id,
        submittedByAgentId: user.role === Roles.AGENT ? user._id : undefined,
        assignedOfficers: {
          counsellorId: user.role === Roles.COUNSELLOR ? user._id : undefined,
        },
        stageHistory: isOfferExists
          ? buildOfferExistsInitialHistory(user._id as Types.ObjectId, new Date())
          : [],
        auditLog: [
          {
            action: 'created',
            by: user._id,
            at: new Date(),
            meta: { role: user.role, entryPoint },
          },
        ],
      });

      res.status(201).json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserDoc(req);
    const app = await loadApp(paramId(req));
    permissionService.assertCanViewApplication(user, app);

    const ai =
      user.role !== Roles.AGENT &&
      (app.currentStage === Stages.QA_REVIEW || app.currentStage === Stages.APP_REVIEW)
        ? await aiAssessmentService.getLatest(app._id.toString(), app.currentStage)
        : null;

    res.json({ application: toApplicationDto(app, user, ai ?? undefined) });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/available-transitions', async (req, res, next) => {
  try {
    const user = await getUserDoc(req);
    const app = await loadApp(paramId(req));
    permissionService.assertCanViewApplication(user, app);
    if (user.role === Roles.AGENT) {
      return res.json({ transitions: [], forward: null });
    }
    const forward = workflowService.getForwardTransition(app, user);
    res.json({
      transitions: workflowService.getAvailableTransitions(app, user),
      forward,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/:id/available-actions', async (req, res, next) => {
  try {
    const user = await getUserDoc(req);
    const app = await loadApp(paramId(req));
    permissionService.assertCanViewApplication(user, app);
    res.json({ actions: actionService.getAvailableActions(app, user) });
  } catch (e) {
    next(e);
  }
});

router.post(
  '/:id/transition',
  validateRequest(transitionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      permissionService.assertCanViewApplication(user, app);
      const { targetStage, reason } = req.body;
      await workflowService.transition(app, targetStage as Stage, user, reason);
      const updated = await Application.findById(app._id);
      res.json({ application: toApplicationDto(updated!, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/notes',
  validateRequest(addNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      permissionService.assertCanViewApplication(user, app);

      if (user.role === Roles.AGENT && req.body.internal) {
        throw forbidden('Agents cannot add internal notes');
      }

      app.notes.push({
        _id: new Types.ObjectId(),
        body: req.body.body,
        internal: req.body.internal ?? false,
        authorId: user._id as Types.ObjectId,
        authorRole: user.role,
        createdAt: new Date(),
      });
      await app.save();
      res.status(201).json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/documents/:key/upload',
  validateRequest(uploadDocumentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      permissionService.assertCanViewApplication(user, app);

      const uploadRoles: Role[] = [
        Roles.AGENT,
        Roles.COUNSELLOR,
        Roles.QA_OFFICER,
      ];
      const canUpload = uploadRoles.includes(user.role);
      if (!canUpload) throw forbidden('Your role cannot upload documents');

      const doc = app.requiredDocuments.find((d) => d.key === req.params.key);
      if (!doc) throw notFound('Document requirement not found');

      doc.uploaded = true;
      doc.uploadedAt = new Date();
      await app.save();
      res.json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/decision',
  validateRequest(decisionOutcomeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      permissionService.assertCanViewApplication(user, app);
      if (user.role !== Roles.ADMISSION_OFFICER) throw forbidden();
      app.decisionOutcome = req.body.outcome;
      app.decisionConditions = req.body.conditions;
      if (!app.assignedOfficers.admissionOfficerId) {
        app.assignedOfficers.admissionOfficerId = user._id as Types.ObjectId;
      }
      await app.save();
      res.json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/:id/review-note',
  validateRequest(reviewNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      if (user.role !== Roles.ADMISSION_OFFICER) {
        throw forbidden('Only admission officers can save a review note');
      }
      const app = await loadApp(paramId(req));
      permissionService.assertCanViewApplication(user, app);
      if (app.currentStage !== Stages.APP_REVIEW) {
        throw businessRuleError('Review note can only be set during Application Review');
      }
      app.reviewNote = req.body.reviewNote;
      if (!app.assignedOfficers.admissionOfficerId) {
        app.assignedOfficers.admissionOfficerId = user._id as Types.ObjectId;
      }
      await app.save();
      res.json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.post(
  '/:id/tasks',
  validateRequest(addTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      if (user.role === Roles.AGENT) throw forbidden();
      permissionService.assertCanViewApplication(user, app);
      app.tasks.push({
        _id: new Types.ObjectId(),
        title: req.body.title,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        completed: false,
        createdBy: user._id as Types.ObjectId,
        createdAt: new Date(),
      });
      await app.save();
      res.status(201).json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.patch(
  '/:id/tasks/:taskId',
  validateRequest(updateTaskSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await getUserDoc(req);
      const app = await loadApp(paramId(req));
      if (user.role === Roles.AGENT) throw forbidden();
      permissionService.assertCanViewApplication(user, app);
      const taskId = paramId(req, 'taskId');
      const task = app.tasks.find((t) => t._id.toString() === taskId);
      if (!task) throw notFound('Task not found');
      task.completed = req.body.completed;
      await app.save();
      res.json({ application: toApplicationDto(app, user) });
    } catch (e) {
      next(e);
    }
  }
);

router.get('/:id/ai-assessment', async (req, res, next) => {
  try {
    const user = await getUserDoc(req);
    if (user.role === Roles.AGENT) throw forbidden();
    const app = await loadApp(paramId(req));
    permissionService.assertCanViewApplication(user, app);
    const stage = (req.query.stage as Stage) || app.currentStage;
    const refresh = req.query.refresh === 'true';
    const assessment = await aiAssessmentService.getOrRefresh(
      app._id.toString(),
      stage,
      refresh
    );
    res.json({ assessment });
  } catch (e) {
    next(e);
  }
});

router.post('/:id/actions/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await getUserDoc(req);
    const app = await loadApp(paramId(req));
    const actionType = paramId(req, 'type') as ActionType;
    const payload = validateActionPayload(actionType, req.body);

    if (actionType === ActionTypes.ADD_NOTE) {
      app.notes.push({
        _id: new Types.ObjectId(),
        body: payload.body as string,
        internal: (payload.internal as boolean) ?? false,
        authorId: user._id as Types.ObjectId,
        authorRole: user.role,
        createdAt: new Date(),
      });
      await app.save();
      return res.json({ application: toApplicationDto(app, user) });
    }

    if (actionType === ActionTypes.ADD_ATTACHMENT) {
      app.attachments.push({
        _id: new Types.ObjectId(),
        fileName: payload.fileName as string,
        description: payload.description as string | undefined,
        uploadedBy: user._id as Types.ObjectId,
        createdAt: new Date(),
      });
      await app.save();
      return res.json({ application: toApplicationDto(app, user) });
    }

    await actionService.execute(app, user, actionType, payload);
    const updated = await Application.findById(app._id);
    res.json({ application: toApplicationDto(updated!, user) });
  } catch (e) {
    next(e);
  }
});

export default router;
