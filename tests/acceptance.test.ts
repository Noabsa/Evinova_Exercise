import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { Extractor } from '../src/extract';
import { FeedbackRecordResponseSchema } from '../src/contract';
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
  it('Scenario: A valid submission produces a conforming record', async () => {
    // Given a piece of feedback text
    // And the model returns content that satisfies the contract
    const modelContent: FeedbackContent = {
      category: 'bug',
      sentiment: 'negative',
      severity: 'high',
      summary: '  The export button does nothing on Safari.  ',
      suggestedAction: '  Reproduce the export flow on Safari and fix the handler.  ',
    };
    const extract: Extractor = async () => modelContent;
    const app = createApp({ extract });

    // When it is submitted
    const response = await submitFeedback(app, { text: FEEDBACK_TEXT });

    // Then a FeedbackRecord is created — the response parses against the contract or this throws
    expect(response.status).toBe(201);
    const { data } = FeedbackRecordResponseSchema.parse(await response.json());
    const record = data.record;

    // And it has a generated id, a submittedAt timestamp, and status "new"
    expect(record.id).toMatch(/^fb_/);
    expect(Number.isNaN(Date.parse(record.submittedAt))).toBe(false);
    expect(record.status).toBe('new');

    // And every content field is within its allowed values — the parse above rejects
    // anything outside the enums, so asserting it again here would prove nothing

    // And the content is stored trimmed
    expect(record.summary).toBe(modelContent.summary.trim());
    expect(record.suggestedAction).toBe(modelContent.suggestedAction.trim());
  });

  it('Scenario: The model returns content that violates the contract', async () => {
    // Given a piece of feedback text
    // And the model returns content that violates the contract
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

    // When it is submitted
    const response = await submitFeedback(app, { text: FEEDBACK_TEXT });

    // Then the extractor is called exactly twice
    expect(extractorCalls).toBe(2);

    // And the invalid output is not stored
    expect(await listRecords(app)).toHaveLength(recordsBefore);

    // And the request is rejected with a clear extraction error
    expect(response.status).toBe(502);
    const errorBody = (await response.json()) as { error?: { code?: string } };
    expect(errorBody.error?.code).toBe('extraction_failed');
  });
});
