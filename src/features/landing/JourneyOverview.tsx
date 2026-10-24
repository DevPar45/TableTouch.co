'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ChefHat, LayoutDashboard, Nfc, QrCode, ReceiptText } from 'lucide-react';

const stages = [
  { number: '01', title: 'The guest journey', copy: 'From a table scan to an accurate final bill.', icon: QrCode, href: '/how-it-works', action: 'See the flow' },
  { number: '02', title: 'Your restaurant tools', copy: 'Menu, kitchen, orders and service in one workspace.', icon: LayoutDashboard, href: '/features', action: 'Explore tools' },
  { number: '03', title: 'Cards made for tables', copy: 'A premium NFC and QR destination for every guest.', icon: Nfc, href: '/table-cards', action: 'View table cards' },
  { number: '04', title: 'A plan that fits', copy: 'Start free or choose a managed TableTouch service.', icon: ReceiptText, href: '/plans', action: 'View plans' },
];

export function JourneyOverview() {
  return <section className="journey-overview">
    <div className="journey-intro">
      <div><div className="eyebrow"><span /> A BETTER SERVICE, IN FOUR PARTS</div><h2>Designed around<br /><em>the way you work.</em></h2></div>
      <p>Each stage has its own page, so restaurant owners can understand TableTouch without scrolling through a crowded sales page.</p>
    </div>
    <div className="journey-grid">
      {stages.map((stage, index) => {
        const Icon = stage.icon;
        return <motion.article className="journey-card" key={stage.number} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }} transition={{ delay: index * .08 }}>
          <span className="journey-number">{stage.number}</span><Icon aria-hidden="true" /><h3>{stage.title}</h3><p>{stage.copy}</p><Link href={stage.href}>{stage.action} <ArrowRight size={15} /></Link>
        </motion.article>;
      })}
    </div>
    <div className="journey-note"><ChefHat size={18} /><span><b>Built for real service.</b> Your team sees what matters next, while guests get a simple way to order.</span></div>
  </section>;
}
