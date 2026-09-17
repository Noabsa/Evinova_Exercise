# PLAN

## Scope

A Feedback Intake Service. A user submits freeform text, an AI model extracts a
structured summary, and the code validates that summary against a contract, stores
it, and serves it through a typed API and a small dashboard. The infrastructure is
written as code but not deployed.

The scope is driven by two decisions: what the model owns versus what the code owns, and what the service does when the model returns something the contract rejects. Everything outside those two is kept minimal.

**In:**

- A Zod contract, validated at every boundary, split so the model cannot supply the id, timestamp or status.
- AI extraction with one model call that turns the freeform text into the content fields; the code owns the id, timestamp and status.
- A validation gate on the model output that validates, retries once with the error fed back, and if it still fails rejects with a 502. Invalid output is never stored.
- A typed API with three endpoints, submit, list and get one, over an in-memory store.
- A dashboard showing the records plus at least one aggregate view, computed on the client.
- Two tests tied to the scenarios below, one written test-first.
- A CDK stack, synth only, not deployed.
- A hardening pass in HARDENING.md, a timeout on the model call, a body-size limit, and errors that never leak the model's raw output or stack traces.
- A decision log in DECISIONS.md, the key choices, the known limits, and where AI wrote code versus where I made the calls.

**Out, following the non-goals:**

- No auth, no real deployment, no persistent database. In-memory is expected.
- No broad coverage: the contract boundary and the invalid-output path, not everything.
- No UI polish, no routing, no global state. One screen, local state.
- No CI, no containers, no observability stack.
- No repository pattern or layered abstraction — over-engineering for a service this size.

## Risks

- **The model returns invalid output.** The gate validates it, retries once, and rejects with a 502 if it still fails. Nothing invalid is stored.
- **The model hangs.** A hang is not an error; the call would wait indefinitely. Handled with an explicit timeout in the harden phase.
- **The store is in-memory.** It does not survive a restart. Documented in DECISIONS.md.
- **Running without a model key.** With no key, the service falls back to a deterministic fake extractor, noted in the README, so it runs offline. Requesting the real provider without a key fails loudly rather than falling back silently.

## Acceptance criteria

These two scenarios are the specification. The invalid-output scenario is written test-first: the failing test is committed before the gate exists, so the history shows it. The happy path is written afterwards, where test-first adds nothing.

```gherkin
Scenario: A valid submission produces a conforming record
  Given a piece of feedback text
  And the model returns content that satisfies the contract
  When it is submitted
  Then a FeedbackRecord is created
  And it has a generated id, a submittedAt timestamp, and status "new"
  And every content field is within its allowed values

Scenario: The model returns content that violates the contract
  Given a piece of feedback text
  And the model returns content that violates the contract
  When it is submitted
  Then the extractor is called exactly twice
  And the invalid output is not stored
  And the request is rejected with a clear extraction error
```