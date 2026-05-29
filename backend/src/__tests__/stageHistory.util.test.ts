import { Stages } from '@gsp/shared';
import { getDisplayStageHistory } from '../services/stageHistory.util';
import type { IApplication } from '../models/Application';

describe('getDisplayStageHistory', () => {
  it('preserves from/to when history entries are Mongoose-like subdocuments', () => {
    const subdoc = {
      from: Stages.NEW_APP,
      to: Stages.QA_REVIEW,
      at: new Date('2025-01-01'),
      reason: undefined,
      toObject() {
        return {
          from: Stages.NEW_APP,
          to: Stages.QA_REVIEW,
          at: this.at,
          reason: this.reason,
        };
      },
    };

    const app = {
      entryPoint: 'standard',
      stageHistory: [subdoc],
    } as unknown as IApplication;

    const history = getDisplayStageHistory(app);
    expect(history).toHaveLength(1);
    expect(history[0].from).toBe(Stages.NEW_APP);
    expect(history[0].to).toBe(Stages.QA_REVIEW);
  });
});
