/** @type {import('next').NextConfig} */
// The connected Supabase integration provides these browser-safe values under
// its standard names. Map them to the names used by this application at build
// time so the public client is configured without exposing any server secret.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

const nextConfig = {
  // Keep Vercel's output in the standard folder its Next.js builder expects.
  // Use an isolated folder locally to avoid OneDrive locking build files.
  distDir: process.env.VERCEL ? '.next' : '.next-build',
  // Limit build workers for predictable local/Vercel memory use.
  experimental: { cpus: 1 },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl || '',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey || '',
  },
};
export default nextConfig;
