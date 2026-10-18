import { ArrowRight } from 'lucide-react';
import { Brand } from '@/components/Brand';

export function ClosingSection() {
  return <>
    <section className="final-cta">
      <div className="eyebrow light"><span /> BUILT FOR RESTAURANTS</div>
      <h2>Every table.<br /><em>One live service.</em></h2>
      <p>Give guests an easy menu and give your team one shared view of the orders coming from every table.</p>
      <div className="hero-buttons"><a className="button button-gold" href="/register">Get your restaurant online <ArrowRight size={16} /></a></div>
      <div className="cta-flower" aria-hidden="true" />
    </section>
    <footer><Brand /><span>© 2026 Tabletouch.</span><a href="/platform/login">Platform administrator</a></footer>
  </>;
}
