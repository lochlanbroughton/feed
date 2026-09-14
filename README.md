# Daily Digest — D1 store

Structured store for the digest. The Claude Code routine emits one JSON
payload per run, POSTs it here, and renders the Notion page from the same
object instead of writing markdown directly.

Notion is one renderer among several. The store is the source of truth.

## Setup

```sh
npm install
npx wrangler d1 create daily-digest          # paste database_id into wrangler.jsonc
npx wrangler types                           # regenerates worker-configuration.d.ts
npm run db:local                             # apply migrations to the local replica
npm run db:remote                            # apply to the real DB
npx wrangler secret put INGEST_TOKEN         # any long random string
npm run deploy
```

For `wrangler dev`, put the same token in a `.dev.vars` file (gitignored):

```
INGEST_TOKEN=local-dev-token
```

## Endpoints

| Method | Path                  | Purpose                                    |
|--------|-----------------------|--------------------------------------------|
| POST   | `/ingest`             | Whole run, one transaction. Bearer token.  |
| GET    | `/editions/:date`     | Reassembled edition as JSON                |
| GET    | `/threads/:slug`      | Timeline of a running story                |
| GET    | `/r/:code?s=notion`   | Outbound redirect, logs the click          |
| GET    | `/search?q=...`       | FTS5 across every story ever written       |

## Ingest

```sh
curl -X POST https://daily-digest.<subdomain>.workers.dev/ingest \
  -H "authorization: Bearer $INGEST_TOKEN" \
  -H "content-type: application/json" \
  --data @edition.json
```

Re-POSTing the same date is safe. IDs are deterministic (`st_<date>_<slug>`),
the day is wiped and rewritten, and short-link codes are a hash of
`story_slug + url` so click history survives a re-run.

`test/fixtures/example-edition.json` is a real payload, useful as a smoke test
and as the shape the routine needs to emit.

## Tests

```sh
npm test         # vitest, against real workerd + D1 via @cloudflare/vitest-pool-workers
npm run typecheck
```

Migrations are applied to each test's database from `migrations/`, so the
tests run against the same schema the deploy does. No Cloudflare account is
needed. The cases that matter are re-ingest idempotency, link-code stability
and click survival — `test/reingest.test.ts`.

## Invariants

Worth knowing before changing anything here.

- **Deterministic IDs.** `ed_<date>`, `st_<date>_<slug>`, `src_<story_id>_<n>`.
  Re-running a day wipes and rewrites it, so a failed run costs nothing.
- **Link codes are a hash of `story_slug + url`,** and `links.story_id` is
  `ON DELETE SET NULL` rather than cascade, so a link outlives the story it
  came from and click history survives a re-ingest. Changing how the code is
  derived orphans every click ever recorded; `test/schema.test.ts` pins the
  hash against known codes for exactly that reason.
- **No denormalised counters.** Tag counts, thread lengths and entity mention
  counts come from the views (`tag_usage`, `thread_timeline`,
  `entity_mentions`, `link_performance`, `tag_engagement`). Don't add columns
  that need incrementing.
- **`raw_json` holds the full payload,** so a past edition can be re-rendered
  against a new template without re-running the agent.
- **Ingest is one `D1.batch()`** — that is the implicit transaction. If a
  payload ever exceeds the batch limit, chunk by edition, never mid-edition.

## Open questions

- `stories_fts` is standalone rather than external-content FTS5, so re-ingest
  is a plain delete-and-insert keyed on `story_id LIKE 'st_<date>_%'`. Fine at
  this scale; revisit if the archive gets large.
- The `kind` CHECK constraint on `stories` (`lede | feature | brief | ledger |
  quick_hit | local`) was inferred from a single edition. Widen it after
  looking at more of the archive.
- `candidates.score` has no defined scale yet. The routine should pick one and
  stay consistent.
- A story slug reused on a later date with the same source URL produces the
  same link code, so the link re-points to the newer story. That is inherent
  to hashing `story_slug + url`; the clicks are kept either way.

## Queries worth having handy

```sh
# tag drift
npx wrangler d1 execute daily-digest --remote \
  --command "SELECT * FROM tag_usage ORDER BY uses DESC LIMIT 20"

# what you actually open vs what you just collect
npx wrangler d1 execute daily-digest --remote \
  --command "SELECT * FROM tag_engagement ORDER BY clicks_per_story DESC LIMIT 20"

# a running thread
npx wrangler d1 execute daily-digest --remote \
  --command "SELECT date, headline FROM thread_timeline WHERE thread_slug='openai-agent-incidents' ORDER BY date"
```
