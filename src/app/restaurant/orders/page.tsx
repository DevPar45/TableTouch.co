'use client';

import Link from 'next/link';
import { ArrowRight, Clock3, UserRound, Utensils } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { OrderStatus } from '@/data';
import { useStore } from '@/store';

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = { New: 'Accepted', Accepted: 'Preparing', Preparing: 'Ready', Ready: 'Served', Served: 'Completed' };

function OrdersContent() {
  const { restaurants, sessionRestaurantId, orders, updateOrder } = useStore();
  const restaurant = restaurants.find(item => item.id === sessionRestaurantId);
  if (!restaurant) return null;
  const list = orders.filter(order => order.restaurantId === restaurant.id).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const activeCount = list.filter(order => !['Completed', 'Cancelled'].includes(order.status)).length;

  return <>
    <div className="owner-page-heading"><div><span className="eyebrow"><span/> TABLE SERVICE</span><h1>Orders</h1><p>QR, POS, waiter, and counter orders share this restaurant queue.</p></div><div className="order-live-badge"><i/> {activeCount} ACTIVE ORDERS</div></div>
    <div className="orders-toolbar"><span><b>{activeCount}</b> active orders</span><span>For staged kitchen controls, open Kitchen.</span></div>
    {list.length === 0 ? <div className="orders-empty"><div><Utensils/></div><h2>No orders yet</h2><p>Open a table menu or use POS to send an order to the kitchen.</p><Link className="button button-dark" href="/restaurant/pos">Open POS <ArrowRight size={14}/></Link></div> : <div className="orders-list">{list.map(order => <article className={`order-card order-${order.status.toLowerCase()}`} key={order.id}>
      <div className="order-card-head"><div className="order-table-number"><small>{order.tableNumber === 'COUNTER' ? 'SOURCE' : 'TABLE'}</small><b>{order.tableNumber === 'COUNTER' ? 'COUNTER' : order.tableNumber.padStart(2, '0')}</b></div><div className="order-head-copy"><span className={`order-state state-${order.status.toLowerCase()}`}>{order.status}</span><b>Order #{order.id.slice(-5).toUpperCase()}</b><small>{order.guestName && <><UserRound size={12}/>{order.guestName} · </>}<Clock3 size={12}/>{new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {order.source || 'QR/NFC'}</small></div><div className="order-total">₹{order.total}<small>round subtotal</small></div></div>
      <div className="order-items">{order.items.map((item, index) => <div key={`${item.itemId}-${index}`}><span><b>{item.quantity}×</b> {item.name}</span><strong>₹{item.price * item.quantity}</strong></div>)}</div>
      {order.note && <div className="order-note"><b>Guest note:</b> {order.note}</div>}
      <div className="order-card-foot">{order.tableNumber === 'COUNTER' ? <span>Counter order · included in the shared bill list</span> : <Link href={`/r/${restaurant.slug||restaurant.id}/table/${Number(order.tableNumber)}?table_token=${restaurant.tableTokens?.[order.tableNumber]||''}`} target="_blank">Open table menu <ArrowRight size={13}/></Link>}{order.status === 'Cancelled' ? <span className="cancelled-label">Cancelled</span> : order.status === 'Completed' ? <span className="served-label">Completed</span> : nextStatus[order.status] ? <button onClick={() => void updateOrder(order.id, nextStatus[order.status]!)}>{order.status === 'New' ? 'Accept order' : order.status === 'Accepted' ? 'Start preparation' : order.status === 'Preparing' ? 'Mark ready' : order.status === 'Ready' ? 'Mark served' : 'Complete order'} <ArrowRight size={14}/></button> : null}</div>
    </article>)}</div>}
  </>;
}

export default function RestaurantOrders() {
  return <OwnerShell active="Orders"><OrdersContent/></OwnerShell>;
}
