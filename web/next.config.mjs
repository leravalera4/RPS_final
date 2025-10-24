/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Отключить иконку отладки Next.js
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
}

export default nextConfig
