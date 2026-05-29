import { EntryPoints, PIPELINE_STAGES, Stages, type Stage } from '@gsp/shared';
import { Types } from 'mongoose';
import type { IApplication, IStageHistoryEntry } from '../models/Application';

export type DisplayStageHistoryEntry = IStageHistoryEntry & { skipped?: boolean };

function plainHistoryEntry(entry: IStageHistoryEntry): IStageHistoryEntry {
  const doc = entry as IStageHistoryEntry & { toObject?: () => IStageHistoryEntry };
  return doc.toObject ? doc.toObject() : entry;
}

/** Full pipeline prefix for offer_exists apps entering at Decision. */
export function buildOfferExistsInitialHistory(
  by: Types.ObjectId,
  at: Date
): IStageHistoryEntry[] {
  const targetIdx = PIPELINE_STAGES.indexOf(Stages.DECISION);
  if (targetIdx <= 0) return [];

  const entries: IStageHistoryEntry[] = [];
  for (let i = 0; i < targetIdx; i++) {
    entries.push({
      from: PIPELINE_STAGES[i] as Stage,
      to: PIPELINE_STAGES[i + 1] as Stage,
      by,
      at,
      reason:
        i < targetIdx - 1
          ? 'Skipped — existing university offer (offer_exists entry point)'
          : 'offer_exists entry — application entered at Decision',
    });
  }
  return entries;
}

function isOfferExistsJump(entry: IStageHistoryEntry): boolean {
  return entry.from === Stages.NEW_APP && entry.to === Stages.DECISION;
}

function withSkippedFlags(entries: IStageHistoryEntry[]): DisplayStageHistoryEntry[] {
  return entries.map((entry) => {
    const plain = plainHistoryEntry(entry);
    return {
      ...plain,
      skipped: plain.reason?.startsWith('Skipped —') ?? false,
    };
  });
}

/** Chronological history for API/UI, expanding legacy offer_exists single-jump records. */
export function getDisplayStageHistory(app: IApplication): DisplayStageHistoryEntry[] {
  const sorted = [...app.stageHistory]
    .map(plainHistoryEntry)
    .sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  );

  if (app.entryPoint !== EntryPoints.OFFER_EXISTS) {
    return withSkippedFlags(sorted);
  }

  const legacySingleJump = sorted.length === 1 && isOfferExistsJump(sorted[0]);
  if (legacySingleJump) {
    const stub = sorted[0];
    return withSkippedFlags(
      buildOfferExistsInitialHistory(stub.by as Types.ObjectId, stub.at)
    );
  }

  const withoutJumpStub = sorted.filter((h) => !isOfferExistsJump(h));
  const hasPrefixSteps =
    sorted.some((h) => h.from === Stages.NEW_APP && h.to === Stages.QA_REVIEW) ||
    sorted.some((h) => h.from === Stages.QA_REVIEW && h.to === Stages.APP_REVIEW);

  if (hasPrefixSteps) {
    return withSkippedFlags(sorted);
  }

  if (withoutJumpStub.length > 0) {
    const prefix = buildOfferExistsInitialHistory(app.createdById, app.createdAt);
    return withSkippedFlags([...prefix, ...withoutJumpStub]);
  }

  return withSkippedFlags(
    buildOfferExistsInitialHistory(app.createdById, app.createdAt)
  );
}
