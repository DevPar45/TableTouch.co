'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Check, Clock3, CookingPot, Utensils } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import type { OrderStatus } from '@/data';

const steps:OrderStatus[]=['New','Accepted','Preparing','Ready','Served','Completed'];
const labels:Record<string,string>={New:'Order received',Accepted:'Restaurant accepted',Preparing:'Being prepared',Ready:'Ready to serve',Served:'Served at your table',Completed:'Complete'};
type Track={status:OrderStatus;table:string;restaurant:string;updated:string;total:number;items:{name:string;price:number;quantity:number}[]};

export default function OrderTracking(){
 const {token}=useParams<{token:string}>();const supabase=getSupabaseBrowserClient();const [order,setOrder]=useState<Track|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(async()=>{if(!supabase){setError('This order service is not connected. Contact the restaurant for help.');setLoading(false);return;}try{const {data,error:issue}=await supabase.rpc('get_order_tracking',{p_tracking_token:token});if(issue)throw issue;const row=Array.isArray(data)?data[0]:data;if(!row){setOrder(null);return;}const status=String(row.status).toLowerCase();const statusMap:Record<string,OrderStatus>={new:'New',accepted:'Accepted',preparing:'Preparing',ready:'Ready',served:'Served',completed:'Completed',cancelled:'Cancelled'};setOrder({status:statusMap[status]||'New',table:row.table_number,restaurant:row.restaurant_name,updated:row.updated_at,total:Number(row.order_total),items:(row.items||[]).map((item:{name:string;price:number;quantity:number})=>({...item,price:Number(item.price),quantity:Number(item.quantity)}))});setError('');}catch(issue){setError(issue instanceof Error?issue.message:'Order tracking is temporarily unavailable.');}finally{setLoading(false)}},[supabase,token]);
 useEffect(()=>{void load();const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load()},8000);return()=>window.clearInterval(interval)},[load]);
 if(loading)return <main className="tracking-page"><div className="tracking-card">Loading your order…</div></main>;
 if(!order)return <main className="tracking-page"><div className="tracking-card"><div className="tracking-icon"><Utensils/></div><h1>Order not found</h1><p>{error||'This tracking link has expired or is unavailable. Ask restaurant staff for help.'}</p><Link className="button button-dark" href="/">Back to Tabletouch</Link></div></main>;
 const current=Math.max(0,steps.indexOf(order.status));
 return <main className="tracking-page"><div className="tracking-card"><Link href="/" className="tracking-brand"><span className="brand-mark">t.</span> tabletouch</Link><div className="tracking-icon"><CookingPot/></div><span className="eyebrow"><span/> ORDER STATUS · TABLE {order.table}</span><h1>{labels[order.status]||order.status}</h1><p>{order.restaurant}</p><div className="tracking-steps">{steps.map((step,index)=><div className={`tracking-step ${index<current?'done':''} ${index===current?'current':''}`} key={step}><span>{index<current?<Check size={14}/>:index+1}</span><b>{labels[step]}</b><i/></div>)}</div>{order.status==='Preparing'&&<div className="tracking-prep"><Clock3 size={15}/> The kitchen is working on your order.</div>}{order.status==='Cancelled'&&<div className="form-error">The restaurant cancelled this order. Please speak with the staff.</div>}<section className="tracking-items"><b>This order round</b>{order.items.map((item,index)=><div key={`${item.name}-${index}`}><span>{item.quantity} × {item.name}</span><strong>₹{(item.price*item.quantity).toLocaleString('en-IN')}</strong></div>)}<div className="tracking-total"><span>Round total</span><strong>₹{order.total.toLocaleString('en-IN')}</strong></div></section><p className="tracking-refresh">Updated {new Date(order.updated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · Refreshes automatically.</p>{error&&<div className="form-error">{error}</div>}</div></main>;
}
