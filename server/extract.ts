import type { ZodError } from 'zod';
import { FeedbackContentSchema } from '../shared/contract';
import type { FeedbackContent } from '../shared/contract';

/**
 * One call in, an answer out. The answer is `unknown` because it comes from a
 * model: only the gate below decides whether it is content. The second argument
 * is present on a retry and tells the model why its previous answer was rejected.
 */
export type Extractor = (text: string, previousRejection?: string) => Promise<unknown>;

/** The model returned something the contract rejects, twice. */
export class ExtractionFailedError extends Error {}

/** The model never answered: the provider refused, timed out or was unreachable. */
export class ExtractionUnavailableError extends Error {}

async function ask(extract: Extractor, text: string, previousRejection?: string): Promise<unknown> {
  try {
    return await extract(text, previousRejection);
  } catch (cause) {
    throw new ExtractionUnavailableError(cause instanceof Error ? cause.message : String(cause));
  }
}

function describeIssues(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`).join('; ');
}

/**
 * The gate: the model proposes, this decides. It knows nothing about which
 * provider produced the answer.
 *
 * Structured outputs make invalid output unlikely, not impossible, and the
 * contract — not the provider — is the authority, so every answer is validated.
 * A rejected answer buys one retry, informed by what was wrong with it. A second
 * rejection ends the request: invalid content is never repaired, defaulted or
 * coerced into something storable.
 */
export async function extractContent(extract: Extractor, text: string): Promise<FeedbackContent> {
  const firstAttempt = FeedbackContentSchema.safeParse(await ask(extract, text));
  if (firstAttempt.success) return firstAttempt.data;

  const retry = FeedbackContentSchema.safeParse(await ask(extract, text, describeIssues(firstAttempt.error)));
  if (retry.success) return retry.data;

  throw new ExtractionFailedError(describeIssues(retry.error));
}
