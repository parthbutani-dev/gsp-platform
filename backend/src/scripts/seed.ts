import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Roles, Stages } from '@gsp/shared';
import { env } from '../config/env';
import { User } from '../models/User';
import { Application, DEFAULT_REQUIRED_DOCUMENTS } from '../models/Application';
import { aiAssessmentService } from '../services/AiAssessmentService';

export const DEMO_PASSWORD = 'demo1234';

const USERS = [
  { email: 'agent@gsp.demo', name: 'Demo Agent', role: Roles.AGENT },
  { email: 'counsellor@gsp.demo', name: 'Demo Counsellor', role: Roles.COUNSELLOR },
  { email: 'qa@gsp.demo', name: 'Demo QA Officer', role: Roles.QA_OFFICER },
  { email: 'admission@gsp.demo', name: 'Demo Admission Officer', role: Roles.ADMISSION_OFFICER },
  { email: 'visa@gsp.demo', name: 'Demo Visa Officer', role: Roles.VISA_OFFICER },
  { email: 'enrolment@gsp.demo', name: 'Demo Enrolment Officer', role: Roles.ENROLMENT_OFFICER },
];

/** Upsert all demo users — safe to re-run without wiping applications. */
export async function upsertDemoUsers() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  return Promise.all(
    USERS.map((u) =>
      User.findOneAndUpdate(
        { email: u.email.toLowerCase() },
        {
          email: u.email.toLowerCase(),
          passwordHash: hash,
          name: u.name,
          role: u.role,
        },
        { upsert: true, new: true }
      )
    )
  );
}

export async function runSeed() {
  const createdUsers = await upsertDemoUsers();
  await Application.deleteMany({});

  const byRole = Object.fromEntries(createdUsers.map((u) => [u.role, u]));
  const agent = byRole[Roles.AGENT];
  const counsellor = byRole[Roles.COUNSELLOR];
  const qa = byRole[Roles.QA_OFFICER];
  const admission = byRole[Roles.ADMISSION_OFFICER];

  // Alice Chen — new_app, 0/3 documents (blocked QA advance demo)
  await Application.create({
    student: {
      firstName: 'Alice',
      lastName: 'Chen',
      email: 'alice.chen@example.com',
      dateOfBirth: '2001-04-12',
      nationality: 'China',
    },
    course: { name: 'MSc Data Science', level: 'postgraduate' },
    university: { name: 'University of Edinburgh' },
    intake: '2025-09',
    currentStage: Stages.NEW_APP,
    status: 'active',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS.map((d) => ({ ...d })),
    submittedByAgentId: agent._id,
    createdById: agent._id,
    assignedOfficers: { counsellorId: counsellor._id },
    stageHistory: [],
    auditLog: [],
  });

  // James Okafor — qa_review, 2/3 documents (blocked transition demo)
  await Application.create({
    student: {
      firstName: 'James',
      lastName: 'Okafor',
      email: 'james.okafor@example.com',
      dateOfBirth: '1999-08-03',
      nationality: 'Nigeria',
    },
    course: { name: 'BSc Economics', level: 'undergraduate' },
    university: { name: 'University of Leeds' },
    intake: '2025-09',
    currentStage: Stages.QA_REVIEW,
    status: 'active',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS.map((d, i) => ({
      ...d,
      uploaded: i < 2,
      uploadedAt: i < 2 ? new Date() : undefined,
    })),
    createdById: counsellor._id,
    assignedOfficers: { counsellorId: counsellor._id, qaOfficerId: qa._id },
    stageHistory: [
      { from: Stages.NEW_APP, to: Stages.QA_REVIEW, by: counsellor._id, at: new Date() },
    ],
    auditLog: [],
  });

  // Priya Sharma — app_review, all docs, no reviewNote (blocked decision demo)
  await Application.create({
    student: {
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@example.com',
      dateOfBirth: '2000-11-22',
      nationality: 'India',
    },
    course: { name: 'MBA', level: 'postgraduate' },
    university: { name: 'University of Birmingham' },
    intake: '2025-09',
    currentStage: Stages.APP_REVIEW,
    status: 'active',
    requiredDocuments: DEFAULT_REQUIRED_DOCUMENTS.map((d) => ({
      ...d,
      uploaded: true,
      uploadedAt: new Date(),
    })),
    createdById: counsellor._id,
    assignedOfficers: {
      counsellorId: counsellor._id,
      qaOfficerId: qa._id,
      admissionOfficerId: admission._id,
    },
    stageHistory: [
      { from: Stages.NEW_APP, to: Stages.QA_REVIEW, by: counsellor._id, at: new Date() },
      { from: Stages.QA_REVIEW, to: Stages.APP_REVIEW, by: qa._id, at: new Date() },
    ],
    auditLog: [],
    notes: [
      {
        body: 'QA passed — ready for admission review.',
        internal: true,
        authorId: qa._id,
        authorRole: Roles.QA_OFFICER,
        createdAt: new Date(),
      },
    ],
  });

  const qaApp = await Application.findOne({ 'student.lastName': 'Okafor' });
  if (qaApp) await aiAssessmentService.runForStage(qaApp._id.toString(), Stages.QA_REVIEW);
  const reviewApp = await Application.findOne({ 'student.lastName': 'Sharma' });
  if (reviewApp) await aiAssessmentService.runForStage(reviewApp._id.toString(), Stages.APP_REVIEW);

  return {
    message: 'Seed complete',
    users: USERS.map((u) => ({ email: u.email, password: DEMO_PASSWORD, role: u.role })),
  };
}

async function main() {
  if (!env.mongoUri) {
    console.error('MONGODB_URI required');
    process.exit(1);
  }
  await mongoose.connect(env.mongoUri);
  try {
    const result = await runSeed();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
