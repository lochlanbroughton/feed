import { describe, it, expect } from "vitest";
import {
  EditionInput,
  StoryInput,
  slugify,
  domainOf,
  linkCode,
} from "../src/schema";

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Simon Willison")).toBe("simon-willison");
    expect(slugify("  OpenAI  ")).toBe("openai");
  });

  it("drops punctuation but keeps the words", () => {
    expect(slugify("O'Reilly & Sons, Inc.")).toBe("oreilly-sons-inc");
  });

  it("folds accents rather than dropping the letter", () => {
    expect(slugify("Beyoncé Knowles")).toBe("beyonce-knowles");
  });

  it("caps length so it stays a usable key", () => {
    expect(slugify("a".repeat(200))).toHaveLength(64);
  });
});

describe("domainOf", () => {
  it("strips the www prefix", () => {
    expect(domainOf("https://www.reuters.com/tech/x")).toBe("reuters.com");
    expect(domainOf("https://news.ycombinator.com/item?id=1")).toBe("news.ycombinator.com");
  });

  it("returns null rather than throwing on junk", () => {
    expect(domainOf("not a url")).toBeNull();
    expect(domainOf("")).toBeNull();
  });
});

describe("linkCode", () => {
  const url = "https://simonwillison.net/2026/Sep/4/rogue-agent-wikis/";

  it("is 8 chars of the Crockford alphabet", async () => {
    const code = await linkCode("agents-found-the-wikis", url);
    expect(code).toMatch(/^[0-9abcdefghjkmnpqrstvwxyz]{8}$/);
  });

  it("is stable for the same story and url", async () => {
    const a = await linkCode("agents-found-the-wikis", url);
    const b = await linkCode("agents-found-the-wikis", url);
    expect(a).toBe(b);
  });

  /**
   * Pinned on purpose. The code is the join between a story and its click
   * history, so changing how it is derived silently orphans every click ever
   * recorded. If this fails, that is the change you are making.
   */
  it("matches the codes already in the wild", async () => {
    expect(await linkCode("agents-found-the-wikis", url)).toBe("s0hax17g");
    expect(await linkCode("agents-found-the-wikis", "https://collusion.wiki/")).toBe(
      "4f0fm7ff",
    );
  });

  it("separates the two inputs, so a slug/url shift cannot collide", async () => {
    const a = await linkCode("ab", "c");
    const b = await linkCode("a", "bc");
    expect(a).not.toBe(b);
  });

  it("differs per story for the same url", async () => {
    expect(await linkCode("story-one", url)).not.toBe(await linkCode("story-two", url));
  });
});

describe("the ingest contract", () => {
  const minimalStory = {
    slug: "a-story",
    headline: "A headline",
    body: "Some body text.",
  };

  it("fills in the defaults the store relies on", () => {
    const parsed = StoryInput.parse(minimalStory);
    expect(parsed).toMatchObject({ kind: "feature", tags: [], sources: [], entities: [] });
  });

  it("requires kebab-case slugs", () => {
    for (const slug of ["Not Kebab", "trailing-", "under_score", "UPPER"]) {
      expect(StoryInput.safeParse({ ...minimalStory, slug }).success, slug).toBe(false);
    }
  });

  it("requires an ISO date and at least one story", () => {
    expect(EditionInput.safeParse({ date: "2026-9-5", stories: [minimalStory] }).success).toBe(false);
    expect(EditionInput.safeParse({ date: "2026-09-05", stories: [] }).success).toBe(false);
    expect(EditionInput.safeParse({ date: "2026-09-05", stories: [minimalStory] }).success).toBe(true);
  });

  it("rejects a source url that is not a url", () => {
    const bad = { ...minimalStory, sources: [{ url: "example.com" }] };
    expect(StoryInput.safeParse(bad).success).toBe(false);
  });

  it("rejects a kind outside the section taxonomy", () => {
    expect(StoryInput.safeParse({ ...minimalStory, kind: "editorial" }).success).toBe(false);
  });
});
