import type { AiProvider, AssessmentResult } from './AiProvider.interface';
import type { IApplication } from '../models/Application';
import { env } from '../config/env';
import { buildQaReviewPrompt } from './prompts/qa-review.prompt';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAiProvider implements AiProvider {
  async assess(application: IApplication, _stage: string): Promise<AssessmentResult> {
    if (process.env.NODE_ENV !== 'test') {
      console.log('[AI prompt preview]\n', buildQaReviewPrompt(application).slice(0, 200), '...');
    }

    const latency = 300 + Math.floor(Math.random() * 500);
    await delay(latency);

    if (env.aiRequestTimeoutMs < latency) {
      throw new Error('AI_TIMEOUT');
    }

    const missingDocuments = application.requiredDocuments
      .filter((d) => !d.uploaded)
      .map((d) => d.label);

    const uploadedCount = application.requiredDocuments.filter((d) => d.uploaded).length;
    const totalDocs = application.requiredDocuments.length;
    const allUploaded = missingDocuments.length === 0;

    const flags: string[] = allUploaded
      ? []
      : [`Only ${uploadedCount}/${totalDocs} documents uploaded`];

    const risks: string[] = [
      'English language certificate not yet verified',
      'Visa history not confirmed',
    ];

    const recommendation = allUploaded ? 'READY' : 'NEEDS_ATTENTION';

    const readinessScore = Math.max(0, 100 - missingDocuments.length * 20 - risks.length * 10);

    return {
      readinessScore,
      recommendation,
      flags,
      missingDocuments,
      risks,
      summary: allUploaded
        ? `All documents are present for ${application.course.name} at ${application.university.name}. Application appears ready for review. Verify English language requirements before proceeding.`
        : `${application.student.firstName}'s application is missing ${totalDocs - uploadedCount} document(s). These must be uploaded before the application can be fully assessed.`,
      advisory: true,
    };
  }
}
