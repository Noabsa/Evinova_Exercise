import { Hono } from 'hono';
import type { Context } from 'hono';
import { ulid } from 'ulid';
import { SubmitFeedbackRequestSchema } from './contract';
import type { ErrorCode, FeedbackContent, FeedbackRecord } from './contract';
import { createStore } from './store';

/** One call in, structured content out. */
export type Extractor = (text: string) => Promise<FeedbackContent>;

function errorResponse(
  context: Context,
  status: 400 | 404 | 502,
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

    const extractedContent = await extract(text);

    // The four fields below are owned here, never by the model, and a record is
    // born "new" — there is no transition endpoint.
    const record: FeedbackRecord = {
      ...extractedContent,
      id: `fb_${ulid()}`,
      submittedAt: new Date().toISOString(),
      status: 'new',
      text,
    };

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

  return app;
}
