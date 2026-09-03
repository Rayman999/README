import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next infer the wrong
  // workspace root. Pin it to this project.
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Self-contained production server (only the files a request needs, no
  // full node_modules) — what the Dockerfile's runtime stage copies out.
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
