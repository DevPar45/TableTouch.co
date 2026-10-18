'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Clock3, Hotel, Minus, Phone, Plus, Send, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { RestaurantMark } from '@/components/RestaurantMark';
import { useStore } from '@/store';
import type { HotelServiceRequest } from '@/data';

const requestLabels: Record<HotelServiceRequest['type'],string> = {
 housekeeping:'Housekeeping',fresh_towels:'Fresh towels',extra_pillows:'Extra pillows',extra_blankets:'Extra blankets',toiletries:'Toiletries',water:'Water',tea_coffee:'Tea or coffee',cutlery:'Cutlery',tray_pickup:'Tray pickup',assistance:'Need assistance',luggage:'Luggage help',
};

export default function HotelRoomPage(){
 const params=useParams<{slug:string;room:string}>();
 const searchParams=useSearchParams();
 const slug=Array.isArray(params.slug)?params.slug[0]:params.slug;
 const roomNumber=Array.isArray(params.room)?params.room[0]:params.room;
 const roomToken=searchParams.get('room_token')||'';
 const {restaurants,hydrated,requestHotelService,placeHotelRoomServiceOrder}=useStore();
 const [requestType,setRequestType]=useState<HotelServiceRequest['type']>('housekeeping');
 const [note,setNote]=useState('');
 const [submitting,setSubmitting]=useState(false);
 const [message,setMessage]=useState('');
 const [cart,setCart]=useState<Record<string,number>>({});
 const [orderNote,setOrderNote]=useState('');
 const [ordering,setOrdering]=useState(false);
 const [orderMessage,setOrderMessage]=useState('');
 const hotel=restaurants.find(item=>item.slug===slug&&item.businessType==='hotel');
 if(!hydrated)return <div className="portal-loading">Opening your room-service guide…</div>;
 if(!hotel)return <Unavailable title="We can’t find that hotel service page." detail="Check the room QR code or ask reception for help."/>;
 const room=hotel.roomDetails?.find(item=>item.roomNumber===roomNumber&&item.isActive&&item.roomServiceEnabled);
 if(!room)return <Unavailable title="This room-service page is unavailable." detail="Ask reception for the current room QR code."/>;
 const roomMenu=hotel.menuItems.filter(item=>item.available);
 const orderLines=roomMenu.filter(item=>cart[item.id]).map(item=>({item,quantity:cart[item.id]}));
 const orderTotal=orderLines.reduce((sum,line)=>sum+line.item.price*line.quantity,0);
 const changeQuantity=(itemId:string,change:number)=>setCart(current=>{const next=Math.max(0,(current[itemId]||0)+change);const copy={...current};if(next)copy[itemId]=next;else delete copy[itemId];return copy;});
 return <main className="menu-page" style={{'--brand':hotel.primaryColor,'--accent':hotel.secondaryColor} as React.CSSProperties}>
  <div className="menu-cover" style={{backgroundImage:hotel.coverImage?`linear-gradient(90deg,rgba(10,9,8,.66),rgba(10,9,8,.08)),url(${hotel.coverImage})`:undefined}}>
   <Link href="/" className="menu-back">Tabletouch</Link>
   <div className="menu-cover-copy"><RestaurantMark restaurant={hotel}/><div><span className="cover-label">ROOM SERVICE · ROOM {room.roomNumber}</span><h1>{hotel.name}</h1><p>{hotel.welcomeMessage||hotel.description||'Welcome. Browse hotel dining and guest-service information from this room.'}</p></div></div>
  </div>
  <div className="menu-shell"><div className="menu-meta"><div><h2>Your stay,<br/><em>made easier.</em></h2><p><span><Clock3 size={14}/>{hotel.hours}</span><span>·</span><span>{hotel.address}</span></p></div></div>
   <section className="owner-panel"><div className="owner-panel-head"><div><span className="eyebrow"><span/> ROOM {room.roomNumber}</span><h2>Guest service</h2><p>Request help from the hotel team. Your request is sent only after this room’s QR or NFC link is verified.</p></div><Hotel size={19}/></div>
    {roomToken ? <form className="hotel-service-form" onSubmit={async event=>{event.preventDefault();setSubmitting(true);setMessage('');try{const result=await requestHotelService({hotelSlug:slug,roomNumber:room.roomNumber,roomToken,type:requestType,note});setNote('');setMessage(`Request sent. Track its progress with the link below.`);window.location.assign(`/hotel-request/${result.trackingToken}`);}catch(issue){setMessage(issue instanceof Error?issue.message:'Your request could not be sent. Please try again or contact reception.');}finally{setSubmitting(false);}}}>
      <label>What do you need?<select value={requestType} onChange={event=>setRequestType(event.target.value as HotelServiceRequest['type'])}>{Object.entries(requestLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
      <label>Optional note<textarea value={note} maxLength={300} onChange={event=>setNote(event.target.value)} placeholder="For example, please leave it outside the door."/></label>
      <button className="button button-dark" disabled={submitting} type="submit"><Send size={15}/>{submitting?'Sending request…':'Send request'}</button>
      {message&&<p className="hotel-service-message" role="status">{message}</p>}
    </form> : <div className="hotel-service-unavailable"><b>Open this page from the room QR or NFC tag.</b><p>That verifies the room before the hotel receives a request.</p></div>}
    <div className="hotel-room-public-actions"><a className="button button-outline-dark" href={`tel:${hotel.phone.replace(/\s+/g,'')}`}><Phone size={15}/> Contact reception</a></div><div className="hotel-room-privacy"><ShieldCheck size={16}/><span><b>Private by design</b><small>This page does not show who is staying here, occupancy, charges, or guest-account details.</small></span></div></section>
   <section className="owner-panel hotel-room-menu"><div className="owner-panel-head"><div><span className="eyebrow"><span/> ROOM SERVICE</span><h2>Order from the hotel menu</h2><p>Prices and availability are confirmed by the hotel server when you place the order. Payment or room charges are handled by hotel staff.</p></div><ShoppingBag size={19}/></div>
    {!roomToken?<div className="hotel-service-unavailable"><b>Open the room QR or NFC link to order.</b><p>The room token is required before any order can be sent.</p></div>:roomMenu.length===0?<div className="owner-empty"><div><ShoppingBag/></div><b>Room-service menu unavailable</b><p>Please contact reception for the current menu.</p></div>:<><div className="hotel-menu-grid">{roomMenu.map(item=><article className="hotel-menu-item" key={item.id}><div><b>{item.name}</b><small>{item.description||'Prepared by the hotel kitchen'}</small><strong>{hotel.currencyCode==='INR'?'₹':`${hotel.currencyCode} `}{item.price.toLocaleString('en-IN')}</strong></div><div className="hotel-menu-quantity">{cart[item.id]?<><button onClick={()=>changeQuantity(item.id,-1)} aria-label={`Remove one ${item.name}`}><Minus size={14}/></button><b>{cart[item.id]}</b><button onClick={()=>changeQuantity(item.id,1)} aria-label={`Add one ${item.name}`}><Plus size={14}/></button></>:<button className="hotel-menu-add" onClick={()=>changeQuantity(item.id,1)}>Add</button>}</div></article>)}</div>
    {orderLines.length>0&&<form className="hotel-order-checkout" onSubmit={async event=>{event.preventDefault();setOrdering(true);setOrderMessage('');try{const result=await placeHotelRoomServiceOrder({hotelSlug:slug,roomNumber:room.roomNumber,roomToken,items:orderLines.map(line=>({itemId:line.item.id,quantity:line.quantity})),note:orderNote});setCart({});setOrderNote('');window.location.assign(`/room-order/${result.trackingToken}`);}catch(issue){setOrderMessage(issue instanceof Error?issue.message:'Your room-service order could not be sent. Please try again or contact reception.');}finally{setOrdering(false);}}}><label>Optional note<textarea value={orderNote} maxLength={500} onChange={event=>setOrderNote(event.target.value)} placeholder="For example, no onions or please call before delivery."/></label><div><span>{orderLines.reduce((sum,line)=>sum+line.quantity,0)} item{orderLines.reduce((sum,line)=>sum+line.quantity,0)===1?'':'s'} · {hotel.currencyCode==='INR'?'₹':`${hotel.currencyCode} `}{orderTotal.toLocaleString('en-IN')}</span><button className="button button-dark" disabled={ordering} type="submit"><ShoppingBag size={15}/>{ordering?'Sending order…':'Place room-service order'}</button></div>{orderMessage&&<p className="hotel-service-message" role="status">{orderMessage}</p>}</form>}</>}
   </section>
  </div>
 </main>;
}

function Unavailable({title,detail}:{title:string;detail:string}){return <main className="menu-page"><div className="menu-unavailable"><h1>{title}</h1><p>{detail}</p><Link href="/">Back to Tabletouch</Link></div></main>}
