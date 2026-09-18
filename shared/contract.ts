import { z } from 'zod';

/** Longest submission we accept. Also bounds the copy stored on the record. */
export const MAX_TEXT_LENGTH = 5000;

/**
 * What the model is allowed to produce.
 *
 * There is no id, timestamp or status here, so a model that tries to supply one
 * cannot: the key is not part of the schema its output is validated against.
 * Unknown keys are dropped rather than rejected — keeping those fields out of
 * this schema already stops the model owning anything that matters, so failing
 * on an extra key would add a failure mode without adding safety.
 */
export const FeedbackContentSchema = z.object({
  category: z.enum(['bug', 'feature_request', 'praise', 'other']),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  severity: z.enum(['low', 'medium', 'high']),
  summary: z.string().trim().min(1),
  suggestedAction: z.string().trim().min(1),
});

const FeedbackStatusSchema = z.enum(['new', 'triaged', 'resolved']);

/** The stored record: the model's content plus the four fields this code owns. */
export const FeedbackRecordSchema = FeedbackContentSchema.extend({
  id: z.string().regex(/^fb_[0-9A-HJKMNP-TV-Z]{26}$/, 'expected "fb_" followed by a ULID'),
  submittedAt: z.iso.datetime(),
  status: FeedbackStatusSchema,
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

/**
 * Every success answers `{ data: { ... } }` and every failure `{ error: ... }`.
 * `data` is always an object with a named key — never a bare record, never a
 * bare array — so a caller never has to remember which endpoint wraps what, and
 * anything added later (a total, a cursor) is a new key rather than a new shape.
 */
export const FeedbackRecordResponseSchema = z.object({
  data: z.object({ record: FeedbackRecordSchema }),
});

export const FeedbackListResponseSchema = z.object({
  data: z.object({ records: z.array(FeedbackRecordSchema) }),
});

/** The input boundary: what a client may send to create a record. */
export const SubmitFeedbackRequestSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
});

const ErrorCodeSchema = z.enum([
  'invalid_request',
  'not_found',
  'extraction_failed',
  'internal_error',
]);

/**
 * One shape for every failure. `details` carries Zod issues only for
 * invalid_request, where they describe the caller's own input; model output and
 * runtime errors are logged, never returned.
 */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type FeedbackContent = z.infer<typeof FeedbackContentSchema>;
export type FeedbackRecord = z.infer<typeof FeedbackRecordSchema>;
export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;
export type FeedbackRecordResponse = z.infer<typeof FeedbackRecordResponseSchema>;
export type FeedbackListResponse = z.infer<typeof FeedbackListResponseSchema>;
export type SubmitFeedbackRequest = z.infer<typeof SubmitFeedbackRequestSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
