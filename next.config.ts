import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Client document uploads go through server actions (15 MB per file, several at once).
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
