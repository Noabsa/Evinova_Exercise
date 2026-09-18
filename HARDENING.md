# HARDENING

Where I drew the line: *Tightened* is what this couldn't ship without. *Next* is what
I'd add, and why it isn't here.

## Tightened

**Errors that don't leak.** Unmatched routes and unhandled exceptions answer in the
contract's error shape rather than the framework's default. A failure that is not the
caller's mistake goes to the log under a named event with its status and cause — the
unhandled one adds the stack; the response carries a code and a fixed message.

**The right failure code.** 502 when the model's answer breaks the contract twice, 503
when the call itself fails — a timeout or a provider error — 500 for a defect here. A
caller can tell a retry from a dead end, and the reads keep working either way.

**A deadline on the call.** Ten seconds per call, no transport retries. A call that
never answers ends the request there; only a rejected answer buys a second call.

**A rate limit on the API.** The endpoint is open and every submission triggers a paid
model call, so the stage caps every route at five requests a second, ten in a burst.

**"Not there" vs "said no" in the browser.** A request that never arrives has no status
to report, so it gets its own message instead of the browser's raw failure.

## Next

Each of these needs a pipeline, a deployment or a second contributor. None of them
exist here, so any of it would be built against a guess.

**CI gates.** Lint, type-check, tests and `cdk synth` blocking the merge. With one
contributor the gate is the same tests run by hand.

**Smoke test after deploy.** A wrong secret ARN deploys fine and fails on the first
request. One call after deploy catches it: if it fails, roll back.

**Promotion.** Separate environments, and a manual approval before anything reaches
production.

**Persistence.** A real database behind the same three store methods, so records
survive a restart and every instance sees the same data.

**Metrics and traces.** Latency and error rate per endpoint, and the model call as its
own span — most of a request is spent there and the logs don't show how much.

**End-to-end tests.** A browser-level test of the dashboard with Playwright, run before
promoting. Flaky ones go to quarantine with a root cause, not a retry.