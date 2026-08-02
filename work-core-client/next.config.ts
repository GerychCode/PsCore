import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Вимикає dev-індикатори завантаження/компіляції
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3022',
        pathname: '/uploads/**',
      },
    ],
  },
  // Заголовки безпеки для всіх сторінок фронта
  async headers() {
    const securityHeaders = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      // Токени приходять у query (?token=) — не зливати їх у Referer
      { key: 'Referrer-Policy', value: 'no-referrer' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
      // HSTS вмикати лише коли фронт віддається через HTTPS
      ...(process.env.NEXT_PUBLIC_SERVER_PROTOCOL === 'https'
        ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains',
            },
          ]
        : []),
    ]
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
