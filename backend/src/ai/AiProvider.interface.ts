import type { IApplication } from '../models/Application';

export interface AssessmentResult {
  readinessScore: number;
  recommendation: 'READY' | 'NEEDS_ATTENTION' | 'NOT_READY';
  flags: string[];
  missingDocuments: string[];
  risks: string[];
  summary: string;
  advisory: boolean;
}

export interface AiProvider {
  assess(application: IApplication, stage: string): Promise<AssessmentResult>;
}
