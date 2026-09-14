/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from "@cloudflare/vitest-pool-workers";

declare global {
  namespace Cloudflare {
    interface Env {
      /** Set in vitest.config.ts; the deployed Worker gets it as a secret. */
      INGEST_TOKEN: string;
      /** Test-only: migrations read on the Node side, applied in setup. */
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

export {};
