# DECISIONS

## Key choices

**Two schemas, not one.** The model is validated against `FeedbackContentSchema`,
which has no id, timestamp or status. It can't supply them: the keys aren't in the
schema its output is checked against. The service adds them in
`FeedbackRecordSchema`.

**The gate.** Every answer is validated against the contract before anything uses it.
A rejection buys one retry, informed by the Zod issues from the failed attempt. A
second rejection ends the request. The answer is never repaired to fit — repairing it
passes the model's output off as valid. It lives in its own module and knows nothing
about the provider.

**One envelope.** Every response is `{ data }` or `{ error }`, and `data` is always an
object with a named key, never a bare array. An array can't grow at its root: adding a
total or a cursor later would break every client.

**The key decides the extractor.** With an `ANTHROPIC_API_KEY`, the model; without
one, a deterministic fake, so the service runs with no credentials. An `AI_PROVIDER`
switch would be machinery for one real provider. The Lambda has no fake: nobody reads
a function's console, and a record built by keyword matching would sit in the store
looking real.

**Same origin for the dashboard and the API.** CloudFront serves both, so no CORS and
relative paths that work in development and deployed alike. CORS is the usual answer,
but the dashboard would need the API's URL at build time, and that URL only exists
after the first deploy.

**Also decided:** Hono over Express, for its Lambda adapter and in-memory testing ·
status required, with no default · no `.strict()`: the schema split already covers it ·
the trim lives in the contract, so one place normalises · no seeded data · counts by
category and severity — proportion resolved would always read zero · two tests, not
coverage · plain Vitest over Cucumber at two scenarios · no body-size cap, planned then
dropped: the contract bounds the only field read from the body · everything on main.

## Known limitations

The store is a Map: records don't survive a restart, and each Lambda environment holds
its own.

Two tests cover the two acceptance scenarios. The input boundary and the retry that
recovers are implemented but untested.

Within the 503, a provider that's down and a key it rejects look the same to the
caller; the logs name them apart. A key the deployment can't read never gets that far:
the function fails as it initialises, under its own event.

## With more time

**A transition endpoint.** The enum carries `new`, `triaged` and `resolved`, but
nothing moves a record between them. It's also what would make proportion resolved
worth showing.

**Telling the user which extractor answered.** The console and the README say it, the
dashboard doesn't. Gold-plating for an exercise, but a real service handing back
simulated content should say so where it's read.

Smaller: pagination, which the envelope leaves room for · Cucumber, with enough
scenarios to warrant it.

## Where AI wrote code, and where I made the calls

AI drove implementation speed, to a design and a set of criteria set here. The
decisions above came from me, as did the call on what "done and safe" means.

The clearest case was the extractor. AI kept proposing more than this needed: an
`AI_PROVIDER` switch with three modes, a local model embedded in the Lambda as a
container image, two models behind a runtime switch. Each worked; each was scope the
brief tells me to resist, and the container image is on the non-goals list.

The other is verification. The Anthropic structured-output call was flagged in review
as possibly OpenAI's syntax. I checked it against the published SDK package rather
than trust the generated code or my own memory, then ran it against
`claude-haiku-4-5`.

---

Time spent: around 6 - 7 hours, against the four to five the brief suggests.