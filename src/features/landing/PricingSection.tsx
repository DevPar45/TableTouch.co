import Link from 'next/link';
import { Check, ShieldCheck, Store } from 'lucide-react';
import { servicePlans } from '@/lib/service-plans';

export function PricingSection(){
 return <section id="launch-status" className="pricing launch-status-section">
  <div className="pricing-head"><div className="eyebrow"><span/> TABLETOUCH SERVICES</div><h2>Choose the service<br/><em>your floor needs.</em></h2><p>Start with a free test, buy a lifetime card kit, or run every table with a managed digital service. The digital-table plan is priced per table; Complete is priced per restaurant.</p></div>
  <div className="pricing-grid service-pricing-grid">{servicePlans.map(plan=><article className={`price-card${plan.popular?' popular':''}`} key={plan.code}>{plan.popular&&<span className="popular-tag">COMPLETE SERVICE</span>}<span className="price-kicker">{plan.cadence.toUpperCase()}</span><h3>{plan.name}</h3><p>{plan.description}</p><div className="price-amount">{plan.price}<small>{plan.price==='Free'?'':' / '+plan.cadence}</small></div><ul>{plan.features.map(feature=><li key={feature}><Check size={14}/>{feature}</li>)}</ul><Link className={`button ${plan.popular?'button-dark':'button-outline-dark'}`} href={`/register?plan=${plan.code}`}>{plan.code==='free_pilot'?'Start free test':'Choose this service'}</Link></article>)}</div>
  <div className="launch-status-card"><div className="launch-status-icon"><ShieldCheck size={20}/></div><div><b>Your restaurant, ready for service</b><p>Selecting a service plan reserves it with your restaurant application. A TableTouch specialist confirms your requirements before any paid plan is activated.</p><small>Every application is reviewed before the restaurant can accept orders.</small><div className="status-actions"><Link className="button button-dark" href="/register"><Store size={14}/> Register a restaurant</Link><Link href="/restaurant/login">Restaurant owner sign in</Link></div></div></div>
 </section>;
}
