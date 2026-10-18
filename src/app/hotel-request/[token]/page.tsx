'use client';

import Link from 'next/link';
import { Check, Clock3, ConciergeBell, CircleHelp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase';

type RequestStatus='pending'|'acknowledged'|'in_progress'|'completed'|'cancelled';
type TrackedRequest={request_type:string;status:RequestStatus;created_at:string;acknowledged_at?:string;completed_at?:string};
const labels:Record<RequestStatus,string>={pending:'Request received',acknowledged:'Hotel team notified',in_progress:'The team is on it',completed:'Request completed',cancelled:'Request cancelled'};
const serviceName=(value:string)=>value.replace(/_/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase());

export default function HotelRequestTracking(){
 const {token}=useParams<{token:string}>();
 const supabase=getSupabaseBrowserClient();
 const [request,setRequest]=useState<TrackedRequest|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(async()=>{if(!supabase){setError('Guest service tracking is not connected. Please contact reception.');setLoading(false);return;}try{const {data,error:issue}=await supabase.rpc('get_hotel_service_request',{p_tracking_token:token});if(issue)throw issue;const row=Array.isArray(data)?data[0]:data;setRequest(row||null);setError('');}catch(issue){setError(issue instanceof Error?issue.message:'Guest service tracking is temporarily unavailable.');}finally{setLoading(false);}},[supabase,token]);
 useEffect(()=>{void load();const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void load();},8000);return()=>window.clearInterval(interval);},[load]);
 if(loading)return <main className="tracking-page"><div className="tracking-card">Loading your service request…</div></main>;
 if(!request)return <main className="tracking-page"><div className="tracking-card"><div className="tracking-icon"><CircleHelp/></div><h1>Request not found</h1><p>{error||'This tracking link is unavailable. Please contact reception for help.'}</p><Link className="button button-dark" href="/">Back to Tabletouch</Link></div></main>;
 const complete=request.status==='completed';
 return <main className="tracking-page"><div className="tracking-card"><Link href="/" className="tracking-brand"><span className="brand-mark">t.</span> tabletouch</Link><div className="tracking-icon"><ConciergeBell/></div><span className="eyebrow"><span/> GUEST SERVICE</span><h1>{labels[request.status]}</h1><p>{serviceName(request.request_type)}</p><div className="hotel-request-progress"><div className="hotel-request-progress-step done"><span><Check size={14}/></span><b>Request received</b></div><div className={`hotel-request-progress-step ${['acknowledged','in_progress','completed'].includes(request.status)?'done':''} ${request.status==='acknowledged'?'current':''}`}><span>{['in_progress','completed'].includes(request.status)?<Check size={14}/>:2}</span><b>Hotel team notified</b></div><div className={`hotel-request-progress-step ${complete?'done':''} ${request.status==='in_progress'?'current':''}`}><span>{complete?<Check size={14}/>:3}</span><b>The team is on it</b></div><div className={`hotel-request-progress-step ${complete?'done current':''}`}><span>{complete?<Check size={14}/>:4}</span><b>Completed</b></div></div>{request.status==='cancelled'&&<div className="form-error">The hotel cancelled this request. Please contact reception for assistance.</div>}<div className="tracking-prep"><Clock3 size={15}/>{complete?'Completed':'Updates refresh automatically while this page is open.'}</div><p className="tracking-refresh">Requested {new Date(request.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · This page does not display room or guest details.</p>{error&&<div className="form-error">{error}</div>}</div></main>;
}
