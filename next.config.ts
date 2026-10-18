import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["webmscore"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
