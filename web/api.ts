import {
  ApiErrorSchema,
  FeedbackListResponseSchema,
  FeedbackRecordResponseSchema,
} from '../shared/contract';
import type { FeedbackRecord } from '../shared/contract';

/**
 * The browser is a boundary too: every response is parsed against the same
 * schemas the service validates against, so a drifting API fails here loudly
 * rather than rendering nonsense.
 */
async function readBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) return body;

  const failure = ApiErrorSchema.safeParse(body);
  throw new Error(
    failure.success ? failure.data.error.message : `The service answered ${response.status}.`,
  );
}

/** A request that never arrived has no status to report, so it gets its own message. */
async function call(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch {
    throw new Error('Could not reach the service. Check your connection and try again.');
  }
}

export async function fetchRecords(): Promise<FeedbackRecord[]> {
  const response = await call('/api/feedback');
  return FeedbackListResponseSchema.parse(await readBody(response)).data.records;
}

export async function submitFeedback(text: string): Promise<FeedbackRecord> {
  const response = await call('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return FeedbackRecordResponseSchema.parse(await readBody(response)).data.record;
}
