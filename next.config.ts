import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1mb, too small for a phone camera receipt photo (the
      // uploadReceipt action in src/app/(app)/paragony/nowy/actions.ts
      // already rejects anything over 8mb on its own).
      bodySizeLimit: "8mb",
    },
  },
};

// Makes Cloudflare bindings (D1, R2, ...) available to getCloudflareContext()
// when running `next dev`, not just under `wrangler dev` / deployed.
initOpenNextCloudflareForDev();

export default nextConfig;
