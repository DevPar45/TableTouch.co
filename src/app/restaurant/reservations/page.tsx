'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CalendarCheck2, Check, Clock3, Plus, UserRound, UsersRound, X } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/store';

type ReservationStatus = 'booked'|'arrived'|'seated'|'completed'|'cancelled'|'no_show';
type Reservation = { id:string; restaurant_id:string; table_id:string|null; guest_name:string; guest_phone:string; party_size:number; reservation_at:string; duration_minutes:number; status:ReservationStatus; notes:string; };
const statusLabel:Record<ReservationStatus,string>={booked:'Booked',arrived:'Arrived',seated:'Seated',completed:'Completed',cancelled:'Cancelled',no_show:'No show'};
const activeStatuses:ReservationStatus[]=['booked','arrived','seated'];

function localDateTime() {
  const date=new Date(Date.now()+60*60*1000);
  date.setMinutes(0,0,0);
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

function ReservationsContent() {
  const { restaurants, sessionRestaurantId, hydrated, configured }=useStore();
  const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
  const [reservations,setReservations]=useState<Reservation[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [guestName,setGuestName]=useState('');
  const [guestPhone,setGuestPhone]=useState('');
  const [partySize,setPartySize]=useState(2);
  const [reservationAt,setReservationAt]=useState(localDateTime);
  const [duration,setDuration]=useState(90);
  const [tableId,setTableId]=useState('');
  const [notes,setNotes]=useState('');

  const load=useCallback(async()=>{
    if(!restaurant)return;
    const client=getSupabaseBrowserClient();
    if(!client){setError('Connect Supabase before using reservations.');setLoading(false);return;}
    setLoading(true);
    const {data, error:readError}=await client.from('restaurant_reservations').select('*').eq('restaurant_id',restaurant.id).gte('reservation_at',new Date(Date.now()-7*86400000).toISOString()).order('reservation_at',{ascending:true});
    if(readError)setError(/does not exist|schema cache/i.test(readError.message)?'Reservations needs the latest database migration before it can be used.':'Reservations could not be loaded. Please try again.');
    else {setReservations((data||[]) as Reservation[]);setError('');}
    setLoading(false);
  },[restaurant]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    if(!restaurant)return;
    const client=getSupabaseBrowserClient();
    if(!client)return;
    const channel=client.channel(`reservations-${restaurant.id}`).on('postgres_changes',{event:'*',schema:'public',table:'restaurant_reservations',filter:`restaurant_id=eq.${restaurant.id}`},()=>void load()).subscribe();
    return()=>{void client.removeChannel(channel);};
  },[restaurant,load]);

  const liveCount=reservations.filter(item=>activeStatuses.includes(item.status)).length;
  const transition=async(reservation:Reservation,status:ReservationStatus)=>{
    const client=getSupabaseBrowserClient();
    if(!client)return;
    setError('');setNotice('');
    const {error:updateError}=await client.from('restaurant_reservations').update({status}).eq('id',reservation.id).eq('restaurant_id',reservation.restaurant_id);
    if(updateError){setError('The reservation status could not be changed. Please try again.');return;}
    setNotice(`${reservation.guest_name}'s reservation is now ${statusLabel[status].toLowerCase()}.`);
    void load();
  };
  const submit=async(event:FormEvent)=>{
    event.preventDefault();
    if(!restaurant)return;
    const client=getSupabaseBrowserClient();
    if(!client){setError('Connect Supabase before using reservations.');return;}
    const when=new Date(reservationAt);
    if(guestName.trim().length<2){setError('Enter the guest’s name.');return;}
    if(Number.isNaN(when.getTime())||when.getTime()<Date.now()-5*60000){setError('Choose a future reservation time.');return;}
    setSaving(true);setError('');setNotice('');
    const {error:insertError}=await client.from('restaurant_reservations').insert({restaurant_id:restaurant.id,table_id:tableId||null,guest_name:guestName.trim(),guest_phone:guestPhone.trim(),party_size:partySize,reservation_at:when.toISOString(),duration_minutes:duration,notes:notes.trim()});
    setSaving(false);
    if(insertError){setError(/does not exist|schema cache/i.test(insertError.message)?'Reservations needs the latest database migration before it can be used.':'This reservation could not be saved. Please check the details and try again.');return;}
    setGuestName('');setGuestPhone('');setPartySize(2);setReservationAt(localDateTime());setDuration(90);setTableId('');setNotes('');setNotice('Reservation saved and added to your live floor list.');
    void load();
  };
  if(!hydrated||!restaurant)return null;
  const renderTable=(item:Reservation)=>restaurant.tableDetails?.find(table=>table.id===item.table_id)?.tableNumber || (item.table_id ? 'Assigned' : 'Unassigned');

  return <><div className="owner-page-heading"><div><span className="eyebrow"><span/> GUEST RESERVATIONS</span><h1>Reservations</h1><p>Plan arrivals, reserve a table and move each party from booked to seated with the same restaurant workspace.</p></div><div className="reservation-live"><i/><b>{liveCount}</b> upcoming</div></div>
    {!configured?<div className="reservations-notice">Connect Supabase before saving reservations.</div>:<div className="reservations-layout"><section className="reservation-create"><div className="reservation-panel-heading"><span><CalendarCheck2/><b>New reservation</b></span><small>Stored privately for this restaurant</small></div><form onSubmit={submit}><label>Guest name<input required maxLength={120} value={guestName} onChange={event=>setGuestName(event.target.value)} placeholder="Guest name"/></label><div className="reservation-field-row"><label>Phone <input maxLength={40} value={guestPhone} onChange={event=>setGuestPhone(event.target.value)} placeholder="Optional"/></label><label>Party size<input type="number" min={1} max={100} value={partySize} onChange={event=>setPartySize(Math.max(1,Math.min(100,Number(event.target.value))))}/></label></div><label>Arrival time<input type="datetime-local" value={reservationAt} onChange={event=>setReservationAt(event.target.value)} required/></label><div className="reservation-field-row"><label>Table<select value={tableId} onChange={event=>setTableId(event.target.value)}><option value="">Assign later</option>{restaurant.tableDetails?.filter(table=>table.isActive&&table.id).map(table=><option key={table.tableNumber} value={table.id}>Table {table.tableNumber}</option>)}</select></label><label>Duration<select value={duration} onChange={event=>setDuration(Number(event.target.value))}><option value={60}>1 hour</option><option value={90}>1½ hours</option><option value={120}>2 hours</option><option value={180}>3 hours</option></select></label></div><label>Notes<textarea maxLength={1000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Allergies, occasion, seating request…"/></label><button className="button button-dark" disabled={saving}>{saving?'Saving…':<><Plus size={15}/> Save reservation</>}</button></form>{(error||notice)&&<p className={error?'reservation-message is-error':'reservation-message'} role="status">{error||notice}</p>}</section>
      <section className="reservation-list"><div className="reservation-panel-heading"><span><Clock3/><b>Arrival list</b></span><small>Next 7 days and recent history</small></div>{loading?<div className="reservation-empty">Loading reservations…</div>:reservations.length===0?<div className="reservation-empty"><CalendarCheck2/><b>No reservations yet</b><small>Save a guest booking to see it here.</small></div>:<div>{reservations.map(item=>{const isPast=['completed','cancelled','no_show'].includes(item.status);const date=new Date(item.reservation_at);return <article className={`reservation-row ${isPast?'is-past':''}`} key={item.id}><div className="reservation-time"><b>{date.toLocaleDateString([],{month:'short',day:'numeric'})}</b><span>{date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span></div><div className="reservation-guest"><b><UserRound size={14}/>{item.guest_name}</b><small><UsersRound size={13}/>{item.party_size} guests · {renderTable(item)}{item.guest_phone?` · ${item.guest_phone}`:''}</small>{item.notes&&<em>{item.notes}</em>}</div><span className={`reservation-status status-${item.status}`}>{statusLabel[item.status]}</span><div className="reservation-actions">{item.status==='booked'&&<button onClick={()=>void transition(item,'arrived')}>Arrived</button>}{item.status==='arrived'&&<button onClick={()=>void transition(item,'seated')}>Seat party</button>}{item.status==='seated'&&<button onClick={()=>void transition(item,'completed')}><Check size={13}/> Complete</button>}{activeStatuses.includes(item.status)&&<button aria-label={`Cancel ${item.guest_name}'s reservation`} className="reservation-cancel" onClick={()=>void transition(item,'cancelled')}><X size={14}/></button>}</div></article>})}</div>}</section></div>}</>;
}

export default function RestaurantReservations(){return <OwnerShell active="Reservations"><ReservationsContent/></OwnerShell>;}
