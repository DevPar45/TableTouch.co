'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

export default function ResetPassword() {
  const supabase = getSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setError('Account recovery is unavailable right now. Please try again later.');
      setReady(true);
      return;
    }

    const callbackError = new URLSearchParams(window.location.search).get('auth_error');
    if (callbackError) {
      setError('This password link is invalid or expired. Request a new one from your sign-in page.');
      setReady(true);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError || !data.session) {
        setError('This password link is invalid or expired. Request a new one from your sign-in page.');
      }
      setReady(true);
    }).catch(() => {
      if (!active) return;
      setError('Could not verify this password link. Request a new one from your sign-in page.');
      setReady(true);
    });

    return () => { active = false; };
  }, [supabase]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!supabase) return;
    if (password.length < 10) {
      setError('Use at least 10 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setError('Your recovery session has expired. Request a new password link.');
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) setError(updateError.message);
      else setSaved(true);
    } catch {
      setError('Could not update your password. Request a new password link and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="tracking-page onboarding-page">
      <section className="tracking-card auth-card">
        <div className="onboarding-icon"><LockKeyhole size={21} /></div>
        <span className="eyebrow"><span /> ACCOUNT RECOVERY</span>
        <h1>Choose a new password</h1>
        <p>Use at least 10 characters for your Tabletouch account.</p>
        {!ready ? <div>Checking recovery link…</div> : saved ? (
          <div className="form-success">Password updated. <Link href="/restaurant/login">Return to sign in</Link></div>
        ) : error ? (
          <div className="form-error" role="alert">
            {error} <Link href="/restaurant/login">Return to sign in</Link>
          </div>
        ) : (
          <form className="onboarding-form" onSubmit={submit}>
            <label>New password<input autoFocus required type="password" minLength={10} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
            <label>Confirm password<input required type="password" minLength={10} autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label>
            <button className="button button-dark full-button" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : 'Update password'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
