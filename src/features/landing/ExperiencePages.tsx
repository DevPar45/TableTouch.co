'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BellRing, Check, ChefHat, LayoutDashboard, ListChecks, Nfc, QrCode, ReceiptText, ShieldCheck, Sparkles } from 'lucide-react';
import { LandingNav } from './LandingNav';
import { ClosingSection } from './ClosingSection';
import { servicePlans } from '@/lib/service-plans';

const workflow = [
  { number: '01', title: 'Open the table menu', text: 'Guests tap the TableTouch card or scan its QR code. Every table opens its own protected restaurant destination.', icon: Nfc },
  { number: '02', title: 'Start a named table', text: 'A guest enters their name once. Later orders remain under the same table and name, so the bill stays accurate.', icon: QrCode },
  { number: '03', title: 'Run the live service', text: 'Orders reach the restaurant workspace. The floor and kitchen update each order as it is accepted, prepared, ready and served.', icon: ChefHat },
  { number: '04', title: 'Review the final bill', text: 'The team reviews the complete table, adds the restaurant’s tax and service charge settings, then prepares the final receipt.', icon: ReceiptText },
];

const capabilities = [
  { title: 'Live menu control', copy: 'Update dishes, prices, availability, food photos and top-order tags without reprinting menus.', icon: ListChecks },
  { title: 'Live table orders', copy: 'See every open table, active guest and incoming order in the restaurant workspace.', icon: LayoutDashboard },
  { title: 'Kitchen workflow', copy: 'Move orders through accepted, preparing, ready and served with a clear kitchen view.', icon: ChefHat },
  { title: 'Guest service requests', copy: 'Guests can ask for water, assistance, cutlery or their bill from the table.', icon: BellRing },
  { title: 'Flexible billing', copy: 'Set tax and service charges for each restaurant, then review final bills before they are issued.', icon: ReceiptText },
  { title: 'Restaurant control', copy: 'Manage menu access, table QR destinations and the restaurant’s live service status.', icon: ShieldCheck },
];

function PageIntro({ eyebrow, title, emphasis, copy, index }: { eyebrow: string; title: string; emphasis: string; copy: string; index: string }) {
  return <section className="experience-hero">
    <div className="experience-orbit experience-orbit-one" /><div className="experience-orbit experience-orbit-two" />
    <div className="experience-index">{index}</div>
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
      <div className="eyebrow light"><span /> {eyebrow}</div><h1>{title}<br /><em>{emphasis}</em></h1><p>{copy}</p>
    </motion.div>
  </section>;
}

function PageFrame({ children }: { children: React.ReactNode }) {
  return <main className="landing experience-page"><LandingNav />{children}<ClosingSection /></main>;
}

export function WorkflowPage() {
  return <PageFrame><PageIntro index="01" eyebrow="THE TABLETOUCH SERVICE FLOW" title="From table tap to" emphasis="a considered final bill." copy="One simple journey for the guest. One live source of truth for the restaurant." />
    <section className="workflow-section"><div className="workflow-intro"><div className="eyebrow"><span /> THE COMPLETE FLOW</div><h2>Clear at every<br /><em>service moment.</em></h2><p>No switching between paper chits, menu files and disconnected billing tools.</p></div><div className="workflow-list">{workflow.map((item, index) => { const Icon = item.icon; return <motion.article className="workflow-item" key={item.number} initial={{ opacity: 0, x: 22 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: index * .1 }}><span>{item.number}</span><div className="workflow-icon"><Icon /></div><div><h3>{item.title}</h3><p>{item.text}</p></div></motion.article>; })}</div></section>
    <section className="next-step"><div><span>UP NEXT</span><h2>Give your team<br /><em>the right tools.</em></h2></div><Link className="button button-dark" href="/features">Explore restaurant tools <ArrowRight size={16} /></Link></section>
  </PageFrame>;
}

