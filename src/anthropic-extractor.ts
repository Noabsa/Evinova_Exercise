import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { FeedbackContentSchema } from './contract';
import type { Extractor } from './extract';

const MODEL = 'claude-haiku-4-5';

const SYSTEM_PROMPT = [
  'You triage product feedback.',
  'Summarise the submission in one sentence and suggest one short next step.',
  'Judge only from the text you are given; never invent detail it does not contain.',
].join(' ');

/** The only file that knows which provider answers. Swapping it swaps the model. */
export function createAnthropicExtractor(apiKey: string): Extractor {
  const client = new Anthropic({ apiKey });

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

    // Null when the model produced nothing parseable. Returned as-is so the gate
    // treats it like any other answer the contract rejects.
    return message.parsed_output;
  };
}
