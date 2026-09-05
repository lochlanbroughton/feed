import {
  EditionInput,
  domainOf,
  linkCode,
  slugify,
} from "./schema";

/** `DB` comes from wrangler.jsonc via `wrangler types`; the token is a secret. */
export interface Env extends Cloudflare.Env {
  INGEST_TOKEN: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // POST /ingest — the whole run, in one transaction
    if (req.method === "POST" && path === "/ingest") {
      const auth = req.headers.get("authorization");
      if (auth !== `Bearer ${env.INGEST_TOKEN}`) {
        return json({ error: "unauthorized" }, 401);
      }
      const parsed = EditionInput.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return json({ error: "invalid payload", issues: parsed.error.issues }, 422);
      }
      try {
        const result = await ingest(parsed.data, env);
        return json(result);
      } catch (err) {
        return json({ error: String(err) }, 500);
      }
    }

    // GET /editions/2026-09-05
    const edition = path.match(/^\/editions\/(\d{4}-\d{2}-\d{2})$/);
    if (req.method === "GET" && edition) {
      const found = await readEdition(edition[1], env);
      return found
        ? json(found)
        : json({ error: "not found", date: edition[1] }, 404);
    }

    // GET /threads/openai-rogue-agents
    const thread = path.match(/^\/threads\/([a-z0-9-]+)$/);
    if (req.method === "GET" && thread) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM thread_timeline WHERE thread_slug = ? ORDER BY date DESC`,
      )
        .bind(thread[1])
        .all();
      return json({ thread: thread[1], entries: results });
    }

    // GET /r/<code> — outbound redirect, logs the click
    const redirect = path.match(/^\/r\/([0-9a-z]{8})$/);
    if (req.method === "GET" && redirect) {
      const row = await env.DB.prepare(`SELECT url FROM links WHERE code = ?`)
        .bind(redirect[1])
        .first<{ url: string }>();
      if (!row) return json({ error: "unknown link" }, 404);
      ctx.waitUntil(
        env.DB.prepare(
          `INSERT INTO link_clicks (code, surface, user_agent, country)
           VALUES (?, ?, ?, ?)`,
        )
          .bind(
            redirect[1],
            url.searchParams.get("s") ?? "unknown",
            req.headers.get("user-agent")?.slice(0, 300) ?? null,
            (req as any).cf?.country ?? null,
          )
          .run(),
      );
      return Response.redirect(row.url, 302);
    }

    // GET /search?q=post-quantum
    if (req.method === "GET" && path === "/search") {
      const q = url.searchParams.get("q");
      if (!q) return json({ error: "missing q" }, 400);
      try {
        const { results } = await search(q, env);
        return json({ query: q, results });
      } catch (err) {
        // FTS5 rejects plenty of things a person will type — a bare quote,
        // a leading AND, a stray colon. That is a bad request, not a 500.
        if (isFtsSyntaxError(err)) {
          return json({ error: "invalid search query", query: q }, 400);
        }
        throw err;
      }
    }

    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

const FTS_SYNTAX_ERROR = /fts5: syntax error|unterminated string|unknown special query|no such column/i;

function isFtsSyntaxError(err: unknown): boolean {
  return FTS_SYNTAX_ERROR.test(String((err as Error)?.message ?? err));
}

async function search(q: string, env: Env) {
  return env.DB.prepare(
    `SELECT e.date, s.slug, s.headline, s.dek,
            snippet(stories_fts, 3, '<mark>', '</mark>', '…', 24) AS excerpt
     FROM stories_fts f
     JOIN stories  s ON s.id = f.story_id
     JOIN editions e ON e.id = s.edition_id
     WHERE stories_fts MATCH ?
     ORDER BY rank
     LIMIT 30`,
  )
    .bind(q)
    .all();
}

async function ingest(input: EditionInput, env: Env) {
  const { date } = input;
  const editionId = `ed_${date}`;
  const stmts: D1PreparedStatement[] = [];
  const D = env.DB;

  // Idempotent: wipe the day first. Cascades clear stories/sources/tags/
  // candidates; links survive with story_id set to NULL and are re-pointed
  // below, so click history is never lost.
  stmts.push(
    D.prepare(`DELETE FROM stories_fts WHERE story_id LIKE ?`).bind(`st_${date}_%`),
  );
  stmts.push(D.prepare(`DELETE FROM editions WHERE id = ?`).bind(editionId));

  stmts.push(
    D.prepare(
      `INSERT INTO editions
         (id, date, lede, notion_page_id, model, run_started_at, run_finished_at, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      editionId,
      date,
      input.lede ?? null,
      input.notion_page_id ?? null,
      input.model ?? null,
      input.run_started_at ?? null,
      input.run_finished_at ?? null,
      JSON.stringify(input),
    ),
  );

  let linkCount = 0;

  for (const [i, story] of input.stories.entries()) {
    const storyId = `st_${date}_${story.slug}`;
    let threadId: string | null = null;

    if (story.thread) {
      threadId = `th_${story.thread.slug}`;
      stmts.push(
        D.prepare(
          `INSERT INTO threads (id, slug, title, summary, status)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             title   = excluded.title,
             summary = COALESCE(excluded.summary, threads.summary),
             status  = excluded.status`,
        ).bind(
          threadId,
          story.thread.slug,
          story.thread.title,
          story.thread.summary ?? null,
          story.thread.status,
        ),
      );
    }

    stmts.push(
      D.prepare(
        `INSERT INTO stories
           (id, edition_id, thread_id, slug, position, kind, headline, dek, body, word_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        storyId,
        editionId,
        threadId,
        story.slug,
        i + 1,
        story.kind,
        story.headline,
        story.dek ?? null,
        story.body,
        story.body.trim().split(/\s+/).length,
      ),
    );

    stmts.push(
      D.prepare(
        `INSERT INTO stories_fts (story_id, headline, dek, body) VALUES (?, ?, ?, ?)`,
      ).bind(storyId, story.headline, story.dek ?? "", story.body),
    );

    for (const tag of story.tags) {
      stmts.push(
        D.prepare(`INSERT OR IGNORE INTO tags (slug, label) VALUES (?, ?)`).bind(tag, tag),
      );
      stmts.push(
        D.prepare(
          `INSERT OR IGNORE INTO story_tags (story_id, tag_slug) VALUES (?, ?)`,
        ).bind(storyId, tag),
      );
    }

    for (const ent of story.entities) {
      const entSlug = ent.slug ?? slugify(ent.name);
      const entId = `en_${entSlug}`;
      stmts.push(
        D.prepare(
          `INSERT INTO entities (id, slug, name, kind) VALUES (?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET name = excluded.name, kind = excluded.kind`,
        ).bind(entId, entSlug, ent.name, ent.kind),
      );
      stmts.push(
        D.prepare(
          `INSERT OR IGNORE INTO story_entities (story_id, entity_id, role) VALUES (?, ?, ?)`,
        ).bind(storyId, entId, ent.role ?? null),
      );
    }

    for (const [j, src] of story.sources.entries()) {
      const sourceId = `src_${storyId}_${j}`;
      stmts.push(
        D.prepare(
          `INSERT INTO sources
             (id, story_id, position, role, title, url, domain,
              readwise_id, readwise_url, hn_item_id, hn_comment_count)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          sourceId,
          storyId,
          j,
          src.role,
          src.title ?? null,
          src.url,
          domainOf(src.url),
          src.readwise_id ?? null,
          src.readwise_url ?? null,
          src.hn_item_id ?? null,
          src.hn_comment_count ?? null,
        ),
      );

      const code = await linkCode(story.slug, src.url);
      linkCount++;
      stmts.push(
        D.prepare(
          `INSERT INTO links (code, url, story_id, source_id) VALUES (?, ?, ?, ?)
           ON CONFLICT(code) DO UPDATE SET
             story_id  = excluded.story_id,
             source_id = excluded.source_id`,
        ).bind(code, src.url, storyId, sourceId),
      );
    }
  }

  for (const [k, cand] of input.candidates.entries()) {
    stmts.push(
      D.prepare(
        `INSERT INTO candidates
           (id, edition_id, readwise_id, title, url, domain, included, score, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        `cand_${date}_${k}`,
        editionId,
        cand.readwise_id ?? null,
        cand.title ?? null,
        cand.url ?? null,
        cand.url ? domainOf(cand.url) : null,
        cand.included ? 1 : 0,
        cand.score ?? null,
        cand.reason ?? null,
      ),
    );
  }

  // batch() runs the whole thing as one implicit transaction.
  await D.batch(stmts);

  return {
    ok: true,
    edition: editionId,
    stories: input.stories.length,
    links: linkCount,
    candidates: input.candidates.length,
    statements: stmts.length,
  };
}

async function readEdition(date: string, env: Env) {
  const edition = await env.DB.prepare(`SELECT * FROM editions WHERE date = ?`)
    .bind(date)
    .first();
  if (!edition) return null;

  const { results: stories } = await env.DB.prepare(
    `SELECT s.*, th.slug AS thread_slug, th.title AS thread_title
     FROM stories s
     LEFT JOIN threads th ON th.id = s.thread_id
     WHERE s.edition_id = ?
     ORDER BY s.position`,
  )
    .bind(edition.id)
    .all();

  const { results: sources } = await env.DB.prepare(
    `SELECT sr.*, l.code AS link_code
     FROM sources sr
     JOIN stories s ON s.id = sr.story_id
     LEFT JOIN links l ON l.source_id = sr.id
     WHERE s.edition_id = ?
     ORDER BY sr.story_id, sr.position`,
  )
    .bind(edition.id)
    .all();

  const { results: tags } = await env.DB.prepare(
    `SELECT st.story_id, st.tag_slug
     FROM story_tags st
     JOIN stories s ON s.id = st.story_id
     WHERE s.edition_id = ?
     ORDER BY st.story_id, st.tag_slug`,
  )
    .bind(edition.id)
    .all();

  return {
    ...edition,
    raw_json: undefined,
    stories: (stories as any[]).map((s) => ({
      ...s,
      sources: (sources as any[]).filter((x) => x.story_id === s.id),
      tags: (tags as any[]).filter((x) => x.story_id === s.id).map((x) => x.tag_slug),
    })),
  };
}
