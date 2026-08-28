import type { NextConfig } from "next";

const noIndexHeader = { key: "X-Robots-Tag", value: "noindex, nofollow" };

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.yuzuu.co" }],
        destination: "https://yuzuu.co/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "app.yuzuu.co" }],
        destination: "https://yuzuu.co/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    const privateSources = [
      "/auth",
      "/auth/:path*",
      "/dashboard",
      "/dashboard/:path*",
      "/onboard",
      "/onboard/:path*",
      "/admin",
      "/admin/:path*",
      "/order/:path*",
      "/u/:handle/quiz",
      "/u/:handle/checkout",
      "/api/:path*",
    ];
    return privateSources.map((source) => ({
      source,
      headers: [noIndexHeader],
    }));
  },
};

export default nextConfig;
