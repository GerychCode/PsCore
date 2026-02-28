import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  implementation: 'sass-embedded',
  reactStrictMode: false,
  images: {
    //Rewrite me
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
