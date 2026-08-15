// Minimal Cloudflare Workers config for this app: nearly every route is
// dynamic (reads cookies / talks to Supabase), so there is little to gain
// from the optional R2-backed incremental cache or Cloudflare Images
// bindings yet — add them later if static/ISR routes are introduced.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
