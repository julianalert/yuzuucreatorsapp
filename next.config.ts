import type { NextConfig } from "next";

const noIndexHeader = { key: "X-Robots-Tag", value: "noindex, nofollow" };

/** Public routes of the retired creator product (archived on the
 * archive/creators-v1 branch). They send visitors to the pre-launch page
 * instead of a half-working app; /admin and /auth stay up for history. */
const retiredSources = [
  "/u/:path*",
  "/start",
  "/start/:path*",
  "/onboard",
  "/onboard/:path*",
  "/dashboard",
  "/dashboard/:path*",
  "/order/:path*",
  "/terms",
];

const nextConfig: NextConfig = {
  async redirects() {
    return retiredSources.map((source) => ({ source, destination: "/", permanent: false }));
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