export function FeaturesPage() {
  return <PageFrame><PageIntro index="02" eyebrow="ONE RESTAURANT WORKSPACE" title="Every service detail," emphasis="in its right place." copy="A focused workspace for owners, floor staff and the kitchen. Guests only see the menu and table experience." />
    <section className="capability-section"><div className="capability-head"><div className="eyebrow"><span /> DESIGNED FOR BUSY FLOORS</div><h2>Less chasing.<br /><em>More hospitality.</em></h2></div><div className="capability-grid">{capabilities.map((item, index) => { const Icon = item.icon; return <motion.article key={item.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}><Icon /><h3>{item.title}</h3><p>{item.copy}</p></motion.article>; })}</div></section>
    <section className="next-step"><div><span>UP NEXT</span><h2>Make every table<br /><em>an entry point.</em></h2></div><Link className="button button-dark" href="/table-cards">Explore QR and NFC cards <ArrowRight size={16} /></Link></section>
  </PageFrame>;
}

export function CardsPage() {
  return <PageFrame><PageIntro index="03" eyebrow="TABLETOUCH TABLE CARDS" title="Built for the table." emphasis="Ready for every phone." copy="The physical card is the start of a refined digital experience, made to fit the restaurant’s own identity." />
    <section className="cards-detail"><motion.div className="card-stage" initial={{ opacity: 0, rotate: -8 }} whileInView={{ opacity: 1, rotate: 0 }} viewport={{ once: true }} transition={{ duration: .65 }}><div className="premium-card"><div className="premium-card-head"><span>YOUR RESTAURANT</span><Nfc size={18} /></div><div className="premium-card-body"><div className="premium-card-mark" /><p>GOOD FOOD.</p><em>GREAT TIMES.</em><i /><div><span><Nfc size={25} /> TAP TO MENU</span><QrCode size={48} /></div><small>TABLETOUCH · NFC + QR</small></div></div></motion.div><div className="cards-copy"><div className="eyebrow"><span /> THE PHYSICAL START OF SERVICE</div><h2>Tap, scan,<br /><em>and let the table work.</em></h2><p>Every card links to one stable table destination. When a guest scans Table 2, their order reaches the restaurant as Table 2, every time.</p><ul><li><Check size={16} />NFC and camera-friendly QR access</li><li><Check size={16} />Unique table routes and recoverable QR codes</li><li><Check size={16} />Restaurant branded card design</li><li><Check size={16} />Manage active and paused tables in the workspace</li></ul></div></section>
    <section className="next-step"><div><span>UP NEXT</span><h2>Choose the service<br /><em>that suits your floor.</em></h2></div><Link className="button button-dark" href="/plans">See TableTouch plans <ArrowRight size={16} /></Link></section>
  </PageFrame>;
}

export function PlansPage() {
  return <PageFrame><PageIntro index="04" eyebrow="TABLETOUCH SERVICES" title="Choose your starting point." emphasis="Grow when you are ready." copy="Start with a free test or choose a service built for the way your restaurant operates." />
    <section className="plans-page"><div className="plans-page-grid">{servicePlans.map((plan, index) => <motion.article className={`plan-page-card${plan.popular ? ' plan-page-popular' : ''}`} key={plan.code} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * .06 }}>{plan.popular && <span>RECOMMENDED</span>}<small>{plan.cadence.toUpperCase()}</small><h2>{plan.name}</h2><p>{plan.description}</p><strong>{plan.price}</strong>{plan.price !== 'Free' && <i>{plan.cadence}</i>}<ul>{plan.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul><Link href={`/register?plan=${plan.code}`} className={`button ${plan.popular ? 'button-dark' : 'button-outline-dark'}`}>{plan.code === 'free_pilot' ? 'Start free test' : 'Choose this service'} <ArrowRight size={15} /></Link></motion.article>)}</div><div className="plans-assurance"><Sparkles size={18} /><p><b>Activation is personal.</b> A TableTouch specialist reviews each application before a paid service is activated.</p></div></section>
  </PageFrame>;
}
