'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, Search, ShoppingBag, UserRound } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { DiningSession, MenuItem, TableOrder } from '@/data';
import { useStore } from '@/store';

type Source = 'POS' | 'Waiter' | 'Counter';

function PosContent() {
  const { restaurants, sessionRestaurantId, placeStaffOrder, diningSessions, orders } = useStore();
  const restaurant = restaurants.find(item => item.id === sessionRestaurantId);
  const [source, setSource] = useState<Source>('POS');
  const [tableNumber, setTableNumber] = useState('01');
  const [guestName, setGuestName] = useState('');
  const [note, setNote] = useState('');
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [joinOpenSession, setJoinOpenSession] = useState(true);
  const [sending,setSending]=useState(false);const [requestId,setRequestId]=useState<string|null>(null);const sendingRef=useRef(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const availableItems = restaurant?.menuItems.filter(item => item.available) || [];
  const shownItems = useMemo(() => availableItems.filter(item => {
    const categoryMatch = categoryId === 'all' || item.category === categoryId;
    const text = [item.name, item.description, ...(item.tags || []), ...(item.ingredients || []), ...(item.searchKeywords || [])].join(' ').toLowerCase();
    return categoryMatch && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [availableItems, categoryId, query]);
  if (!restaurant) return null;
  const isTableOrder = source !== 'Counter';
  const openSession = diningSessions.filter(session => session.restaurantId === restaurant.id && session.tableNumber === tableNumber && session.status === 'open').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const lines = availableItems.filter(item => cart[item.id] > 0);
  const subtotal = lines.reduce((sum, item) => sum + item.price * cart[item.id], 0);
  const quantity = lines.reduce((sum, item) => sum + cart[item.id], 0);
  const setQuantity = (item: MenuItem, next: number) => {setRequestId(null);setCart(current => ({ ...current, [item.id]: Math.max(0, next) }));};
  const placeOrder = async () => {
    setError('');
    setSuccess('');
    if (lines.length === 0) return setError('Add at least one item before sending this order.');
    if (isTableOrder && !openSession && guestName.trim().length < 2) return setError('Enter the guest name so this order can be added to the right bill.');
    if(sendingRef.current)return;
    sendingRef.current=true;setSending(true);
    try {
      const idempotencyKey=requestId||crypto.randomUUID();setRequestId(idempotencyKey);
      await placeStaffOrder({restaurant,tableNumber,guestName:guestName.trim()||'Counter sale',source,sessionId:openSession&&joinOpenSession?openSession.id:undefined,items:lines.map(item=>({itemId:item.id,quantity:cart[item.id]})),note:note.trim(),idempotencyKey});
      setCart({});setNote('');setGuestName('');setRequestId(null);setSuccess(`${source} order saved and sent to the live kitchen queue${isTableOrder?` for Table ${tableNumber}`:''}.`);
    } catch (issue) { setError(issue instanceof Error?issue.message:'Could not save the order.'); }
    finally{sendingRef.current=false;setSending(false);}
  };

  return <div className="pos-workspace">
    <div className="owner-page-heading"><div><span className="eyebrow"><span/> SHARED ORDER ENTRY</span><h1>POS & waiter orders</h1><p>Staff orders go into the same queue as QR orders, kitchen tickets, and table bills.</p></div><span className="order-live-badge"><i/> {orders.filter(order => order.restaurantId === restaurant.id && !['Completed', 'Cancelled'].includes(order.status)).length} ACTIVE ORDERS</span></div>
    <div className="pos-layout">
      <section className="pos-menu-panel">
        <div className="pos-toolbar"><label className="pos-search"><Search size={15}/><input aria-label="Search menu" placeholder="Search dishes" value={query} onChange={event => setQuery(event.target.value)}/></label><select aria-label="Filter menu category" value={categoryId} onChange={event => setCategoryId(event.target.value)}><option value="all">All categories</option>{restaurant.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
        {shownItems.length === 0 ? <div className="pos-empty">No available items match this search.</div> : <div className="pos-item-grid">{shownItems.map(item => <article className="pos-item" key={item.id}><div className="pos-item-copy"><small>{restaurant.categories.find(category => category.id === item.category)?.name || 'Menu item'}</small><b>{item.name}</b><span>₹{item.price.toLocaleString('en-IN')}</span></div><div className="pos-item-actions">{cart[item.id] > 0 && <><button aria-label={`Remove one ${item.name}`} onClick={() => setQuantity(item, cart[item.id] - 1)}><Minus size={14}/></button><b>{cart[item.id]}</b></>}<button aria-label={`Add one ${item.name}`} onClick={() => setQuantity(item, (cart[item.id] || 0) + 1)}><Plus size={14}/></button></div></article>)}</div>}
      </section>
      <aside className="pos-ticket">
        <div className="pos-ticket-head"><div><span className="eyebrow"><span/> NEW ORDER</span><h2>Current ticket</h2></div><div className="pos-ticket-count"><ShoppingBag size={15}/>{quantity}</div></div>
        <div className="pos-source-picker"><label>Order type<select value={source} onChange={event => setSource(event.target.value as Source)}><option value="POS">POS · Table service</option><option value="Waiter">Waiter order</option><option value="Counter">Counter / takeaway</option></select></label></div>
        {isTableOrder ? <>
          <label className="pos-field">Table<select value={tableNumber} onChange={event => { setTableNumber(event.target.value); setJoinOpenSession(true); setGuestName(''); }} aria-label="Table number">{(restaurant.tableNumbers?.length?restaurant.tableNumbers:Array.from({ length: restaurant.tableCount || 8 }, (_, index) => String(index + 1).padStart(2, '0'))).map(table => <option key={table} value={table}>Table {table}</option>)}</select></label>
          {openSession && <label className="pos-join-session"><input type="checkbox" checked={joinOpenSession} onChange={event => setJoinOpenSession(event.target.checked)}/><span><b>Add to {openSession.guestName}’s bill</b><small>Existing table session · {orders.filter(order => order.diningSessionId === openSession.id && order.status !== 'Cancelled').length} rounds</small></span></label>}
          {(!openSession || !joinOpenSession) && <label className="pos-field">Guest name<input value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Name for the bill"/></label>}
        </> : <label className="pos-field">Customer name <span className="optional">(optional)</span><input value={guestName} onChange={event => setGuestName(event.target.value)} placeholder="Name for the order"/></label>}
        <label className="pos-field">Kitchen note <span className="optional">(optional)</span><textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Special instructions for the kitchen"/></label>
        <div className="pos-lines">{lines.length === 0 ? <div className="pos-ticket-empty"><ShoppingBag size={19}/><span>Add dishes to start an order</span></div> : lines.map(item => <div className="pos-line" key={item.id}><span><b>{cart[item.id]}×</b> {item.name}</span><strong>₹{(item.price * cart[item.id]).toLocaleString('en-IN')}</strong><button aria-label={`Remove all ${item.name}`} onClick={() => setQuantity(item, 0)}><Minus size={13}/></button></div>)}</div>
        <div className="pos-total"><span>Order subtotal</span><b>₹{subtotal.toLocaleString('en-IN')}</b><small>Taxes and service charges are calculated once on the final guest bill.</small></div>
        {error && <div className="form-error">{error}</div>}{success && <div className="pos-success"><Check size={15}/>{success}</div>}
        <button className="button button-dark full-button" onClick={placeOrder} disabled={quantity === 0||sending}><UserRound size={15}/> {sending?'Sending…':'Send to kitchen'}</button>
      </aside>
    </div>
  </div>;
}

export default function RestaurantPOS() {
  return <OwnerShell active="POS"><PosContent/></OwnerShell>;
}
