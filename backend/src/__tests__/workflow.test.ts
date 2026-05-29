import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ActionTypes, ApplicationStatus, Roles, Stages } from '@gsp/shared';
import { User } from '../models/User';
import { Application, DEFAULT_REQUIRED_DOCUMENTS } from '../models/Application';
import { workflowService } from '../services/WorkflowService';
import { actionService } from '../services/ActionService';
import { permissionService } from '../auth/PermissionService';
import bcrypt from 'bcryptjs';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Application.deleteMany({});
});

describe('WorkflowService', () => {
  it('blocks QA to APP_REVIEW when documents missing', async () => {
    const qa = await User.create({
      email: 'qa@test.com',
      passwordHash: await bcrypt.hash('x', 12),
      name: 'QA',
      role: Roles.QA_OFFICER,
    });
    const app = await Application.create({
      currentStage: Stages.QA_REVIEW,
      status: 'active',
      student: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        dateOfBirth: '2000-01-01',
        nationality: 'UK',
      },
      course: { name: 'CS', level: 'undergraduate' },
      university: { name: 'UCL' },
      intake: '2025-09',
      requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS.map((d) => ({ ...d, uploaded: false })),
      createdById: qa._id,
      stageHistory: [],
      auditLog: [],
    });

    const preview = workflowService.canTransition(app, Stages.APP_REVIEW, qa);
    expect(preview.allowed).toBe(false);
    expect(preview.reasons.length).toBeGreaterThan(0);
  });

  it('agent cannot transition', async () => {
    const agent = await User.create({
      email: 'agent@test.com',
      passwordHash: await bcrypt.hash('x', 12),
      name: 'Agent',
      role: Roles.AGENT,
    });
    const app = await Application.create({
      currentStage: Stages.NEW_APP,
      status: 'active',
      student: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        dateOfBirth: '2000-01-01',
        nationality: 'UK',
      },
      course: { name: 'CS', level: 'undergraduate' },
      university: { name: 'UCL' },
      intake: '2025-09',
      requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
      submittedByAgentId: agent._id,
      createdById: agent._id,
      stageHistory: [],
      auditLog: [],
    });

    const preview = workflowService.canTransition(app, Stages.QA_REVIEW, agent);
    expect(preview.allowed).toBe(false);
  });

  it('refund closes application as CLOSED_LOST', async () => {
    const admission = await User.create({
      email: 'adm@test.com',
      passwordHash: await bcrypt.hash('x', 12),
      name: 'Admission',
      role: Roles.ADMISSION_OFFICER,
    });
    const app = await Application.create({
      currentStage: Stages.DEPOSIT,
      status: 'active',
      student: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        dateOfBirth: '2000-01-01',
        nationality: 'UK',
      },
      course: { name: 'CS', level: 'undergraduate' },
      university: { name: 'UCL' },
      intake: '2025-09',
      requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
      createdById: admission._id,
      stageHistory: [],
      auditLog: [],
    });

    await actionService.execute(app, admission, ActionTypes.REFUND, { reason: 'Refund requested' });
    const updated = await Application.findById(app._id);
    expect(updated!.currentStage).toBe(Stages.CLOSED_LOST);
    expect(updated!.status).toBe(ApplicationStatus.CLOSED_LOST);
  });

  it('blocks contextual actions when application is deferred', async () => {
    const counsellor = await User.create({
      email: 'c@test.com',
      passwordHash: await bcrypt.hash('x', 12),
      name: 'Counsellor',
      role: Roles.COUNSELLOR,
    });
    const app = await Application.create({
      currentStage: Stages.QA_REVIEW,
      status: ApplicationStatus.DEFERRED,
      student: {
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        dateOfBirth: '2000-01-01',
        nationality: 'UK',
      },
      course: { name: 'CS', level: 'undergraduate' },
      university: { name: 'UCL' },
      intake: '2025-09',
      requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS,
      createdById: counsellor._id,
      stageHistory: [],
      auditLog: [],
    });

    expect(() =>
      permissionService.assertCanExecuteAction(counsellor, app, ActionTypes.WITHDRAW)
    ).toThrow('Application is not in an active state');
  });
});
