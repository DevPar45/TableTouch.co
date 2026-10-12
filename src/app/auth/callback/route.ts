import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

function safeNextPath(value: string | null) {
  if (value === '/register' || value === '/auth/reset-password') return value;
  return '/';
}

function failureRedirect(request: NextRequest, path: string) {
  const destination = new URL(path, request.url);
  destination.searchParams.set('auth_error', 'confirmation');
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = safeNextPath(request.nextUrl.searchParams.get('next'));

  if (!url || !key || !code) return failureRedirect(request, nextPath);

  const response = NextResponse.redirect(new URL(nextPath, request.url));
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failureRedirect(request, nextPath);
  return response;
}
