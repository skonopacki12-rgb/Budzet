// Wraps the OpenNext-generated Worker so we can add a `scheduled` handler
// (Cloudflare Cron Trigger) for push-notification checks alongside the
// normal Next.js `fetch` handler. `.open-next/worker.js` only exists after
// `opennextjs-cloudflare build` runs, not at plain `tsc`/`next build` time —
// see the matching exclude entry in tsconfig.json.
//@ts-expect-error: resolved by wrangler build, not by next build's typecheck
import openNextWorker, { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./src/db/schema";
import { runPushChecks } from "./src/lib/pushChecks";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };

export default {
  fetch: openNextWorker.fetch,
  async scheduled(_controller: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
    const db = drizzle(env.DB, { schema });
    ctx.waitUntil(
      runPushChecks(db, {
        subject: env.VAPID_SUBJECT,
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
      }),
    );
  },
};
