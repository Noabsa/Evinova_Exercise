# Feedback Intake Service

Freeform feedback goes in, an AI model extracts the structured content, the code
validates it against a Zod contract, stores it in memory and serves it through a
typed API and a small dashboard. The infrastructure is written as CDK and is never
deployed.

The model owns `category`, `sentiment`, `severity`, `summary` and `suggestedAction`.
The code owns the `id`, the `submittedAt` timestamp, the `status` and the submitted
text. Model output that fails the contract is retried once with the error fed back,
and rejected if it fails again — it is never stored.

## Requirements

Node 22 or later, npm 10.

## Run it locally

```bash
npm install
npm run dev
```

The dashboard is at http://localhost:5173 and the API at http://localhost:3000.
The dev server proxies `/api` to the API, so both sides share one origin and there
is no CORS to configure. `npm run dev:api` and `npm run dev:web` run them separately.

If 3000 is taken the API exits with `EADDRINUSE` and every submission fails. `PORT`
moves it, but the dev server's proxy expects 3000. If 5173 is taken the dev server
moves to the next free port and prints where it landed.

### Extraction: real or fake

Without a key the service uses a **deterministic fake extractor** — keyword matching,
no model call, no network — so it runs offline. It prints which one is active at
startup. The fake is never presented as a model answer; it exists so the service runs
without a key and nothing in a demo depends on the network.

To use Claude instead:

```bash
cp .env.example .env   # then put your key in ANTHROPIC_API_KEY
npm run dev
```

The model is `claude-haiku-4-5`, one call per submission, with a ten-second deadline
and no transport retries.

## Tests

```bash
npm test        # the two acceptance scenarios from PLAN.md
npm run typecheck
```

Each test is named to its Gherkin scenario. The invalid-output scenario was written
test-first: `759f162` commits the failing test, `b48990a` adds the gate that turns it
green.

## Infrastructure

```bash
npm run synth   # cdk synth, no deploy
```

CloudFront in front of a private S3 bucket for the dashboard, with `/api/*` routed to
an HTTP API and a Lambda holding the store in memory. The model key lives in Secrets
Manager; the function gets the ARN and permission to read it, never the value.

## API

| | |
| --- | --- |
| `POST /api/feedback` | `{ "text": "..." }` in, the created record out, 201 |
| `GET /api/feedback` | every record, newest first |
| `GET /api/feedback/:id` | one record, 404 if unknown |

Without the dashboard:

```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "content-type: application/json" \
  -d '{"text":"The export button does nothing on Safari."}'

curl http://localhost:3000/api/feedback
```

Errors answer as `{ "error": { "code", "message" } }`. The codes are
`invalid_request` (400), `not_found` (404), `extraction_failed` (502, the model
answered and broke the contract), `extraction_unavailable` (503, the model was never
reached) and `internal_error` (500).

## Layout

```
shared/   the Zod contract, used by the service, the tests and the browser
server/   the API, the extraction gate, the two extractors, the store
web/      the dashboard
tests/    the two acceptance scenarios
infra/    the CDK stack
```

## The rest of the write-up

[PLAN.md](PLAN.md) — scope, risks, the two Gherkin scenarios.
[HARDENING.md](HARDENING.md) — what was tightened, and what comes before production.
[DECISIONS.md](DECISIONS.md) — the choices, the limits, and where AI wrote the code.
