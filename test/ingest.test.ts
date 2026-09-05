import { describe, it, expect, beforeEach } from "vitest";
import { ingest, edition, one, all, count, resetDb } from "./helpers";

const DATE = "2026-09-05";

describe("POST /ingest", () => {
  beforeEach(resetDb);

  it("rejects a request with no bearer token", async () => {
    const res = await ingest(edition(), null);
    expect(res.status).toBe(401);
    expect(await count("editions")).toBe(0);
  });

  it("rejects a bad token without touching the database", async () => {
    const res = await ingest(edition(), "nope");
    expect(res.status).toBe(401);
    expect(await count("editions")).toBe(0);
  });

  it("rejects a payload that fails the contract", async () => {
    const res = await ingest({ date: "05-09-2026", stories: [] });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe("invalid payload");
    expect(body.issues.length).toBeGreaterThan(0);
    expect(await count("editions")).toBe(0);
  });

  it("rejects a body that is not JSON", async () => {
    const res = await ingest("<html>");
    expect(res.status).toBe(422);
  });

  it("stores the edition, its stories, sources, tags and entities", async () => {
    const payload = edition();
    const res = await ingest(payload);
    expect(res.status).toBe(200);

    const body = (await res.json()) as Record<string, number | string | boolean>;
    expect(body.ok).toBe(true);
    expect(body.edition).toBe(`ed_${DATE}`);
    expect(body.stories).toBe(payload.stories.length);
    expect(body.candidates).toBe(payload.candidates!.length);

    const stories = await all<{ id: string; position: number; word_count: number }>(
      `SELECT id, position, word_count FROM stories ORDER BY position`,
    );
    expect(stories).toHaveLength(payload.stories.length);
    expect(stories[0].id).toBe(`st_${DATE}_${payload.stories[0].slug}`);
    // position is 1-based and follows payload order
    expect(stories.map((s) => s.position)).toEqual(
      payload.stories.map((_, i) => i + 1),
    );
    expect(stories[0].word_count).toBeGreaterThan(0);

    // sources carry a derived domain
    const src = await one<{ domain: string; url: string }>(
      `SELECT domain, url FROM sources ORDER BY id LIMIT 1`,
    );
    expect(src!.domain).toBe(new URL(src!.url).hostname.replace(/^www\./, ""));

    // every tag in the payload became a row, and the tag vocabulary was seeded
    const tagged = await count("story_tags");
    expect(tagged).toBe(payload.stories.reduce((n, s) => n + (s.tags?.length ?? 0), 0));
    expect(await count("tags")).toBeGreaterThan(0);

    // entity slugs are derived from names when the payload omits them
    const willison = await one<{ slug: string; kind: string }>(
      `SELECT slug, kind FROM entities WHERE name = 'Simon Willison'`,
    );
    expect(willison).toMatchObject({ slug: "simon-willison", kind: "person" });
  });

  it("links a story to its thread", async () => {
    const payload = edition();
    const withThread = payload.stories.find((s) => s.thread)!;
    await ingest(payload);

    const row = await one<{ slug: string; title: string; status: string }>(
      `SELECT th.slug, th.title, th.status
       FROM stories s JOIN threads th ON th.id = s.thread_id
       WHERE s.slug = ?`,
      withThread.slug,
    );
    expect(row).toMatchObject({
      slug: withThread.thread!.slug,
      title: withThread.thread!.title,
    });
  });

  it("records candidates that were considered but not included", async () => {
    const payload = edition();
    await ingest(payload);
    const rows = await all<{ included: number; title: string }>(
      `SELECT included, title FROM candidates ORDER BY id`,
    );
    expect(rows).toHaveLength(payload.candidates!.length);
    expect(rows.map((r) => r.included)).toEqual(
      payload.candidates!.map((c) => (c.included ? 1 : 0)),
    );
  });

  it("keeps the full payload in raw_json for re-rendering", async () => {
    const payload = edition();
    await ingest(payload);
    const row = await one<{ raw_json: string }>(`SELECT raw_json FROM editions`);
    const stored = JSON.parse(row!.raw_json);
    expect(stored.date).toBe(payload.date);
    expect(stored.stories).toHaveLength(payload.stories.length);
    // the parsed payload, so schema defaults are materialised
    expect(stored.stories[0].kind).toBeTruthy();
  });
});
