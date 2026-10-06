import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Nfc } from 'lucide-react';

export function LandingHero() {
  return (
    <section className="hero">
      <div className="hero-photo" />
      <div className="hero-shade" />
      <div className="hero-content">
        <div className="eyebrow light"><span /> A BETTER WAY TO MENU</div>
        <h1>TURN EVERY TABLE<br />INTO A <em>DIGITAL MENU.</em></h1>
        <p>Premium NFC + QR menus with restaurant workspaces, live table orders and kitchen status in one place.</p>
        <div className="hero-buttons">
          <a className="button button-gold" href="/register">Register your restaurant <ArrowRight size={16} /></a>
          <a className="button button-outline" href="#how">How it works</a>
        </div>
        <div className="hero-note"><span className="avatar-stack"><i>✦</i><i>✳</i><i>✦</i></span><span>Designed for the moments<br />that happen around a table</span></div>
      </div>
      <motion.div className="hero-card" animate={{ y: [0, -10, 0], rotate: [2, 0, 2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="table-card">
          <div className="card-top"><span>✦&nbsp; YOUR BRAND &nbsp;✦</span><small>NFC + QR</small></div>
          <div className="card-border">
            <div className="card-sun">✳</div>
            <div className="card-title">GOOD FOOD.<br /><em>GREAT TIMES.</em></div>
            <div className="card-rule" />
            <div className="tap-row"><div className="tap-icon"><Nfc size={28} /></div><div><small>TAP TO MENU</small><strong>Tap your phone here</strong></div><div className="mini-qr">▦</div></div>
            <div className="scan-row"><div><small>SCAN TO MENU</small><strong>Point your camera here</strong></div><div className="qr-pattern">▦</div></div>
            <div className="card-bottom">TAP &nbsp;•&nbsp; SCAN &nbsp;•&nbsp; ENJOY</div>
          </div>
        </div>
        <motion.div className="phone-float" animate={{ y: [8, -4, 8], x: [0, 3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
          <div className="phone-screen">
            <div className="phone-island" />
            <div className="phone-image" />
            <div className="phone-logo">t.</div>
            <b>Restaurant menu</b>
            <small>LIVE TABLE SERVICE</small>
            <div className="phone-line" />
            <span>ORDERS ROUTE TO YOUR KITCHEN</span>
          </div>
        </motion.div>
        <div className="tap-signal"><Nfc size={17} /><span>Tap to explore</span></div>
      </motion.div>
      <div className="hero-bottom"><span>01 — THE NEW WAY TO DINE</span><a href="#how">SCROLL TO EXPLORE <ArrowDown size={13} /></a></div>
    </section>
  );
}
