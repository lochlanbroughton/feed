import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/index";
import example from "./fixtures/example-edition.json";
import type { EditionInput } from "../src/schema";

export const TOKEN = "test-token";

/** A deep copy of the real 2026-09-05 payload, safe to mutate per test. */
export function edition(overrides: Partial<EditionInput> = {}): EditionInput {
  return { ...structuredClone(example), ...overrides } as EditionInput;
}

/** Drives the Worker the way the runtime does, including waitUntil work. */
export async function call(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<Response> {
  const { token, headers, ...rest } = init;
  const req = new Request(`https://digest.test${path}`, {
    ...rest,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(headers as Record<string, string> | undefined),
    },
  });
  const ctx = createExecutionContext();
  const res = await worker.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

/** POST /ingest. Pass `null` as the token to send no authorization header. */
export async function ingest(
  payload: unknown,
  token: string | null = TOKEN,
): Promise<Response> {
  return call("/ingest", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
    token,
  });
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  ...binds: unknown[]
): Promise<T | null> {
  return env.DB.prepare(sql).bind(...binds).first<T>();
}

export async function all<T = Record<string, unknown>>(
  sql: string,
  ...binds: unknown[]
): Promise<T[]> {
  const { results } = await env.DB.prepare(sql).bind(...binds).all<T>();
  return results;
}

export async function count(table: string, where = "1=1", ...binds: unknown[]) {
  const row = await one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, ...binds);
  return row!.n;
}

/**
 * Storage is shared across the tests in a file, so each one starts from a
 * clean database. link_clicks and links go first because the rest is reached
 * by cascading from editions.
 */
export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM link_clicks`),
    env.DB.prepare(`DELETE FROM links`),
    env.DB.prepare(`DELETE FROM editions`),
    env.DB.prepare(`DELETE FROM threads`),
    env.DB.prepare(`DELETE FROM entities`),
    env.DB.prepare(`DELETE FROM tags`),
    env.DB.prepare(`DELETE FROM stories_fts`),
  ]);
}
