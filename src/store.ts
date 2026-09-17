import type { FeedbackRecord } from './contract';

/**
 * In-memory store. A factory rather than a module-level Map so each app — and
 * so each test — gets its own, with no state carried between them.
 */
export function createStore() {
  const recordsById = new Map<string, FeedbackRecord>();

  return {
    add(record: FeedbackRecord): FeedbackRecord {
      recordsById.set(record.id, record);
      return record;
    },
    get(recordId: string): FeedbackRecord | undefined {
      return recordsById.get(recordId);
    },
    list(): FeedbackRecord[] {
      return [...recordsById.values()];
    },
  };
}

export type Store = ReturnType<typeof createStore>;
