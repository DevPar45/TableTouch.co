'use client';

import Link from 'next/link';
import { ArrowRight, BellRing, Check, ClipboardList, Hotel, QrCode, Utensils } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { DiningSession, HotelServiceRequest, TableOrder } from '@/data';
import { useStore } from '@/store';

function DashboardContent() {
  const { restaurants, sessionRestaurantId, orders, diningSessions, serviceRequests, updateTableServiceRequest } = useStore();
  const restaurant = restaurants.find(item => item.id === sessionRestaurantId);
  if (!restaurant) return null;
  if (restaurant.businessType === 'hotel') return <HotelDashboard/>;

  const list = orders.filter(order => order.restaurantId === restaurant.id).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const activeOrders = list.filter(order => order.tableNumber !== 'COUNTER' && !['Completed', 'Cancelled'].includes(order.status));
  const activeSessions = diningSessions.filter(session => session.restaurantId === restaurant.id && session.tableNumber !== 'COUNTER' && session.status !== 'closed');
  const occupiedTables = new Set([...activeOrders.map(order => order.tableNumber), ...activeSessions.map(session => session.tableNumber)]);
  const today = new Date().toLocaleDateString();
  const todayOrders = list.filter(order => new Date(order.placedAt).toLocaleDateString() === today);
  const newCount = list.filter(order => order.status === 'New').length;
  const preparingCount = list.filter(order => order.status === 'Accepted' || order.status === 'Preparing').length;
  const openServiceRequests = serviceRequests.filter(request => request.restaurantId === restaurant.id && ['new','acknowledged'].includes(request.status));
  const tables = restaurant.tableNumbers?.length ? restaurant.tableNumbers : Array.from({ length: restaurant.tableCount || 8 }, (_, index) => String(index + 1).padStart(2, '0'));

  return <>
    <div className="owner-page-heading">
      <div><span className="eyebrow"><span/> SERVICE OVERVIEW</span><h1>Good to see you, {restaurant.ownerName?.split(' ')[0] || restaurant.name}.</h1><p>Orders from your QR and NFC tables land here as they come in.</p></div>
      <Link href="/restaurant/orders" className="button button-dark">Open orders <ArrowRight size={15}/></Link>
    </div>
    <div className="owner-stats">
      <div><span>NEW ORDERS</span><b>{newCount}</b><small>Needs your attention</small></div>
      <div><span>IN PREPARATION</span><b>{preparingCount}</b><small>Accepted or being prepared</small></div>
      <div><span>ACTIVE TABLES</span><b>{occupiedTables.size}</b><small>Open order or dining session</small></div>
      <div><span>TODAY’S ORDERS</span><b>{todayOrders.length}</b><small>Placed today</small></div>
    </div>
    <div className="owner-dashboard-grid">
      <section className="owner-panel">
        <div className="owner-panel-head"><div><h2>Table status</h2><p>Current guest session and latest order at each table</p></div><Link href="/restaurant/tables">View all tables <ArrowRight size={13}/></Link></div>
        <div className="table-status-grid">{tables.map(table => {
          const session: DiningSession | undefined = activeSessions.find(item => item.tableNumber === table);
          const tableOrders: TableOrder[] = list.filter(order => order.tableNumber === table);
          const latestOrder = tableOrders[0];
          const state = session ? (session.status === 'bill_requested' ? 'Bill requested' : `Dining · ${session.guestName}`) : latestOrder && !['Completed', 'Cancelled'].includes(latestOrder.status) ? latestOrder.status : 'No active order';
          const detail = session ? `${tableOrders.filter(order => order.diningSessionId === session.id && order.status !== 'Cancelled').length} order rounds · ${session.guestName}` : latestOrder ? `${latestOrder.items.reduce((sum, item) => sum + item.quantity, 0)} items · ₹${latestOrder.total} · ${latestOrder.status}` : 'Ready for guests';
          const occupied = Boolean(session || (latestOrder && !['Completed', 'Cancelled'].includes(latestOrder.status)));
          return <Link key={table} href={`/restaurant/tables#table-${table}`} className={`table-status-tile ${occupied ? 'has-order' : ''}`}>
            <span>TABLE {table}</span><b>{state}</b><small>{detail}</small>
          </Link>;
        })}</div>
      </section>
      <section className="owner-panel owner-activity">
        <div className="owner-panel-head"><div><h2>Latest activity</h2><p>Your newest table orders</p></div><ClipboardList size={17}/></div>
        {list.length === 0 ? <div className="owner-empty"><div><QrCode/></div><b>Orders will show up here</b><p>Open a table menu to see how a customer order appears here.</p><Link href={`/r/${restaurant.slug||restaurant.id}/table/1?table_token=${restaurant.tableTokens?.['01']||''}`} target="_blank" className="button button-outline-dark">Open table 01 menu</Link></div> : list.slice(0, 5).map(order => <div className="activity-order" key={order.id}>
          <div className="activity-table">{order.tableNumber}</div><span><b>Table {order.tableNumber} · {order.items.length} items</b><small>{order.items.map(item => `${item.quantity}× ${item.name}`).join(', ')}</small></span><strong>₹{order.total}</strong><i className={`order-state state-${order.status.toLowerCase()}`}>{order.status}</i>
        </div>)}
      </section>
    </div>
    <section className="owner-panel service-request-panel">
      <div className="owner-panel-head"><div><h2>Guest requests</h2><p>Calls from active table sessions appear here immediately.</p></div><BellRing size={17}/></div>
      {openServiceRequests.length===0?<div className="owner-empty service-request-empty"><div><BellRing/></div><b>No open guest requests</b><p>Guests can use Call staff from their table menu whenever they need help.</p></div>:<div className="service-request-list">{openServiceRequests.map(request=><div className={`service-request-row is-${request.status}`} key={request.id}><span className="service-request-table">{request.tableNumber}</span><div><b>Table {request.tableNumber} · {request.type.replace('_',' ')}</b><small>{request.note||'Guest requested assistance'} · {new Date(request.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></div><span className="service-request-status">{request.status==='new'?'Needs response':'Acknowledged'}</span><div className="service-request-actions">{request.status==='new'&&<button onClick={()=>void updateTableServiceRequest(request.id,'acknowledged')}>Acknowledge</button>}<button className="service-resolve" onClick={()=>void updateTableServiceRequest(request.id,request.status==='new'?'cancelled':'resolved')}>{request.status==='new'?'Dismiss':'Done'} {request.status==='acknowledged'&&<Check size={12}/>}</button></div></div>)}</div>}
    </section>
    <div className="owner-tip"><div><Utensils/><span><b>Your customer menu is live.</b><small>Menu updates from your restaurant workspace appear on every table link.</small></span></div><Link href={`/r/${restaurant.slug||restaurant.id}/table/1?table_token=${restaurant.tableTokens?.['01']||''}`} target="_blank">Preview table menu <ArrowRight size={14}/></Link></div>
  </>;
}

const hotelRequestLabel=(type:HotelServiceRequest['type'])=>type.replace(/_/g,' ');
function HotelDashboard(){
  const {restaurants,sessionRestaurantId,hotelServiceRequests,hotelRoomServiceOrders,updateHotelServiceRequest,updateHotelRoomServiceOrder}=useStore();
  const hotel=restaurants.find(item=>item.id===sessionRestaurantId);
  if(!hotel)return null;
  const requests=hotelServiceRequests.filter(item=>item.hotelId===hotel.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const pending=requests.filter(item=>item.status==='pending');
  const inProgress=requests.filter(item=>['acknowledged','in_progress'].includes(item.status));
  const today=new Date().toLocaleDateString();
  const completedToday=requests.filter(item=>item.status==='completed'&&new Date(item.completedAt||item.createdAt).toLocaleDateString()===today);
  const roomOrders=hotelRoomServiceOrders.filter(item=>item.hotelId===hotel.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  const canCancel=['owner','manager'].includes(hotel.memberRole||'');
  const advance=(request:HotelServiceRequest)=>request.status==='pending'?'acknowledged':request.status==='acknowledged'?'in_progress':request.status==='in_progress'?'completed':null;
  return <>
    <div className="owner-page-heading"><div><span className="eyebrow"><span/> HOTEL OPERATIONS</span><h1>Guest service, in one queue.</h1><p>Requests from room QR and NFC links arrive here after the room token is verified.</p></div><Link href="/restaurant/rooms" className="button button-dark">Manage rooms <ArrowRight size={15}/></Link></div>
    <div className="owner-stats"><div><span>NEW REQUESTS</span><b>{pending.length}</b><small>Needs a response</small></div><div><span>IN PROGRESS</span><b>{inProgress.length}</b><small>Assigned or underway</small></div><div><span>COMPLETED TODAY</span><b>{completedToday.length}</b><small>Guest service completed</small></div><div><span>ACTIVE ROOMS</span><b>{hotel.roomDetails?.filter(room=>room.isActive&&room.roomServiceEnabled).length||0}</b><small>QR and NFC destinations</small></div></div>
    <section className="owner-panel service-request-panel"><div className="owner-panel-head"><div><h2>Guest-service queue</h2><p>Staff can acknowledge, start, and complete each request. Room and guest details remain within the hotel workspace.</p></div><BellRing size={17}/></div>
      {requests.length===0?<div className="owner-empty service-request-empty"><div><BellRing/></div><b>No guest-service requests yet</b><p>Requests will appear here when a guest uses a verified room QR or NFC link.</p></div>:<div className="service-request-list">{requests.map(request=>{const next=advance(request);return <div className={`service-request-row hotel-service-row is-${request.status}`} key={request.id}><span className="service-request-table">{request.roomNumber}</span><div><b>Room {request.roomNumber} · {hotelRequestLabel(request.type)}</b><small>{request.note||'No guest note'} · {new Date(request.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</small></div><span className="service-request-status">{request.status.replace('_',' ')}</span><div className="service-request-actions">{next&&<button onClick={()=>void updateHotelServiceRequest(request.id,next)}>{next==='acknowledged'?'Acknowledge':next==='in_progress'?'Start':'Complete'} {next==='completed'&&<Check size={12}/>}</button>}{canCancel&&['pending','acknowledged','in_progress'].includes(request.status)&&<button className="service-resolve" onClick={()=>void updateHotelServiceRequest(request.id,'cancelled')}>Cancel</button>}</div></div>})}</div>}
    </section>
    <section className="owner-panel service-request-panel"><div className="owner-panel-head"><div><h2>Room-service orders</h2><p>These orders are kitchen and delivery work only. Hotel staff confirm payment or room charges separately.</p></div><ClipboardList size={17}/></div>
      {roomOrders.length===0?<div className="owner-empty service-request-empty"><div><ClipboardList/></div><b>No room-service orders yet</b><p>Orders from verified room QR or NFC links will appear here.</p></div>:<div className="service-request-list">{roomOrders.map(order=>{const next=order.status==='new'?'accepted':order.status==='accepted'?'preparing':order.status==='preparing'?'ready':order.status==='ready'?'delivered':null;return <div className={`service-request-row hotel-service-row is-${order.status}`} key={order.id}><span className="service-request-table">{order.roomNumber}</span><div><b>Room {order.roomNumber} · {order.items.reduce((sum,item)=>sum+item.quantity,0)} items · ₹{order.total}</b><small>{order.items.map(item=>`${item.quantity}× ${item.name}`).join(', ')}{order.note?` · ${order.note}`:''}</small></div><span className="service-request-status">{order.status.replace('_',' ')}</span><div className="service-request-actions">{next&&<button onClick={()=>void updateHotelRoomServiceOrder(order.id,next)}>{next==='accepted'?'Accept':next==='preparing'?'Prepare':next==='ready'?'Ready':'Delivered'} {next==='delivered'&&<Check size={12}/>}</button>}{canCancel&&['new','accepted','preparing','ready'].includes(order.status)&&<button className="service-resolve" onClick={()=>void updateHotelRoomServiceOrder(order.id,'cancelled')}>Cancel</button>}</div></div>})}</div>}
    </section>
    <div className="owner-tip"><div><Hotel/><span><b>Room QR and NFC destinations are ready.</b><small>Rotate a room link immediately if a tag is lost, moved, or replaced.</small></span></div><Link href="/restaurant/rooms">Open rooms <ArrowRight size={14}/></Link></div>
  </>;
}

export default function RestaurantDashboard() {
  return <OwnerShell active="Dashboard"><DashboardContent/></OwnerShell>;
}
