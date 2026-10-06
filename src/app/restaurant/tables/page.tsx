'use client';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, QrCode } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { useStore } from '@/store';
import { useState } from 'react';

function TablesContent(){
 const {restaurants,sessionRestaurantId,orders,diningSessions,addTables}=useStore();
 const [extraTables,setExtraTables]=useState(1);const [adding,setAdding]=useState(false);const [message,setMessage]=useState('');
 const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 if(!restaurant)return null;
 const tables=restaurant.tableNumbers?.length?restaurant.tableNumbers:Array.from({length:restaurant.tableCount||8},(_,index)=>String(index+1).padStart(2,'0'));
 const copy=(text:string)=>navigator.clipboard?.writeText(text);
 return <><div className="owner-page-heading"><div><span className="eyebrow"><span/> EVERY TABLE CONNECTED</span><h1>Your tables</h1><p>See the guest name, order rounds and bill state for each occupied table.</p></div></div><div className="owner-table-list">{tables.map(table=>{
  const session=diningSessions.find(item=>item.restaurantId===restaurant.id&&item.tableNumber===table&&item.status!=='closed');
  const sessionOrders=session?orders.filter(item=>item.diningSessionId===session.id&&item.status!=='Cancelled'):[];
  const latestOrder=sessionOrders[0];
 const tableToken=restaurant.tableTokens?.[table]||'';
 const path=`/r/${restaurant.slug||restaurant.id}/table/${Number(table)}${tableToken?`?table_token=${encodeURIComponent(tableToken)}`:''}`;
 const link=typeof window!=='undefined'?`${window.location.origin}${path}`:path;
  return <article id={`table-${table}`} className="owner-table-card" key={table}><div className="owner-table-qr"><QRCodeSVG value={link} size={82} level="M" fgColor={restaurant.primaryColor}/></div><div className="owner-table-info"><span className="eyebrow"><span/> TABLE {table}</span><b>{session?`${session.guestName} · ${session.status==='bill_requested'?'Bill requested':'Dining'}`:latestOrder?.status||'Ready for guests'}</b><small>{session?`${sessionOrders.length} order round${sessionOrders.length===1?'':'s'}${latestOrder?` · latest ${latestOrder.status}`:''}`:latestOrder?`${latestOrder.items.reduce((sum,line)=>sum+line.quantity,0)} items · ₹${latestOrder.total}`:'No active guest session'}</small><div className="owner-table-buttons"><button onClick={()=>copy(link)}><Copy size={13}/> Copy table link</button><Link href={`/r/${restaurant.slug||restaurant.id}/table/${Number(table)}`} target="_blank"><QrCode size={13}/> Open QR menu</Link></div></div>{session&&<Link className="table-bill-link" href="/restaurant/bills">Open bill</Link>}</article>;
 })}</div><form className="add-tables-form" onSubmit={async event=>{event.preventDefault();setAdding(true);setMessage('');try{await addTables(restaurant.id,extraTables);setMessage(`${extraTables} table QR${extraTables===1?'':'s'} added.`)}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not add tables.')}finally{setAdding(false)}}}><div><b>Add more tables</b><small>New table links are created immediately and will appear here for QR printing.</small></div><label>Number<input type="number" min={1} max={100} value={extraTables} onChange={event=>setExtraTables(Math.max(1,Math.min(100,Number(event.target.value))))}/></label><button className="button button-dark" disabled={adding}>{adding?'Adding…':'Create table QR links'}</button>{message&&<span role="status">{message}</span>}</form></>;
}
export default function RestaurantTables(){return <OwnerShell active="Tables"><TablesContent/></OwnerShell>}
