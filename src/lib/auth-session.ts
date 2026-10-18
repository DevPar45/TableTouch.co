import type { Session, SupabaseClient } from '@supabase/supabase-js';

/** Ensure the browser has a persisted Supabase session before making protected calls. */
export async function requireAuthSession(client: SupabaseClient, initialSession?: Session | null) {
  // signInWithPassword returns the new session directly. Prefer it so protected
  // work can begin even before the browser has finished persisting its cookie.
  if (initialSession) return initialSession;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    throw new Error('Your sign-in session is missing or expired. Sign in again, then retry.');
  }
  return data.session;
}
