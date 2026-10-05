import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
