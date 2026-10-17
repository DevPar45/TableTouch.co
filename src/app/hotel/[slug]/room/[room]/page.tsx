'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Clock3, Hotel, Phone, ShieldCheck } from 'lucide-react';
import { RestaurantMark } from '@/components/RestaurantMark';
import { useStore } from '@/store';

export default function HotelRoomPage(){
 const params=useParams<{slug:string;room:string}>();
 const slug=Array.isArray(params.slug)?params.slug[0]:params.slug;
 const roomNumber=Array.isArray(params.room)?params.room[0]:params.room;
 const {restaurants,hydrated}=useStore();
 const hotel=restaurants.find(item=>item.slug===slug&&item.businessType==='hotel');
 if(!hydrated)return <div className="portal-loading">Opening your room-service guide…</div>;
 if(!hotel)return <Unavailable title="We can’t find that hotel service page." detail="Check the room QR code or ask reception for help."/>;
 const room=hotel.roomDetails?.find(item=>item.roomNumber===roomNumber&&item.isActive&&item.roomServiceEnabled);
 if(!room)return <Unavailable title="This room-service page is unavailable." detail="Ask reception for the current room QR code."/>;
 return <main className="menu-page" style={{'--brand':hotel.primaryColor,'--accent':hotel.secondaryColor} as React.CSSProperties}>
  <div className="menu-cover" style={{backgroundImage:hotel.coverImage?`linear-gradient(90deg,rgba(10,9,8,.66),rgba(10,9,8,.08)),url(${hotel.coverImage})`:undefined}}>
   <Link href="/" className="menu-back">Tabletouch</Link>
   <div className="menu-cover-copy"><RestaurantMark restaurant={hotel}/><div><span className="cover-label">ROOM SERVICE · ROOM {room.roomNumber}</span><h1>{hotel.name}</h1><p>{hotel.welcomeMessage||hotel.description||'Welcome. Browse hotel dining and guest-service information from this room.'}</p></div></div>
  </div>
  <div className="menu-shell"><div className="menu-meta"><div><h2>Your stay,<br/><em>made easier.</em></h2><p><span><Clock3 size={14}/>{hotel.hours}</span><span>·</span><span>{hotel.address}</span></p></div></div>
   <section className="owner-panel"><div className="owner-panel-head"><div><span className="eyebrow"><span/> ROOM {room.roomNumber}</span><h2>Room-service information</h2><p>Contact reception for the current room-service menu and available guest services. Online room ordering is not enabled on this hotel yet.</p></div><Hotel size={19}/></div><div className="hotel-room-public-actions"><a className="button button-dark" href={`tel:${hotel.phone.replace(/\s+/g,'')}`}><Phone size={15}/> Contact reception</a></div><div className="hotel-room-privacy"><ShieldCheck size={16}/><span><b>Private by design</b><small>This page does not show who is staying here, occupancy, charges, or guest-account details.</small></span></div></section>
  </div>
 </main>;
}

function Unavailable({title,detail}:{title:string;detail:string}){return <main className="menu-page"><div className="menu-unavailable"><h1>{title}</h1><p>{detail}</p><Link href="/">Back to Tabletouch</Link></div></main>}
