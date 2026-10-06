import Link from 'next/link';
import { LockKeyhole, ShieldCheck, Store } from 'lucide-react';

export function PricingSection(){
 const connected=Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 return <section id="launch-status" className="pricing launch-status-section">
  <div className="pricing-head"><div className="eyebrow"><span/> RESTAURANT ACCESS</div><h2>One live workspace.<br/><em>Every table connected.</em></h2><p>Restaurant applications are checked before a menu can go online. Each approved restaurant gets a private dashboard, table QR links, shared orders and kitchen updates.</p></div>
  <div className="launch-status-card"><div className="launch-status-icon">{connected?<ShieldCheck size={20}/>:<LockKeyhole size={20}/>}</div><div><b>{connected?<><ShieldCheck size={15}/> Supabase connection configured</>:<>Supabase setup required to accept applications</>}</b><p>{connected?'Applications, owner sign-in, private proof storage, restaurant-specific menus and live table orders use your connected Supabase project.':'Connect a Supabase project and apply the six migrations in order before accepting restaurant accounts or deploying a live ordering pilot.'}</p><small>New restaurants remain offline until a platform administrator verifies their business proof and approves their application.</small><div className="status-actions"><Link className="button button-dark" href="/register"><Store size={14}/> Register a restaurant</Link><Link href="/restaurant/login">Restaurant owner sign in</Link><Link href="/platform/login">Platform admin sign in</Link></div></div></div>
 </section>;
}
