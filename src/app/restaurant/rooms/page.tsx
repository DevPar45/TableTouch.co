'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Copy, Power, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { OwnerShell } from '@/components/OwnerShell';
import { useStore } from '@/store';

function RoomsContent(){
 const {restaurants,sessionRestaurantId,addHotelRooms,rotateHotelRoomToken,setHotelRoomActive}=useStore();
 const [count,setCount]=useState(1);const [busy,setBusy]=useState(false);const [working,setWorking]=useState<string|null>(null);const [message,setMessage]=useState('');
 const hotel=restaurants.find(item=>item.id===sessionRestaurantId);
 if(!hotel||hotel.businessType!=='hotel')return <div className="portal-gate"><div className="brand-mark">t.</div><h1>Hotel rooms</h1><p>Room management is available only for hotel workspaces.</p></div>;
 const copy=(value:string)=>void navigator.clipboard?.writeText(value);
 const rotate=async(roomNumber:string)=>{if(!window.confirm(`Rotate the QR and NFC capability for room ${roomNumber}? The existing physical tag will stop working.`))return;setWorking(`rotate-${roomNumber}`);setMessage('');try{await rotateHotelRoomToken(hotel.id,roomNumber);setMessage(`Room ${roomNumber} has a new link. Replace its physical QR or NFC tag.`);}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not rotate this room link.');}finally{setWorking(null);}};
 const toggle=async(roomNumber:string,isActive:boolean)=>{setWorking(`active-${roomNumber}`);setMessage('');try{await setHotelRoomActive(hotel.id,roomNumber,!isActive);setMessage(isActive?`Room ${roomNumber} is paused for new room-service sessions.`:`Room ${roomNumber} is active again.`);}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not update this room.');}finally{setWorking(null);}};
 const add=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage('');try{await addHotelRooms(hotel.id,count);setMessage(`${count} room${count===1?'':'s'} added with their own QR and NFC destination.`);}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not add rooms.');}finally{setBusy(false);}};
 return <>
  <div className="owner-page-heading"><div><span className="eyebrow"><span/> HOTEL ROOM ACCESS</span><h1>Your rooms</h1><p>Each room keeps a stable destination for its QR code or NFC tag. These links never disclose stay, occupancy, guest, or billing data.</p></div></div>
  <div className="owner-table-list">{(hotel.roomDetails||[]).map(room=>{
   const path=`/hotel/${hotel.slug||hotel.id}/room/${encodeURIComponent(room.roomNumber)}${room.publicToken?`?room_token=${encodeURIComponent(room.publicToken)}`:''}`;
   const link=typeof window==='undefined'?path:`${window.location.origin}${path}`;
   return <article className={`owner-table-card ${room.isActive?'':'is-paused'}`} key={room.roomNumber}><div className="owner-table-qr"><QRCodeSVG value={link} size={82} level="M" fgColor={hotel.primaryColor}/></div><div className="owner-table-info"><span className="eyebrow"><span/> ROOM {room.roomNumber}</span><b>{room.isActive&&room.roomServiceEnabled?'Room service ready':'Room service paused'}</b><small>{[room.roomType,room.floorLabel,`Housekeeping: ${room.housekeepingStatus.replace('_',' ')}`].filter(Boolean).join(' · ')||'No room details configured'}</small><div className="owner-table-buttons"><button onClick={()=>copy(link)}><Copy size={13}/> Copy room link</button>{room.isActive&&room.roomServiceEnabled&&<Link href={path} target="_blank"><QrCode size={13}/> Open room page</Link>}<button disabled={working!==null} onClick={()=>void rotate(room.roomNumber)}><RefreshCw size={13}/> {working===`rotate-${room.roomNumber}`?'Rotating…':'Rotate QR/NFC'}</button><button disabled={working!==null} onClick={()=>void toggle(room.roomNumber,room.isActive)}><Power size={13}/> {working===`active-${room.roomNumber}`?'Saving…':room.isActive?'Pause room':'Resume room'}</button></div></div></article>;
  })}</div>
  <form className="add-tables-form" onSubmit={add}><div><b>Add rooms</b><small>New rooms are created as private inventory until the hotel is approved and service is live.</small></div><label>Number<input type="number" min={1} max={100} value={count} onChange={event=>setCount(Math.max(1,Math.min(100,Number(event.target.value))))}/></label><button className="button button-dark" disabled={busy}>{busy?'Adding…':'Create room links'}</button>{message&&<span role="status">{message}</span>}</form>
 </>;
}

export default function HotelRooms(){return <OwnerShell active="Rooms"><RoomsContent/></OwnerShell>}
