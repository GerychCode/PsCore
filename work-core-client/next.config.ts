import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  implementation: 'sass-embedded',
  reactStrictMode: false,
  devIndicators: {
    buildActivity: false, // Вимикає індикатор завантаження/компіляції
    appIsrStatus: false, // Вимикає індикатор статичних/динамічних роутів (особливо актуально для Next.js 15)
  },
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
}

export default nextConfig
