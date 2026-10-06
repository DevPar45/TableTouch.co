/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel and local builds use the isolated output folder for this workspace.
  distDir: '.next-build',
  // Limit build workers for predictable local/Vercel memory use.
  experimental: { cpus: 1 },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
};
export default nextConfig;
