import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
 reactStrictMode: true,
 transpilePackages: ["@prisma/client", ".prisma/client"],
  async headers() {
    const csp = (scriptSrcExtra: string[] = []) =>
      [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${scriptSrcExtra.length ? ' ' + scriptSrcExtra.join(' ') : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
      ].join('; ')

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // Базовая CSP без 'unsafe-eval' — сужает XSS-поверхность.
          { key: 'Content-Security-Policy', value: csp() },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      // Swagger UI (/api/docs, admin-only) использует eval внутри standalone-preset.
      // Ослабленная CSP только для этого route — переопределяет базовую.
      {
        source: '/api/docs',
        headers: [{ key: 'Content-Security-Policy', value: csp(["'unsafe-eval'"]) }],
      },
    ]
  },
};

export default withNextIntl(nextConfig);
