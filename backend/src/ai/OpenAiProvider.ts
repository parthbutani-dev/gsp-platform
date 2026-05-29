import type { AiProvider, AssessmentResult } from './AiProvider.interface';
import type { IApplication } from '../models/Application';
import { buildQaReviewPrompt } from './prompts/qa-review.prompt';

/**
 * Stub for production OpenAI integration — swap via AI_PROVIDER env.
 */
export class OpenAiProvider implements AiProvider {
  async assess(application: IApplication, stage: string): Promise<AssessmentResult> {
    const prompt = buildQaReviewPrompt(application);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      // const response = await fetch('https://api.openai.com/v1/chat/completions', {
      //   method: 'POST',
      //   headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      //   body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }] }),
      //   signal: controller.signal,
      // });
      void prompt;
      void stage;
      throw new Error(
        'OpenAI provider not configured — set OPENAI_API_KEY and uncomment integration'
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export { buildQaReviewPrompt };
