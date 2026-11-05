import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  turbopack: {
    resolveAlias: {
      // Browser: full Firestore SDK. Server (Cloudflare Workers): fetch-based Lite SDK,
      // because the full SDK's gRPC/protobuf code uses eval, which Workers block.
      "firebase/firestore": {
        browser: "@firebase/firestore",
        default: "./src/lib/firestore-server-shim.ts",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/brand/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/(favicon.ico|favicon.png|favicon-32x32.png|apple-touch-icon.png|manifest.json)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, private",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
