import Link from 'next/link';
import { ShieldCheck, Store } from 'lucide-react';

export function PricingSection(){
 return <section id="launch-status" className="pricing launch-status-section">
  <div className="pricing-head"><div className="eyebrow"><span/> RESTAURANT ACCESS</div><h2>One live workspace.<br/><em>Every table connected.</em></h2><p>Restaurant applications are checked before a menu can go online. Each approved restaurant gets a private dashboard, table QR links, shared orders and kitchen updates.</p></div>
  <div className="launch-status-card">
   <div className="launch-status-icon"><ShieldCheck size={20}/></div>
   <div>
    <b>Your restaurant, ready for service</b>
    <p>Create an owner account to submit your restaurant details. Once verified, manage your menu, table orders and kitchen updates from one workspace.</p>
    <small>Every application is reviewed before the restaurant can accept orders.</small>
    <div className="status-actions">
     <Link className="button button-dark" href="/register"><Store size={14}/> Register a restaurant</Link>
     <Link href="/restaurant/login">Restaurant owner sign in</Link>
    </div>
   </div>
  </div>
 </section>;
}
