import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "10.55.162.172:3000",
    "10.55.162.172",
    "localhost",
  ],
};

export default nextConfig;
