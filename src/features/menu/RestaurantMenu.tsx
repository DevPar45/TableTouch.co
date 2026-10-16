'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BellRing, Check, ChevronDown, Clock3, Search, ShoppingBag } from 'lucide-react';
import { DiningSession, MenuItem } from '@/data';
import { useStore } from '@/store';
import { CartDrawer } from '@/components/menu/CartDrawer';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { RestaurantMark } from '@/components/RestaurantMark';

export function RestaurantMenu({restaurantSlug,tableNumber}:{restaurantSlug?:string;tableNumber?:string}){
 const params=useParams<{slug:string[]}>();
 const searchParams=useSearchParams();
 const parts=Array.isArray(params.slug)?params.slug:[];
 const id=restaurantSlug||parts[0]||'';
 const table=tableNumber||(parts[1]==='table'?parts[2]||null:null);
 const tableToken=searchParams.get('table_token')||'';
 const {restaurants,orders,hydrated,startDiningSession,resumeDiningSession,placeGuestOrder,requestGuestBill,requestTableService}=useStore();
 const restaurant=restaurants.find(item=>item.slug===id||item.id===id);
 const [categoryId,setCategoryId]=useState('recommended');
 const [query,setQuery]=useState('');
 const [cart,setCart]=useState<Record<string,number>>({});
 const [drawerOpen,setDrawerOpen]=useState(false);
 const [submitted,setSubmitted]=useState(false);
 const [submittedToken,setSubmittedToken]=useState<string|undefined>();
 const [diningSession,setDiningSession]=useState<DiningSession|null>(null);
 const [guestName,setGuestName]=useState('');
 const [guestError,setGuestError]=useState('');
 const [orderPending,setOrderPending]=useState(false);const orderPendingRef=useRef(false);
 const [servicePending,setServicePending]=useState(false);const [serviceNotice,setServiceNotice]=useState('');

 useEffect(()=>{
  if(!restaurant||categoryId!=='recommended')return;
  const withItems=restaurant.categories.find(category=>restaurant.menuItems.some(item=>item.category===category.id&&item.available));
  setCategoryId(withItems?.id||restaurant.categories[0]?.id||'recommended');
 },[restaurant?.id,restaurant?.categories,restaurant?.menuItems]);

 useEffect(()=>{
  if(!restaurant||!table||!hydrated)return;
  setDiningSession(null);
  let cancelled=false;
  void resumeDiningSession(restaurant.slug||id,table).then(session=>{if(!cancelled&&session){setDiningSession(session);setGuestName(session.guestName);}});
  return()=>{cancelled=true;};
 },[restaurant?.id,table,hydrated,resumeDiningSession,id]);

 useEffect(()=>{
  if(!restaurant||!table||!diningSession)return;
  const update=()=>void resumeDiningSession(restaurant.slug||id,table).then(session=>{if(session)setDiningSession(session)});
  const timer=window.setInterval(update,8000);return()=>window.clearInterval(timer);
 },[restaurant?.id,table,diningSession?.id,diningSession?.status,resumeDiningSession,id]);

 const availableItems=useMemo(()=>restaurant?.menuItems.filter(item=>item.available)||[],[restaurant]);
 const shownItems=useMemo(()=>availableItems.filter(item=>{
  const categoryMatch=query.trim().length>0||(categoryId==='recommended'?item.bestseller||Boolean(item.tags?.length):item.category===categoryId);
  const searchable=[item.name,item.description,...(item.tags||[]),...(item.ingredients||[]),...(item.allergens||[]),...(item.searchKeywords||[]),item.spiceLevel||''].join(' ').toLowerCase();
  const searchMatch=!query||searchable.includes(query.trim().toLowerCase());
  return categoryMatch&&searchMatch;
 }),[availableItems,categoryId,query]);
 const topOrderedIds=useMemo(()=>{
  if(!restaurant)return [] as string[];
  const counts=new Map<string,number>();
  orders.filter(order=>order.restaurantId===restaurant.id&&order.status!=='Cancelled').forEach(order=>order.items.forEach(line=>counts.set(line.itemId,(counts.get(line.itemId)||0)+line.quantity)));
  return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([itemId])=>itemId);
 },[orders,restaurant]);
 const quantity=Object.values(cart).reduce((sum,value)=>sum+value,0);
 const subtotal=availableItems.reduce((sum,item)=>sum+item.price*(cart[item.id]||0),0);
 const sessionOrders=diningSession?.orders||orders.filter(order=>order.diningSessionId===diningSession?.id&&order.status!=='Cancelled');
 const updateQuantity=(item:MenuItem,delta:number)=>{
  if(!diningSession||diningSession.status!=='open')return;
  if(restaurant?.slug&&table)sessionStorage.removeItem(`tabletouch:session:${restaurant.slug}:${String(table).padStart(2,'0')}:order-attempt`);
  setCart(current=>({...current,[item.id]:Math.max(0,(current[item.id]||0)+delta)}));
 };
 const createSession=async(event:FormEvent)=>{
  event.preventDefault();
  const name=guestName.trim();
  if(name.length<2){setGuestError('Enter the name you want on your bill.');return;}
  if(!restaurant||!table)return;
  try{const next=await startDiningSession(restaurant.slug||id,table,tableToken,name);setDiningSession(next);setGuestError('');}
  catch(issue){setGuestError(issue instanceof Error?issue.message:'Could not start this table session.');}
 };
 const placeOrder=async()=>{
  if(!restaurant||!diningSession||diningSession.status!=='open'||quantity===0||orderPendingRef.current)return;
  orderPendingRef.current=true;setOrderPending(true);
  setGuestError('');
  try{const order=await placeGuestOrder(diningSession,availableItems.filter(item=>cart[item.id]).map(item=>({itemId:item.id,quantity:cart[item.id]})));setDiningSession(current=>current?{...current,orders:[...(current.orders||[]),order]}:current);setCart({});setSubmitted(true);setSubmittedToken(order.trackingToken);}
  catch(issue){setGuestError(issue instanceof Error?issue.message:'Could not send the order. Please try again.');}
  finally{orderPendingRef.current=false;setOrderPending(false);}
 };
 const requestBill=async()=>{
  if(!diningSession||sessionOrders.length===0){setGuestError('Place at least one order before requesting your bill.');return;}
  try{setDiningSession(await requestGuestBill(diningSession));setGuestError('');}
  catch(issue){setGuestError(issue instanceof Error?issue.message:'Could not request the bill. Please ask a server.');}
 };
 const callStaff=async()=>{
  if(!diningSession||servicePending)return;
  try{setServicePending(true);setGuestError('');await requestTableService(diningSession,'assistance');setServiceNotice('The restaurant team has been notified.');}
  catch(issue){setGuestError(issue instanceof Error?issue.message:'Could not notify the restaurant. Please ask a server.');}
  finally{setServicePending(false);}
 };

 if(!hydrated)return <div className="portal-loading">Loading the restaurant menu…</div>;
 if(!restaurant)return <Unavailable title="We can’t find that restaurant menu." detail="Check the link or return to Tabletouch." showHome/>;
 if(table&&(!/^\d+$/.test(table)||!(restaurant.tableNumbers||[]).includes(String(table).padStart(2,'0'))))return <Unavailable title="We can’t find that table." detail="Check the table QR code or ask the restaurant team for help." showHome/>;
 if(restaurant.approvalStatus==='pending')return <Unavailable title="This restaurant is not live yet." detail="The business application is still under review."/>;
 if(restaurant.approvalStatus==='rejected')return <Unavailable title="This menu is currently unavailable." detail="Please contact the restaurant directly."/>;
 if(restaurant.registrationStatus==='offline'||restaurant.registrationStatus==='paused')return <Unavailable title={`${restaurant.name} is temporarily offline.`} detail="Please check back soon."/>;

 return <main className="menu-page" style={{'--brand':restaurant.primaryColor,'--accent':restaurant.secondaryColor} as React.CSSProperties}>
  <div className="menu-cover" style={{backgroundImage:restaurant.coverImage?`linear-gradient(90deg,rgba(10,9,8,.66),rgba(10,9,8,.08)),url(${restaurant.coverImage})`:undefined}}>
   <Link href="/" className="menu-back"><ArrowLeft size={16}/> Tabletouch</Link>
   <div className="menu-cover-copy"><RestaurantMark restaurant={restaurant}/><div><span className="cover-label">A TABLETOUCH EXPERIENCE</span><h1>{restaurant.name}</h1><p>{restaurant.description}</p></div></div>
  </div>
  <div className="menu-shell">
   <div className="menu-meta"><div><h2>Made with care.<br/><em>Served with love.</em></h2><p><span><Clock3 size={14}/>{restaurant.hours}</span><span>·</span><span>{restaurant.address}</span>{table&&<span className="table-label">TABLE {table.padStart(2,'0')}</span>}</p></div>
    <div className="menu-tools"><label className="menu-search-field"><Search size={16}/><input type="search" aria-label="Search menu" placeholder="Search dishes, ingredients or tags" value={query} onChange={event=>setQuery(event.target.value)}/></label><button className="round-tool cart-tool" onClick={()=>setDrawerOpen(true)} aria-label="Open cart"><ShoppingBag size={18}/>{quantity>0&&<b>{quantity}</b>}</button></div>
   </div>
   {table&&diningSession&&<div className={`dining-session-bar ${diningSession.status==='bill_requested'?'bill-requested':''}`}><div><span className="eyebrow"><span/> {diningSession.status==='open'?'YOUR TABLE SESSION':'BILL REQUEST SENT'}</span><b>{diningSession.guestName} · Table {diningSession.tableNumber}</b><small>{sessionOrders.length} order round{sessionOrders.length===1?'':'s'} · ₹{sessionOrders.reduce((sum,order)=>sum+order.subtotal,0).toLocaleString('en-IN')} before final charges</small>{serviceNotice&&<small className="service-notice"><Check size={12}/>{serviceNotice}</small>}</div><div className="dining-session-actions"><button className="service-call-button" disabled={servicePending} onClick={callStaff}><BellRing size={13}/>{servicePending?'Notifying…':'Call staff'}</button>{diningSession.status==='open'?<button className="button button-dark" onClick={requestBill}>Request final bill <ArrowRightIcon/></button>:<span className="bill-status-chip"><Check size={14}/> Restaurant will review your bill</span>}<button className="new-diner-link" onClick={()=>{if(restaurant.slug&&table)sessionStorage.removeItem(`tabletouch:session:${restaurant.slug}:${String(table).padStart(2,'0')}`);setDiningSession(null);setGuestName('');setGuestError('');setCart({});setServiceNotice('')}}>Start a separate guest bill</button></div></div>}
   {guestError&&<div className="session-error">{guestError}</div>}
   <div className="category-scroller">{restaurant.categories.map(category=><button key={category.id} onClick={()=>setCategoryId(category.id)} className={categoryId===category.id?'active':''}>{category.name}</button>)}</div>
   <div className="menu-section-head"><div><span className="eyebrow"><span/> {query.trim()?'SEARCH RESULTS':'OUR SELECTION'}</span><h2>{query.trim()?`Results for “${query.trim()}”`:restaurant.categories.find(category=>category.id===categoryId)?.name||'Our menu'}</h2></div><span>{shownItems.length} {shownItems.length===1?'dish':'dishes'}</span></div>
   {shownItems.length===0?<div className="empty-menu">{query.trim()?<><b>No dishes match “{query.trim()}”.</b><p>Try another ingredient or clear your search.</p><button className="button button-outline-dark" onClick={()=>setQuery('')}>Clear search</button></>:'Nothing here just yet. Try another category.'}</div>:<div className="food-grid">{shownItems.map(item=><MenuItemCard key={item.id} item={item} quantity={cart[item.id]||0} topOrdered={topOrderedIds.includes(item.id)} canOrder={Boolean(table&&tableToken&&diningSession?.status==='open')} onChange={updateQuantity}/>)}</div>}
   <div className="menu-footer"><RestaurantMark restaurant={restaurant} className="restaurant-emblem small-emblem"/><span>{restaurant.name}</span><i>•</i><span>{restaurant.instagram}</span></div>
  </div>
  {quantity>0&&<button className="mobile-cart-bar" onClick={()=>setDrawerOpen(true)}><span><ShoppingBag size={17}/> {quantity} item{quantity!==1?'s':''} · ₹{subtotal.toLocaleString('en-IN')}</span><b>View your cart <ChevronDown size={16}/></b></button>}
  {drawerOpen&&<CartDrawer restaurant={restaurant} cart={cart} subtotal={subtotal} submitted={submitted} trackingToken={submittedToken} busy={orderPending} onClose={()=>setDrawerOpen(false)} onQuantity={updateQuantity} onSubmit={placeOrder}/>}
  {table&&!diningSession&&<div className="session-gate"><form className="session-gate-card" onSubmit={createSession}><RestaurantMark restaurant={restaurant}/><span className="eyebrow"><span/> TABLE {String(table).padStart(2,'0')} · {restaurant.name.toUpperCase()}</span><h1>Who’s dining <em>with us?</em></h1><p>We’ll keep every round together on one bill under your name. You can request it whenever you’re ready.</p><label>Your name<input autoFocus required minLength={2} value={guestName} onChange={event=>setGuestName(event.target.value)} placeholder="Name for the bill"/></label>{guestError&&<div className="form-error">{guestError}</div>}{!tableToken&&<div className="form-error">Open the QR code physically placed on this table to start a secure order session.</div>}<button className="button button-dark full-button" disabled={!tableToken}>Start dining <Check size={15}/></button><small>Your name groups this table’s order rounds.</small></form></div>}
 </main>;
}
function ArrowRightIcon(){return <span aria-hidden="true">→</span>}
function Unavailable({title,detail,showHome=false}:{title:string;detail:string;showHome?:boolean}){return <main className="menu-page"><div className="menu-unavailable"><h1>{title}</h1><p>{detail}</p>{showHome&&<Link href="/">Back to Tabletouch</Link>}</div></main>}

