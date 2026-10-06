'use client';

import Link from 'next/link';
import { ArrowRight, ClipboardList, QrCode, Utensils } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { DiningSession, TableOrder } from '@/data';
import { useStore } from '@/store';

function DashboardContent() {
  const { restaurants, sessionRestaurantId, orders, diningSessions } = useStore();
  const restaurant = restaurants.find(item => item.id === sessionRestaurantId);
  if (!restaurant) return null;

  const list = orders.filter(order => order.restaurantId === restaurant.id).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
  const activeOrders = list.filter(order => order.tableNumber !== 'COUNTER' && !['Completed', 'Cancelled'].includes(order.status));
  const activeSessions = diningSessions.filter(session => session.restaurantId === restaurant.id && session.tableNumber !== 'COUNTER' && session.status !== 'closed');
  const occupiedTables = new Set([...activeOrders.map(order => order.tableNumber), ...activeSessions.map(session => session.tableNumber)]);
  const today = new Date().toLocaleDateString();
  const todayOrders = list.filter(order => new Date(order.placedAt).toLocaleDateString() === today);
  const newCount = list.filter(order => order.status === 'New').length;
  const preparingCount = list.filter(order => order.status === 'Accepted' || order.status === 'Preparing').length;
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
    <div className="owner-tip"><div><Utensils/><span><b>Your customer menu is live.</b><small>Menu updates from your restaurant workspace appear on every table link.</small></span></div><Link href={`/r/${restaurant.slug||restaurant.id}/table/1?table_token=${restaurant.tableTokens?.['01']||''}`} target="_blank">Preview table menu <ArrowRight size={14}/></Link></div>
  </>;
}

export default function RestaurantDashboard() {
  return <OwnerShell active="Dashboard"><DashboardContent/></OwnerShell>;
}
