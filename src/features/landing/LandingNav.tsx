'use client';

import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Brand } from '@/components/Brand';

export function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="nav">
      <Brand />
      <div id="site-navigation" className={'nav-links ' + (open ? 'nav-open' : '')}>
        <a href="#how" onClick={() => setOpen(false)}>How it works</a>
        <a href="#product" onClick={() => setOpen(false)}>The card</a>
        <a href="/restaurant/login" onClick={() => setOpen(false)}>Restaurant sign in</a>
      </div>
      <div className="nav-actions">
        <a className="button button-dark nav-cta" href="/register" onClick={() => setOpen(false)}>Get your restaurant online</a>
        <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="site-navigation">{open ? <X /> : <Menu />}</button>
      </div>
    </nav>
  );
}
