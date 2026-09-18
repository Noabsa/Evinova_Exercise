import { Hono } from 'hono';
import type { Context } from 'hono';
import { ulid } from 'ulid';
import { FeedbackRecordSchema, SubmitFeedbackRequestSchema } from '../shared/contract';
import type { ErrorCode } from '../shared/contract';
import { ExtractionFailedError, extractContent } from './extract';
import { createStore } from './store';

import type { Extractor } from './extract';

function errorResponse(
  context: Context,
  status: 400 | 404 | 500 | 502,
  code: ErrorCode,
  message: string,
  details?: unknown,
) {
  const error = { code, message, ...(details === undefined ? {} : { details }) };
  return context.json({ error }, status);
}

export function createApp({ extract }: { extract: Extractor }) {
  const store = createStore();
  const app = new Hono();

  app.post('/api/feedback', async (context) => {
    let requestBody: unknown;
    try {
      requestBody = await context.req.json();
    } catch {
      return errorResponse(context, 400, 'invalid_request', 'Request body must be JSON.');
    }

    const submission = SubmitFeedbackRequestSchema.safeParse(requestBody);
    if (!submission.success) {
      return errorResponse(
        context,
        400,
        'invalid_request',
        'Submission does not satisfy the contract.',
        submission.error.issues,
      );
    }
    const { text } = submission.data;

    let extractedContent;
    try {
      extractedContent = await extractContent(extract, text);
    } catch (error) {
      if (!(error instanceof ExtractionFailedError)) throw error;
      console.error(JSON.stringify({ event: 'extraction_rejected', reason: error.message }));
      return errorResponse(
        context,
        502,
        'extraction_failed',
        'The model did not return content that satisfies the contract.',
      );
    }

    // The four fields below are set by the service, never by the model, and a
    // record is born "new" — there is no transition endpoint.
    const record = FeedbackRecordSchema.parse({
      ...extractedContent,
      id: `fb_${ulid()}`,
      submittedAt: new Date().toISOString(),
      status: 'new',
      text,
    });

    store.add(record);
    return context.json({ data: { record } }, 201);
  });

  app.get('/api/feedback', (context) => context.json({ data: { records: store.list() } }));

  app.get('/api/feedback/:id', (context) => {
    const record = store.get(context.req.param('id'));
    if (!record) {
      return errorResponse(context, 404, 'not_found', 'No feedback record with that id.');
    }
    return context.json({ data: { record } });
  });

  app.notFound((context) =>
    errorResponse(context, 404, 'not_found', 'No route matches that path.'),
  );

  /**
   * Anything that reaches here is a defect, not a caller mistake. The cause is
   * logged; the response carries a code and nothing else, so no stack trace and
   * nothing the model produced can leave through an error.
   */
  app.onError((error, context) => {
    console.error(JSON.stringify({ event: 'unhandled_error', reason: error.message, stack: error.stack }));
    return errorResponse(context, 500, 'internal_error', 'The service failed to handle the request.');
  });

  return app;
}
