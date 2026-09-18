import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { FeedbackContentSchema } from '../shared/contract';
import type { Extractor } from './extract';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = [
  'You triage product feedback.',
  'Summarise the submission in one sentence and suggest one short next step.',
  'Judge only from the text you are given; never invent detail it does not contain.',
].join(' ');

/** Ten seconds per call, no transport retries: two calls at most, then a 503. */
const TIMEOUT_MS = 10_000;


export function createAnthropicExtractor(apiKey: string): Extractor {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });

  return async (text, previousRejection) => {
    const prompt =
      previousRejection === undefined
        ? text
        : `${text}\n\nYour previous answer was rejected: ${previousRejection}. Answer again within the schema.`;

    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      output_config: {
        format: zodOutputFormat(FeedbackContentSchema),
      },
    });

    // Null when nothing parseable came back; the gate judges it like any answer.
    return message.parsed_output;
  };
}
