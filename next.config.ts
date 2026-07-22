import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ['preview-chat-bcc2410c-1bf4-4467-87f1-7ef7f406e351.space-z.ai'],
};

export default nextConfig;
