'use client';

import Link from 'next/link';
import { Check, Clock3, CookingPot, Utensils } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type Status='new'|'accepted'|'preparing'|'ready'|'delivered'|'cancelled';
type Track={status:Status;created_at:string;updated_at:string;order_total:number;items:{item_name:string;unit_price:number;quantity:number}[]};
const steps:Status[]=['new','accepted','preparing','ready','delivered'];
const labels:Record<Status,string>={new:'Order received',accepted:'Hotel accepted',preparing:'Being prepared',ready:'Ready for delivery',delivered:'Delivered',cancelled:'Order cancelled'};

export default function RoomOrderTracking(){
 const {token}=useParams<{token:string}>();const supabase=getSupabaseBrowserClient();const [order,setOrder]=useState<Track|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(async()=>{if(!supabase){setError('Room-service tracking is not connected. Please contact reception.');setLoading(false);return;}try{const {data,error:issue}=await supabase.rpc('get_hotel_room_service_order',{p_tracking_token:token});if(issue)throw issue;setOrder((Array.isArray(data)?data[0]:data)||null);setError('');}catch(issue){setError(issue instanceof Error?issue.message:'Room-service tracking is temporarily unavailable.');}finally{setLoading(false);}},[supabase,token]);
 useEffect(()=>{void load();const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},8000);return()=>window.clearInterval(interval);},[load]);
 if(loading)return <main className="tracking-page"><div className="tracking-card">Loading your room-service order…</div></main>;
 if(!order)return <main className="tracking-page"><div className="tracking-card"><div className="tracking-icon"><Utensils/></div><h1>Order not found</h1><p>{error||'This tracking link is unavailable. Please contact reception for help.'}</p><Link className="button button-dark" href="/">Back to Tabletouch</Link></div></main>;
 const current=Math.max(0,steps.indexOf(order.status));
 return <main className="tracking-page"><div className="tracking-card"><Link href="/" className="tracking-brand"><span className="brand-mark">t.</span> tabletouch</Link><div className="tracking-icon"><CookingPot/></div><span className="eyebrow"><span/> ROOM SERVICE</span><h1>{labels[order.status]}</h1><p>Follow your hotel room-service order here.</p><div className="tracking-steps">{steps.map((step,index)=><div className={`tracking-step ${index<current?'done':''} ${index===current?'current':''}`} key={step}><span>{index<current?<Check size={14}/>:index+1}</span><b>{labels[step]}</b><i/></div>)}</div>{order.status==='cancelled'&&<div className="form-error">The hotel cancelled this order. Please contact reception for assistance.</div>}<section className="tracking-items"><b>Your order</b>{order.items.map((item,index)=><div key={`${item.item_name}-${index}`}><span>{item.quantity} × {item.item_name}</span><strong>₹{(Number(item.unit_price)*Number(item.quantity)).toLocaleString('en-IN')}</strong></div>)}<div className="tracking-total"><span>Order total</span><strong>₹{Number(order.order_total).toLocaleString('en-IN')}</strong></div></section><div className="tracking-prep"><Clock3 size={15}/>Payment or room charges are handled by hotel staff.</div><p className="tracking-refresh">Updated {new Date(order.updated_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · This page does not display room or guest details.</p>{error&&<div className="form-error">{error}</div>}</div></main>;
}
