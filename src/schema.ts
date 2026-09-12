import { z } from "zod";

/**
 * The contract between the Claude Code routine and the store.
 * The routine emits one of these per run; the Notion page is then
 * rendered from the same object rather than written directly.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "kebab-case slug");

export const SourceInput = z.object({
  role: z.enum(["primary", "original", "discussion", "secondary"]).default("primary"),
  title: z.string().optional(),
  url: z.string().url(),
  readwise_id: z.string().optional(),
  readwise_url: z.string().url().optional(),
  hn_item_id: z.string().optional(),
  hn_comment_count: z.number().int().nonnegative().optional(),
});

export const EntityInput = z.object({
  name: z.string().min(1),
  slug: slug.optional(), // derived from name if absent
  kind: z.enum(["person", "org", "product", "place", "publication"]).default("person"),
  role: z.enum(["author", "subject", "mentioned"]).optional(),
});

export const ThreadInput = z.object({
  slug,
  title: z.string().min(1),
  summary: z.string().optional(),
  status: z.enum(["open", "dormant", "closed"]).default("open"),
});

export const StoryInput = z.object({
  slug,
  kind: z
    .enum(["lede", "feature", "brief", "ledger", "quick_hit", "local"])
    .default("feature"),
  headline: z.string().min(1),
  dek: z.string().optional(),
  body: z.string().min(1), // markdown
  thread: ThreadInput.optional(),
  tags: z.array(slug).default([]),
  sources: z.array(SourceInput).default([]),
  entities: z.array(EntityInput).default([]),
});

export const CandidateInput = z.object({
  readwise_id: z.string().optional(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  included: z.boolean().default(false),
  score: z.number().optional(),
  reason: z.string().optional(),
});

export const EditionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lede: z.string().optional(),
  notion_page_id: z.string().optional(),
  model: z.string().optional(),
  run_started_at: z.string().optional(),
  run_finished_at: z.string().optional(),
  stories: z.array(StoryInput).min(1),
  candidates: z.array(CandidateInput).default([]),
});

export type EditionInput = z.infer<typeof EditionInput>;
export type StoryInput = z.infer<typeof StoryInput>;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Stable 8-char code so re-ingesting a day preserves click history. */
export async function linkCode(storySlug: string, url: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${storySlug}\u0000${url}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz"; // Crockford base32
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[digest[i] % 32];
  return out;
}
