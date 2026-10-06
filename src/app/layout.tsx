import type { Metadata } from 'next';
import './globals.css';
import './operations.css';
import './billing.css';
import './saas.css';
import './mobile.css';
import { StoreProvider } from '@/store';
export const metadata: Metadata = { title: 'Tabletouch — Menus made memorable', description: 'Premium NFC + QR digital menus for restaurants.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><StoreProvider>{children}</StoreProvider></body></html>; }
