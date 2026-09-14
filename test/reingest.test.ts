import { describe, it, expect, beforeEach } from "vitest";
import { ingest, edition, call, one, all, count, resetDb } from "./helpers";

const DATE = "2026-09-05";

async function linkCodes(): Promise<string[]> {
  const rows = await all<{ code: string }>(`SELECT code FROM links ORDER BY code`);
  return rows.map((r) => r.code);
}

describe("re-ingesting a day", () => {
  beforeEach(resetDb);

  it("is a clean replacement, not a duplicate or a constraint error", async () => {
    const payload = edition();

    const first = await ingest(payload);
    expect(first.status).toBe(200);
    const before = {
      editions: await count("editions"),
      stories: await count("stories"),
      sources: await count("sources"),
      threads: await count("threads"),
      entities: await count("entities"),
      story_tags: await count("story_tags"),
      candidates: await count("candidates"),
      links: await count("links"),
      fts: await count("stories_fts"),
    };

    const second = await ingest(payload);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, edition: `ed_${DATE}` });

    const after = {
      editions: await count("editions"),
      stories: await count("stories"),
      sources: await count("sources"),
      threads: await count("threads"),
      entities: await count("entities"),
      story_tags: await count("story_tags"),
      candidates: await count("candidates"),
      links: await count("links"),
      fts: await count("stories_fts"),
    };

    expect(after).toEqual(before);
  });

  it("survives a third and fourth run", async () => {
    const payload = edition();
    for (let i = 0; i < 4; i++) {
      const res = await ingest(payload);
      expect(res.status, `run ${i + 1}`).toBe(200);
    }
    expect(await count("editions")).toBe(1);
    expect(await count("stories")).toBe(payload.stories.length);
  });

  it("keeps link codes stable across a re-ingest", async () => {
    const payload = edition();
    await ingest(payload);
    const before = await linkCodes();
    expect(before.length).toBeGreaterThan(0);

    await ingest(payload);
    expect(await linkCodes()).toEqual(before);
  });

  it("keeps click history through a re-ingest and re-points the link", async () => {
    const payload = edition();
    await ingest(payload);

    const code = (await one<{ code: string }>(`SELECT code FROM links ORDER BY code LIMIT 1`))!.code;

    // two clicks from different surfaces
    expect((await call(`/r/${code}?s=notion`)).status).toBe(302);
    expect((await call(`/r/${code}?s=tui`)).status).toBe(302);
    expect(await count("link_clicks")).toBe(2);

    await ingest(payload);

    // the click rows are still there and still attached to a live story
    expect(await count("link_clicks")).toBe(2);
    expect(await count("link_clicks", "code = ?", code)).toBe(2);
    const link = await one<{ story_id: string | null; source_id: string | null }>(
      `SELECT story_id, source_id FROM links WHERE code = ?`,
      code,
    );
    expect(link!.story_id).not.toBeNull();
    expect(link!.source_id).not.toBeNull();

    // and the reporting view still attributes them
    const perf = await one<{ clicks: number; headline: string }>(
      `SELECT clicks, headline FROM link_performance WHERE code = ?`,
      code,
    );
    expect(perf!.clicks).toBe(2);
    expect(perf!.headline).toBeTruthy();
  });

  it("drops a story that the rerun no longer includes", async () => {
    const payload = edition();
    await ingest(payload);
    expect(await count("stories")).toBe(payload.stories.length);

    const trimmed = edition({ stories: [payload.stories[0]] });
    await ingest(trimmed);

    const rows = await all<{ slug: string }>(`SELECT slug FROM stories`);
    expect(rows.map((r) => r.slug)).toEqual([payload.stories[0].slug]);
    // its sources went with it
    expect(await count("sources", "story_id NOT IN (SELECT id FROM stories)")).toBe(0);
  });

  it("does not leave stale rows in the search index", async () => {
    const payload = edition();
    await ingest(payload);

    const rewritten = edition({
      stories: [{ ...payload.stories[0], headline: "A completely different headline" }],
    });
    await ingest(rewritten);

    expect(await count("stories_fts")).toBe(1);
    const res = await call(`/search?q=${encodeURIComponent("completely")}`);
    const body = (await res.json()) as { results: { headline: string }[] };
    expect(body.results).toHaveLength(1);
    expect(body.results[0].headline).toBe("A completely different headline");
  });

  it("keeps clicks that belong to a story the rerun dropped", async () => {
    const payload = edition();
    await ingest(payload);

    const dropped = payload.stories[1];
    const code = (await one<{ code: string }>(
      `SELECT l.code FROM links l JOIN stories s ON s.id = l.story_id WHERE s.slug = ? LIMIT 1`,
      dropped.slug,
    ))!.code;
    expect((await call(`/r/${code}?s=notion`)).status).toBe(302);

    await ingest(edition({ stories: [payload.stories[0]] }));

    // the link is orphaned rather than deleted, so the click survives
    const link = await one<{ story_id: string | null; url: string }>(
      `SELECT story_id, url FROM links WHERE code = ?`,
      code,
    );
    expect(link).not.toBeNull();
    expect(link!.story_id).toBeNull();
    expect(await count("link_clicks", "code = ?", code)).toBe(1);
    // and it still redirects
    expect((await call(`/r/${code}`)).status).toBe(302);
  });
});
