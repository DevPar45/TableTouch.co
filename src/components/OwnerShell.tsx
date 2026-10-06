'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, CookingPot, LayoutDashboard, LogOut, QrCode, ReceiptText, Settings, ShoppingCart, Store, Utensils } from 'lucide-react';
import { useStore } from '@/store';

export function OwnerShell({children,active}:{children:React.ReactNode;active:string}){
 const {restaurants,sessionRestaurantId,setSession,updateRestaurant,hydrated,configured,signOut}=useStore();
 const router=useRouter();
 const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 const logout=async()=>{await signOut();setSession(null);router.push('/restaurant/login')};
 if(!hydrated)return <div className="portal-loading">Opening your restaurant workspace…</div>;
 if(!restaurant)return <div className="portal-gate"><div className="brand-mark">t.</div><h1>Restaurant workspace</h1><p>{configured?'Sign in to manage your restaurant’s orders, tables and live menu.':'Connect Supabase before opening a restaurant workspace.'}</p>{configured&&<Link className="button button-dark" href="/restaurant/login">Restaurant sign in</Link>}</div>;
 if(restaurant.approvalStatus!=='approved')return <div className="portal-gate"><div className="brand-mark">t.</div><h1>{restaurant.approvalStatus==='rejected'?'Application needs attention':'Application under review'}</h1><p>{restaurant.approvalStatus==='rejected'?'Your application was not approved. Contact Tabletouch support to correct the business details and proof documents.':'Your application and business proof are saved. Your restaurant stays offline while Tabletouch verifies the submitted documents.'}</p><button className="button button-outline-dark" onClick={logout}>Sign out</button></div>;
 const links=[['Dashboard','/restaurant/dashboard',<LayoutDashboard/>],['POS','/restaurant/pos',<ShoppingCart/>],['Orders','/restaurant/orders',<ClipboardList/>],['Kitchen','/restaurant/kitchen',<CookingPot/>],['Bills','/restaurant/bills',<ReceiptText/>],['Tables','/restaurant/tables',<Store/>],['Menu','/restaurant/menu',<Utensils/>],['Billing settings','/restaurant/billing-settings',<Settings/>],['QR & NFC','/restaurant/tables',<QrCode/>]] as const;
 const status=restaurant.registrationStatus||'offline';
 const toggle=()=>updateRestaurant(restaurant.id,{registrationStatus:status==='online'?'offline':'online'});
 const memberRestaurants=restaurants.filter(item=>item.ownerEmail);
 return <main className="owner-portal"><aside className="owner-sidebar"><Link href="/" className="brand"><span className="brand-mark">t.</span><span>tabletouch<span className="brand-dot">.</span></span></Link><div className="owner-switch"><div className="restaurant-emblem">{restaurant.logo}</div><span><b>{restaurant.name}</b><small>Restaurant workspace</small></span>{memberRestaurants.length>1&&<select aria-label="Switch restaurant" value={restaurant.id} onChange={event=>setSession(event.target.value)}>{memberRestaurants.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div><small className="owner-label">YOUR RESTAURANT</small><nav>{links.map(([label,href,icon])=><Link key={label} href={href} className={active===label?'active':''}>{icon}<span>{label}</span></Link>)}</nav><div className="owner-bottom"><div className="owner-live"><i/>{status==='paused'?'SERVICE PAUSED':status==='offline'?'OFFLINE':'MENU LIVE'}</div><button onClick={logout}><LogOut size={15}/> Sign out</button></div></aside><section className="owner-main"><header className="owner-topbar"><div><span className="owner-crumb">RESTAURANT WORKSPACE</span><b>{restaurant.name}</b></div><button className={`owner-live owner-live-action ${status==='online'?'':'is-offline'}`} onClick={()=>void toggle()}><i/>{status==='online'?'LIVE · SET OFFLINE':'OFFLINE · SET LIVE'}</button></header><div className="owner-content">{children}</div></section></main>;
}
