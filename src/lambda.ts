import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { handle } from 'hono/aws-lambda';
import { createApp } from './app';
import { createAnthropicExtractor } from './anthropic-extractor';

const secrets = new SecretsManagerClient({});

async function readApiKey(): Promise<string> {
  const secretArn = process.env.ANTHROPIC_SECRET_ARN;
  if (!secretArn) throw new Error('ANTHROPIC_SECRET_ARN is not set on this function.');

  const secret = await secrets.send(new GetSecretValueCommand({ SecretId: secretArn }));
  if (!secret.SecretString) throw new Error('The model key secret holds no value.');

  return secret.SecretString;
}

/**
 * No fallback to the fake, by choice: the fake is a development tool, and using
 * it here would hide a missing key behind records that look plausible. Failing
 * while the function initialises keeps that bug visible, and pairs with a smoke
 * test after deploy and a rollback path. The reason is logged under its own
 * event first, so it survives the failure.
 */
const extractor = readApiKey()
  .then(createAnthropicExtractor)
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: 'model_key_unreadable',
        reason: error instanceof Error ? error.message : 'unknown',
      }),
    );
    throw error;
  });

export const handler = handle(
  createApp({
    extract: async (text, previousRejection) => (await extractor)(text, previousRejection),
  }),
);
