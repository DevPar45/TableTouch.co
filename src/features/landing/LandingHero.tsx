import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, Nfc } from 'lucide-react';

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
          <a className="button button-outline" href="/how-it-works">See the service flow</a>
        </div>
        <div className="hero-note"><span className="avatar-stack" aria-hidden="true"><i/><i/><i/></span><span>Menu, orders, kitchen and billing<br />in one restaurant workspace</span></div>
      </div>
      <motion.div className="hero-product-showcase" animate={{ y: [0, -10, 0], rotateZ: [-2, 0, -2] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
        <div className="hero-product-image" role="img" aria-label="A TableTouch NFC and QR table card on a premium dining table" />
        <div className="hero-glass-panel"><Nfc size={18} /><span><b>NFC + QR, one touch away</b><small>Every table opens the right menu.</small></span></div>
      </motion.div>
      <div className="hero-bottom"><span>01 — THE NEW WAY TO DINE</span><a href="/how-it-works">EXPLORE THE FLOW <ArrowDown size={13} /></a></div>
    </section>
  );
}
