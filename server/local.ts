import { serve } from '@hono/node-server';
import { createApp } from './app';
import { createAnthropicExtractor } from './anthropic-extractor';
import { fakeExtractor } from './fake-extractor';

// The key decides: with one, the model answers; without one, the fake does, so
// the service runs offline. A deployed service should refuse to start instead —
// see HARDENING.md.
const apiKey = process.env.ANTHROPIC_API_KEY;
const extract = apiKey ? createAnthropicExtractor(apiKey) : fakeExtractor;
const port = Number(process.env.PORT ?? 3000);

console.warn(
  apiKey
    ? 'Extraction: Claude, via the Anthropic API.'
    : 'Extraction: deterministic fake, no model call. Set ANTHROPIC_API_KEY to use Claude.',
);

serve({ fetch: createApp({ extract }).fetch, port }, ({ port: listening }) => {
  console.log(`Listening on http://localhost:${listening}`);
});
