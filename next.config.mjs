/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Vercel's output in the standard folder its Next.js builder expects.
  // Use an isolated folder locally to avoid OneDrive locking build files.
  distDir: process.env.VERCEL ? '.next' : '.next-build',
  // Limit build workers for predictable local/Vercel memory use.
  experimental: { cpus: 1 },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
};
export default nextConfig;
