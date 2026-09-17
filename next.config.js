/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: __dirname,
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.prisma/client/**/*', './node_modules/@prisma/client/**/*', './node_modules/@img/sharp-linux-x64/**/*', './node_modules/@img/sharp-libvips-linux-x64/**/*'],
  },
  images: {
    // Azure Run From Package mounts .next read-only. Keep optimization active,
    // but prevent the optimizer from writing its runtime disk cache there.
    maximumDiskCacheSize: 0,
  },
  async rewrites() {
    return [
      {
        source: '/homepage/stage-previews/before.mp4',
        destination: '/homepage/service-video-stages/before-service.mp4',
      },
      {
        source: '/homepage/stage-previews/during.mp4',
        destination: '/homepage/service-video-stages/during-service.mp4',
      },
      {
        source: '/homepage/stage-previews/completed.mp4',
        destination: '/homepage/service-video-stages/completed-service.mp4',
      },
    ];
  },
  // Smaller, more stable client chunks for icon-heavy pages (vendor dashboard/profile/jobs).
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
}

module.exports = nextConfig
