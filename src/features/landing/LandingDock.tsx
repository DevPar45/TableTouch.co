import Link from 'next/link';
import { CreditCard, House, Route, Store } from 'lucide-react';

const items = [
  { href: '/', label: 'Home', icon: House, active: true },
  { href: '/how-it-works', label: 'Flow', icon: Route },
  { href: '/table-cards', label: 'Cards', icon: CreditCard },
  { href: '/register', label: 'Start', icon: Store },
];

/** Compact, phone-only navigation for the public TableTouch story. */
export function LandingDock() {
  return <nav className="landing-dock" aria-label="Quick navigation">
    {items.map(({ href, label, icon: Icon, active }) => <Link href={href} className={active ? 'active' : ''} key={href}>
      <Icon aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
