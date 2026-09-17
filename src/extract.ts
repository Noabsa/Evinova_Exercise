import type { ZodError } from 'zod';
import { FeedbackContentSchema } from './contract';
import type { FeedbackContent } from './contract';

/**
 * One call in, structured content out. The second argument is only present on a
 * retry: it tells the model why its previous answer was rejected.
 */
export type Extractor = (text: string, previousRejection?: string) => Promise<FeedbackContent>;

/** The model returned something the contract rejects, twice. */
export class ExtractionFailedError extends Error {}

function describeIssues(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}

/**
 * The gate: the model proposes, this decides.
 *
 * Structured outputs make invalid output unlikely, not impossible, and the
 * contract — not the provider — is the authority, so every answer is validated.
 * A rejected answer buys one retry, informed by what was wrong with it. A second
 * rejection ends the request: invalid content is never repaired, defaulted or
 * coerced into something storable.
 */
export async function extractContent(extract: Extractor, text: string): Promise<FeedbackContent> {
  const firstAttempt = FeedbackContentSchema.safeParse(await extract(text));
  if (firstAttempt.success) return firstAttempt.data;

  const retry = FeedbackContentSchema.safeParse(await extract(text, describeIssues(firstAttempt.error)));
  if (retry.success) return retry.data;

  throw new ExtractionFailedError(describeIssues(retry.error));
}
