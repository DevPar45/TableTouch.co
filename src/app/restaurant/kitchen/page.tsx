'use client';
import { useEffect, useState } from 'react';
import { Clock3, CookingPot, UserRound, Utensils } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { OrderStatus, TableOrder } from '@/data';
import { useStore } from '@/store';

const nextStatus:Partial<Record<OrderStatus,OrderStatus>>={New:'Accepted',Accepted:'Preparing',Preparing:'Ready',Ready:'Served',Served:'Completed'};
function KitchenContent(){
 const {orders,restaurants,sessionRestaurantId,updateOrder}=useStore();
 const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),30000);return()=>window.clearInterval(timer)},[]);
 if(!restaurant)return null;
 const active=orders.filter(order=>order.restaurantId===restaurant.id&&!['Completed','Cancelled'].includes(order.status)).sort((a,b)=>a.placedAt.localeCompare(b.placedAt));
 const groups:[string,TableOrder[]][]=[['New',active.filter(order=>order.status==='New')],['Accepted / Preparing',active.filter(order=>order.status==='Accepted'||order.status==='Preparing')],['Ready to serve',active.filter(order=>order.status==='Ready')]];
 return <><div className="owner-page-heading"><div><span className="eyebrow"><span/> KITCHEN DISPLAY</span><h1>Kitchen queue</h1><p>Order rounds show the table and guest name so service staff can keep the bill together.</p></div><span className="order-live-badge"><i/> {active.length} ACTIVE</span></div><div className="kitchen-columns">{groups.map(([title,items])=><section className="kitchen-column" key={title}><header><h2>{title}</h2><span>{items.length}</span></header>{items.length===0?<div className="kitchen-empty"><Utensils size={17}/><span>Nothing waiting</span></div>:items.map(order=>{
  const age=Math.max(0,Math.floor((now-new Date(order.placedAt).getTime())/60000));
  const next=nextStatus[order.status];
  return <article className="kitchen-ticket" key={order.id}><div className="kitchen-ticket-head"><span className="kitchen-table">{order.tableNumber==='COUNTER'?'COUNTER':`TABLE ${order.tableNumber}`}</span><span className={`kitchen-age ${age>20?'late':''}`}><Clock3 size={12}/>{age} min</span></div><small><UserRound size={11}/> {order.guestName||'Guest'} · {order.source||'QR/NFC'} · #{order.id.slice(-5).toUpperCase()} · {new Date(order.placedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small><div className="kitchen-lines">{order.items.map(item=><div key={item.itemId}><b>{item.quantity}×</b><span>{item.name}</span></div>)}</div>{order.note&&<p className="kitchen-note">Note: {order.note}</p>}<div className="kitchen-ticket-foot"><strong>₹{order.total} round subtotal</strong>{next&&<button onClick={()=>updateOrder(order.id,next)}>{order.status==='New'?'Accept order':order.status==='Accepted'?'Start preparation':order.status==='Preparing'?'Mark ready':order.status==='Ready'?'Mark served':'Complete'}</button>}</div>{order.trackingToken&&<a className="kitchen-track" href={`/order/${order.trackingToken}`}>Customer tracking link</a>}</article>;
 })}</section>)}</div></>;
}
export default function KitchenPage(){return <OwnerShell active="Kitchen"><KitchenContent/></OwnerShell>}
