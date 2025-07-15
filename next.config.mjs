/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ['image.pollinations.ai', 'blob.v0.dev'],
    unoptimized: true
  }
};

export default nextConfig;
