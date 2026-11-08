import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained server bundle in .next/standalone, which the
  // production Docker image copies into the final (runner) stage. This keeps
  // the image free of node_modules/devDependencies and node_modules tracing
  // artifacts outside the server bundle.
  output: "standalone",
};

export default nextConfig;
