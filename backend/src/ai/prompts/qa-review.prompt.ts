import type { IApplication } from '../../models/Application';

export const PROMPT_VERSION = '1.0';

export function buildQaReviewPrompt(app: IApplication): string {
  const docs = app.requiredDocuments
    .map((d) => `- ${d.label}: ${d.uploaded ? 'uploaded' : 'MISSING'}`)
    .join('\n');

  return `You are an admissions QA assistant for UK higher education.

Evaluate this application for readiness before manual QA review.

Student: ${app.student.firstName} ${app.student.lastName} (${app.student.nationality})
Course: ${app.course.name} (${app.course.level})
University: ${app.university.name}
Intake: ${app.intake}

Required documents:
${docs}

Return a JSON object with:
- readinessScore (0-100)
- missingDocuments (array of strings)
- risks (array of strings)
- summary (string, advisory tone)

Treat output as advisory only — the QA officer makes the final decision.`;
}
