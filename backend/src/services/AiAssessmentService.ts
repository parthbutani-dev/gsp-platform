import { Stages, type Stage } from '@gsp/shared';
import { AiAssessment } from '../models/AiAssessment';
import { Application } from '../models/Application';
import { MockAiProvider } from '../ai/MockAiProvider';
import type { AiProvider } from '../ai/AiProvider.interface';
import { env } from '../config/env';
import { domainEvents } from '../utils/domainEvents';
import { PROMPT_VERSION } from '../ai/prompts/qa-review.prompt';

function getProvider(): AiProvider {
  if (env.aiProvider === 'openai') {
    const { OpenAiProvider } = require('../ai/OpenAiProvider');
    return new OpenAiProvider();
  }
  return new MockAiProvider();
}

export class AiAssessmentService {
  async runForStage(applicationId: string, stage: Stage): Promise<void> {
    if (stage !== Stages.QA_REVIEW && stage !== Stages.APP_REVIEW) return;

    const app = await Application.findById(applicationId);
    if (!app) return;

    const existing = await AiAssessment.findOne({ applicationId, stage, status: 'pending' });
    if (existing) return;

    const assessment = await AiAssessment.create({
      applicationId,
      stage,
      status: 'pending',
      promptVersion: PROMPT_VERSION,
    });

    try {
      const provider = getProvider();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI_TIMEOUT')), env.aiRequestTimeoutMs)
      );

      const result = await Promise.race([provider.assess(app, stage), timeoutPromise]);

      assessment.status = 'completed';
      assessment.result = result;
      await assessment.save();

      domainEvents.emitEvent({
        type: 'ai.assessment.completed',
        applicationId,
        stage,
      });
    } catch (err) {
      assessment.status = 'failed';
      assessment.errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await assessment.save();
    }
  }

  async getLatest(applicationId: string, stage: Stage) {
    return AiAssessment.findOne({ applicationId, stage }).sort({ createdAt: -1 });
  }

  async getOrRefresh(applicationId: string, stage: Stage, refresh: boolean) {
    if (!refresh) {
      return this.getLatest(applicationId, stage);
    }
    await AiAssessment.deleteMany({ applicationId, stage });
    await this.runForStage(applicationId, stage);
    return this.getLatest(applicationId, stage);
  }
}

export const aiAssessmentService = new AiAssessmentService();
