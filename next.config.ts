import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

// Makes Cloudflare bindings (D1, R2, ...) available to getCloudflareContext()
// when running `next dev`, not just under `wrangler dev` / deployed.
initOpenNextCloudflareForDev();

export default nextConfig;
