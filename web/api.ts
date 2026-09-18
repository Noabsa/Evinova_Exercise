import {
  ApiErrorSchema,
  FeedbackListResponseSchema,
  FeedbackRecordResponseSchema,
} from '../src/contract';
import type { FeedbackRecord } from '../src/contract';

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

export async function fetchRecords(): Promise<FeedbackRecord[]> {
  const response = await fetch('/api/feedback');
  return FeedbackListResponseSchema.parse(await readBody(response)).data.records;
}

export async function submitFeedback(text: string): Promise<FeedbackRecord> {
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return FeedbackRecordResponseSchema.parse(await readBody(response)).data.record;
}
