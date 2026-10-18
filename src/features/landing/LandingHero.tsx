import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Nfc, QrCode } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="hero">
      <div className="hero-photo" />
      <div className="hero-shade" />
      <div className="hero-content">
        <div className="eyebrow light"><span /> QR · NFC · LIVE SERVICE</div>
        <h1>FROM THE FIRST<br />SCAN TO THE <em>FINAL BILL.</em></h1>
        <p>Give every guest a beautiful table menu. Give your floor and kitchen one clear, live service flow.</p>
        <div className="hero-buttons">
          <a className="button button-gold" href="/register">Start your restaurant setup <ArrowRight size={16} /></a>
          <a className="button button-outline" href="#how">See the service flow</a>
        </div>
        <div className="hero-note"><span className="avatar-stack" aria-hidden="true"><i/><i/><i/></span><span>Menu, orders, kitchen and billing<br />in one restaurant workspace</span></div>
      </div>
      <motion.div className="hero-card" animate={{ y: [0, -10, 0], rotate: [2, 0, 2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="table-card">
          <div className="card-top"><span>YOUR BRAND</span><small>NFC + QR</small></div>
          <div className="card-border">
            <div className="card-sun" aria-hidden="true" />
            <div className="card-title">GOOD FOOD.<br /><em>GREAT TIMES.</em></div>
            <div className="card-rule" />
            <div className="tap-row"><div className="tap-icon"><Nfc size={28} /></div><div><small>TAP TO MENU</small><strong>Tap your phone here</strong></div><div className="mini-qr"><QrCode size={24}/></div></div>
            <div className="scan-row"><div><small>SCAN TO MENU</small><strong>Point your camera here</strong></div><div className="qr-pattern"><QrCode size={42}/></div></div>
            <div className="card-bottom">TAP / SCAN / ENJOY</div>
          </div>
        </div>
        <motion.div className="phone-float" animate={{ y: [8, -4, 8], x: [0, 3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="phone-screen">
            <div className="phone-island" />
            <div className="phone-image" />
            <div className="phone-logo">t.</div>
            <b>Restaurant menu</b>
            <small>LIVE TABLE ORDERING</small>
            <div className="phone-line" />
            <span>ORDER · PREPARE · SERVE</span>
          </div>
        </motion.div>
        <div className="tap-signal"><Nfc size={17} /><span>Tap to explore</span></div>
      </motion.div>
      <div className="hero-bottom"><span>01 — THE NEW WAY TO DINE</span><a href="#how">SCROLL TO EXPLORE <ArrowDown size={13} /></a></div>
    </section>
  );
}
