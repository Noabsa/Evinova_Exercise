import type { FeedbackContent } from '../shared/contract';
import type { Extractor } from './extract';

/**
 * Keyword matching, not inference. It exists so the service runs with no API key
 * — the brief allows a mocked AI response for offline running — and so nothing
 * in a demo depends on the network. It is never presented as a model answer.
 */
const BUG = /\b(bug|broken|crash\w*|error|fail\w*|does nothing|doesn't work|cannot|can't)\b/i;
const REQUEST = /\b(add|support|wish|would like|feature|please could|it would help)\b/i;
const PRAISE = /\b(love|great|excellent|brilliant|thank you|thanks)\b/i;
const SEVERE = /\b(crash\w*|data loss|lost|urgent|unusable|blocked|cannot)\b/i;

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
}

export const fakeExtractor: Extractor = async (text: string): Promise<FeedbackContent> => {
  const looksLikeBug = BUG.test(text);
  const looksLikeRequest = REQUEST.test(text);
  const looksLikePraise = PRAISE.test(text);

  const category = looksLikeBug ? 'bug' : looksLikeRequest ? 'feature_request' : looksLikePraise ? 'praise' : 'other';
  const sentiment = looksLikeBug ? 'negative' : looksLikePraise ? 'positive' : 'neutral';
  const severity = SEVERE.test(text) ? 'high' : looksLikeBug ? 'medium' : 'low';

  const suggestedAction = {
    bug: 'Reproduce the reported behaviour and open a defect.',
    feature_request: 'Add the request to the backlog for triage.',
    praise: 'Share with the team; no action needed.',
    other: 'Read the submission and decide who owns it.',
  }[category];

  return { category, sentiment, severity, summary: firstSentence(text), suggestedAction };
};
