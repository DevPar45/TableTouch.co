import Link from 'next/link';

export default function MenuManagementUnavailable() {
  return <main className="tracking-page"><section className="tracking-card"><h1>Restaurant management is closed.</h1><p>Menu editing and QR management require an authenticated restaurant workspace backed by server-side data storage.</p><Link className="button button-dark" href="/">Return to Tabletouch</Link></section></main>;
}
