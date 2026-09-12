import { applyD1Migrations, env } from "cloudflare:test";

// Runs once per isolated-storage stack, before each test file's tests.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
