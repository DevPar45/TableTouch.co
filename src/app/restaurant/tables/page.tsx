'use client';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Power, QrCode, RefreshCw } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { useStore } from '@/store';
import { useState } from 'react';

function TablesContent(){
 const {restaurants,sessionRestaurantId,orders,diningSessions,addTables,rotateTableToken,setTableActive}=useStore();
 const [extraTables,setExtraTables]=useState(1);const [adding,setAdding]=useState(false);const [message,setMessage]=useState('');const [workingTable,setWorkingTable]=useState<string|null>(null);
 const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 if(!restaurant)return null;
 const tables=restaurant.tableDetails?.length?restaurant.tableDetails:Array.from({length:restaurant.tableCount||8},(_,index)=>({tableNumber:String(index+1).padStart(2,'0'),isActive:true,publicToken:restaurant.tableTokens?.[String(index+1).padStart(2,'0')]}));
 const copy=(text:string)=>navigator.clipboard?.writeText(text);
 const rotate=async(tableNumber:string)=>{if(!window.confirm(`Rotate the QR and NFC capability for table ${tableNumber}? Existing printed tags will stop accepting new guest sessions.`))return;setWorkingTable(`rotate-${tableNumber}`);setMessage('');try{await rotateTableToken(restaurant.id,tableNumber);setMessage(`Table ${tableNumber} has a new QR and NFC link. Replace its physical tag.`)}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not rotate this table link.')}finally{setWorkingTable(null)}};
 const toggleTable=async(tableNumber:string,isActive:boolean)=>{setWorkingTable(`status-${tableNumber}`);setMessage('');try{await setTableActive(restaurant.id,tableNumber,!isActive);setMessage(isActive?`Table ${tableNumber} is paused. Its QR and NFC tag no longer starts new sessions.`:`Table ${tableNumber} is active again. Its existing QR and NFC tag works.`)}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not update this table.')}finally{setWorkingTable(null)}};
 return <><div className="owner-page-heading"><div><span className="eyebrow"><span/> EVERY TABLE CONNECTED</span><h1>Your tables</h1><p>Each permanent restaurant/table route works with a QR code or an NFC tag. Pause or rotate a capability if a physical tag is lost.</p></div></div><div className="owner-table-list">{tables.map(table=>{
  const session=diningSessions.find(item=>item.restaurantId===restaurant.id&&item.tableNumber===table.tableNumber&&item.status!=='closed');
  const sessionOrders=session?orders.filter(item=>item.diningSessionId===session.id&&item.status!=='Cancelled'):[];
  const latestOrder=sessionOrders[0];
 const tableToken=table.publicToken||restaurant.tableTokens?.[table.tableNumber]||'';
 const path=`/r/${restaurant.slug||restaurant.id}/table/${Number(table.tableNumber)}${tableToken?`?table_token=${encodeURIComponent(tableToken)}`:''}`;
 const link=typeof window!=='undefined'?`${window.location.origin}${path}`:path;
  return <article id={`table-${table.tableNumber}`} className={`owner-table-card ${table.isActive?'':'is-paused'}`} key={table.tableNumber}><div className="owner-table-qr"><QRCodeSVG value={link} size={82} level="M" fgColor={restaurant.primaryColor}/></div><div className="owner-table-info"><span className="eyebrow"><span/> TABLE {table.tableNumber}</span><b>{!table.isActive?'Table paused':session?`${session.guestName} · ${session.status==='bill_requested'?'Bill requested':'Dining'}`:latestOrder?.status||'Ready for guests'}</b><small>{!table.isActive?'New QR and NFC sessions are disabled until this table is resumed.':session?`${sessionOrders.length} order round${sessionOrders.length===1?'':'s'}${latestOrder?` · latest ${latestOrder.status}`:''}`:latestOrder?`${latestOrder.items.reduce((sum,line)=>sum+line.quantity,0)} items · ₹${latestOrder.total}`:'No active guest session'}</small><div className="owner-table-buttons"><button onClick={()=>copy(link)}><Copy size={13}/> Copy table link</button>{table.isActive&&<Link href={path} target="_blank"><QrCode size={13}/> Open QR menu</Link>}<button disabled={workingTable!==null} onClick={()=>void rotate(table.tableNumber)}><RefreshCw size={13}/> {workingTable===`rotate-${table.tableNumber}`?'Rotating…':'Rotate QR/NFC'}</button><button disabled={workingTable!==null} onClick={()=>void toggleTable(table.tableNumber,table.isActive)}><Power size={13}/> {workingTable===`status-${table.tableNumber}`?'Saving…':table.isActive?'Pause table':'Resume table'}</button></div></div>{session&&<Link className="table-bill-link" href="/restaurant/bills">Open bill</Link>}</article>;
 })}</div><form className="add-tables-form" onSubmit={async event=>{event.preventDefault();setAdding(true);setMessage('');try{await addTables(restaurant.id,extraTables);setMessage(`${extraTables} table QR${extraTables===1?'':'s'} added.`)}catch(issue){setMessage(issue instanceof Error?issue.message:'Could not add tables.')}finally{setAdding(false)}}}><div><b>Add more tables</b><small>New table links are created immediately and will appear here for QR printing.</small></div><label>Number<input type="number" min={1} max={100} value={extraTables} onChange={event=>setExtraTables(Math.max(1,Math.min(100,Number(event.target.value))))}/></label><button className="button button-dark" disabled={adding}>{adding?'Adding…':'Create table QR links'}</button>{message&&<span role="status">{message}</span>}</form></>;
}
export default function RestaurantTables(){return <OwnerShell active="Tables"><TablesContent/></OwnerShell>}
