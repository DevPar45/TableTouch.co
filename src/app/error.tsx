'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('TableTouch page error', error); }, [error]);
  return <main className="recovery-page"><section><div className="recovery-icon"><AlertTriangle size={25} /></div><p className="eyebrow"><span /> PAGE NEEDS A REFRESH</p><h1>We couldn’t open<br /><em>this page safely.</em></h1><p>The page did not complete loading. Refresh it to try again, or return to the TableTouch home page.</p><div><button className="button button-dark" onClick={reset}><RefreshCw size={16} /> Refresh page</button><Link className="button button-outline-dark" href="/">Return home</Link></div></section></main>;
}
