import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { Extractor } from '../src/app';
import type { FeedbackContent } from '../src/contract';

type FeedbackApp = ReturnType<typeof createApp>;

const FEEDBACK_TEXT = 'The export button does nothing on Safari.';

function submitFeedback(app: FeedbackApp, body: unknown) {
  return app.request('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function listRecords(app: FeedbackApp) {
  const response = await app.request('/api/feedback');
  const listBody = (await response.json()) as { data: { records: unknown[] } };
  return listBody.data.records;
}

describe('Feature: Feedback intake', () => {
  it('Scenario: the model returns content that does not satisfy the contract', async () => {
    // Given an extractor that returns content violating the contract on every attempt
    let extractorCalls = 0;
    const extract: Extractor = async () => {
      extractorCalls += 1;
      return {
        category: 'urgent',
        sentiment: 'negative',
        severity: 'high',
        summary: 'Export is broken.',
        suggestedAction: 'Investigate Safari.',
      } as unknown as FeedbackContent;
    };
    const app = createApp({ extract });
    const recordsBefore = (await listRecords(app)).length;

    // When a client submits valid feedback text
    const response = await submitFeedback(app, { text: FEEDBACK_TEXT });

    // Then the request is rejected with a clear extraction error
    expect(response.status).toBe(502);
    const errorBody = (await response.json()) as { error?: { code?: string } };
    expect(errorBody.error?.code).toBe('extraction_failed');

    // And the extractor was called twice, one informed retry
    expect(extractorCalls).toBe(2);

    // And nothing was stored
    expect(await listRecords(app)).toHaveLength(recordsBefore);
  });
});
