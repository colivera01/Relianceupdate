/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Smaller, more stable client chunks for icon-heavy pages (vendor dashboard/profile/jobs).
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
