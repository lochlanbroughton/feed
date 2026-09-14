import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { ingest, edition, call, one, resetDb } from "./helpers";

const DATE = "2026-09-05";

describe("read endpoints", () => {
  beforeEach(async () => {
    await resetDb();
    await ingest(edition());
  });

  describe("GET /editions/:date", () => {
    it("reassembles the edition with sources and tags nested per story", async () => {
      const payload = edition();
      const res = await call(`/editions/${DATE}`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        id: string;
        date: string;
        raw_json?: unknown;
        stories: {
          slug: string;
          position: number;
          thread_slug: string | null;
          sources: { url: string; link_code: string | null }[];
          tags: string[];
        }[];
      };

      expect(body.id).toBe(`ed_${DATE}`);
      expect(body.date).toBe(DATE);
      // raw_json is stripped from the response; it is for re-rendering, not reading
      expect(body.raw_json).toBeUndefined();

      expect(body.stories).toHaveLength(payload.stories.length);
      expect(body.stories.map((s) => s.position)).toEqual([1, 2]);

      const first = body.stories[0];
      expect(first.slug).toBe(payload.stories[0].slug);
      // story_tags has no ordering column, so the response sorts by slug
      expect(first.tags).toEqual([...payload.stories[0].tags!].sort());
      expect(first.thread_slug).toBe(payload.stories[0].thread!.slug);
      expect(first.sources).toHaveLength(payload.stories[0].sources!.length);
      expect(first.sources.map((s) => s.url)).toEqual(
        payload.stories[0].sources!.map((s) => s.url),
      );
      // every source carries the short code the renderers link through
      for (const src of first.sources) expect(src.link_code).toMatch(/^[0-9a-z]{8}$/);
    });

    it("404s for a date that was never ingested", async () => {
      const res = await call("/editions/2020-01-01");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "not found", date: "2020-01-01" });
    });

    it("does not match a malformed date", async () => {
      expect((await call("/editions/2026-9-5")).status).toBe(404);
      expect((await call("/editions/yesterday")).status).toBe(404);
    });
  });

  describe("GET /threads/:slug", () => {
    it("returns the timeline for a running story", async () => {
      const slug = edition().stories[0].thread!.slug;
      const res = await call(`/threads/${slug}`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        thread: string;
        entries: { date: string; headline: string }[];
      };
      expect(body.thread).toBe(slug);
      expect(body.entries).toHaveLength(1);
      expect(body.entries[0].date).toBe(DATE);
    });

    it("spans editions, newest first", async () => {
      const day1 = edition();
      const day2 = edition({ date: "2026-09-06" });
      day2.stories[0].headline = "Day two";
      await ingest(day2);

      const res = await call(`/threads/${day1.stories[0].thread!.slug}`);
      const body = (await res.json()) as { entries: { date: string }[] };
      expect(body.entries.map((e) => e.date)).toEqual(["2026-09-06", "2026-09-05"]);
    });

    it("returns an empty timeline for an unknown thread", async () => {
      const res = await call("/threads/no-such-thread");
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ thread: "no-such-thread", entries: [] });
    });
  });

  describe("GET /search", () => {
    it("finds a story by a word in its body and marks the hit", async () => {
      const res = await call("/search?q=agents");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        query: string;
        results: { date: string; headline: string; excerpt: string }[];
      };
      expect(body.query).toBe("agents");
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0].date).toBe(DATE);
      expect(body.results.some((r) => r.excerpt?.includes("<mark>"))).toBe(true);
    });

    it("stems, so a singular query finds a plural body", async () => {
      const res = await call("/search?q=wiki");
      const body = (await res.json()) as { results: unknown[] };
      expect(body.results.length).toBeGreaterThan(0);
    });

    it("400s on a missing query", async () => {
      const res = await call("/search");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "missing q" });
    });

    // FTS5 rejects a lot of ordinary keyboard input. None of it should 500.
    it.each(['"', "AND", "*", "col:", "foo NEAR/", "()"])(
      "400s rather than throwing on the malformed query %j",
      async (q) => {
        const res = await call(`/search?q=${encodeURIComponent(q)}`);
        expect(res.status).toBe(400);
        expect(await res.json()).toMatchObject({ error: "invalid search query" });
      },
    );

    it("returns no results for a well-formed query that matches nothing", async () => {
      const res = await call("/search?q=zzzznotaword");
      expect(res.status).toBe(200);
      expect((await res.json()) as { results: unknown[] }).toMatchObject({ results: [] });
    });
  });

  describe("GET /r/:code", () => {
    it("redirects to the source and logs the click with its surface", async () => {
      const link = (await one<{ code: string; url: string }>(
        `SELECT code, url FROM links ORDER BY code LIMIT 1`,
      ))!;

      const res = await call(`/r/${link.code}?s=notion`, {
        headers: { "user-agent": "digest-tests/1.0" },
      });
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(link.url);

      const click = await one<{ surface: string; user_agent: string }>(
        `SELECT surface, user_agent FROM link_clicks WHERE code = ?`,
        link.code,
      );
      expect(click).toMatchObject({ surface: "notion", user_agent: "digest-tests/1.0" });
    });

    it("records 'unknown' when no surface is given", async () => {
      const code = (await one<{ code: string }>(`SELECT code FROM links LIMIT 1`))!.code;
      await call(`/r/${code}`);
      const click = await one<{ surface: string }>(
        `SELECT surface FROM link_clicks WHERE code = ?`,
        code,
      );
      expect(click!.surface).toBe("unknown");
    });

    it("404s for an unknown code", async () => {
      const res = await call("/r/00000000");
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "unknown link" });
    });
  });

  it("404s an unrouted path", async () => {
    expect((await call("/")).status).toBe(404);
    expect((await call("/ingest")).status).toBe(404); // GET, not POST
  });
});
