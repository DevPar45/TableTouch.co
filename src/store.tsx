'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { BillLine, Category, DiningSession, MenuItem, Restaurant, TableOrder } from './data';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type Store = {
  restaurants: Restaurant[]; orders: TableOrder[]; diningSessions: DiningSession[];
  sessionRestaurantId: string | null; hydrated: boolean; configured: boolean; error: string;
  setSession: (id: string | null) => void; signOut: () => Promise<void>; refresh: () => Promise<void>; clearError: () => void;
  saveRestaurant: (restaurant: Restaurant) => Promise<void>; updateRestaurant: (id: string, update: Partial<Restaurant>) => Promise<void>;
  updateOrder: (id: string, status: TableOrder['status']) => Promise<void>;
  startDiningSession: (slug: string, tableNumber: string, tableToken: string, guestName: string) => Promise<DiningSession>;
  resumeDiningSession: (slug: string, tableNumber: string) => Promise<DiningSession | null>;
  placeGuestOrder: (session: DiningSession, items: { itemId: string; quantity: number }[], note?: string) => Promise<TableOrder>;
  requestGuestBill: (session: DiningSession) => Promise<DiningSession>;
  placeStaffOrder: (input: { restaurant: Restaurant; tableNumber: string; guestName: string; source: 'POS'|'Waiter'|'Counter'; sessionId?: string; items: {itemId:string;quantity:number}[]; note?: string; idempotencyKey:string }) => Promise<void>;
  prepareBill: (sessionId: string) => Promise<void>; replaceBillLines: (sessionId: string, lines: BillLine[]) => Promise<void>;
  finalizeBill: (sessionId: string) => Promise<void>; reopenBill: (sessionId: string) => Promise<void>;
  saveMenuItem: (restaurantId: string, item: MenuItem) => Promise<void>; saveMenuCategory: (restaurantId: string, category: Category) => Promise<void>;
  addTables: (restaurantId: string, count: number) => Promise<void>;
};

type Row = Record<string, any>;
const Ctx = createContext<Store | null>(null);
const orderStatus: Record<string, TableOrder['status']> = { new:'New', accepted:'Accepted', preparing:'Preparing', ready:'Ready', served:'Served', completed:'Completed', cancelled:'Cancelled' };
const dbStatus = (status: TableOrder['status']) => status.toLowerCase();
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const tableText = (value: string|number) => String(value).padStart(2,'0');
const keyFor = (slug: string, table: string) => `tabletouch:session:${slug}:${tableText(table)}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function mapItem(row: Row): MenuItem {
  return { id:row.id, name:row.name, description:row.description||'', price:Number(row.price), category:row.category_id||'', image:row.image_url||'', veg:Boolean(row.is_vegetarian), bestseller:Boolean(row.is_bestseller), available:Boolean(row.is_available), tags:row.tags||[], prepMinutes:row.prep_minutes||undefined, ingredients:row.ingredients||[], allergens:row.allergens||[], spiceLevel:row.spice_level||undefined, chefRecommendation:Boolean(row.chef_recommendation), searchKeywords:row.search_keywords||[] };
}

function mapRestaurant(row: Row, categories: Category[], items: {restaurantId:string;item:MenuItem}[], tables: Row[]): Restaurant {
  const logo = row.logo_url ? '' : initials(row.name||'');
  const activeTables = tables.filter(table=>table.restaurant_id===row.id&&table.is_active);
  return { id:row.id, slug:row.slug, name:row.name, logo, primaryColor:row.primary_color||'#4b111b', secondaryColor:row.accent_color||'#bc9b62', coverImage:row.cover_url||'', description:row.description||'', address:row.address||'', phone:row.phone||'', instagram:row.instagram||'', hours:row.hours||'Hours not set', taxRate:Number(row.tax_rate||0), serviceChargeRate:Number(row.service_charge_rate||0), serviceChargeLabel:row.service_charge_label||'Service charge', tableCount:activeTables.length, tableNumbers:activeTables.map(table=>table.table_number).sort(), tableTokens:Object.fromEntries(activeTables.filter(table=>table.public_token).map(table=>[table.table_number,table.public_token])), categories:categories.filter(category=>category.restaurantId===row.id).map(category=>({id:category.id,name:category.name})), menuItems:items.filter(item=>item.restaurantId===row.id).map(item=>item.item), ownerEmail:row.owner_email||'', approvalStatus:row.approval_status, registrationStatus:row.service_status, registeredAt:row.created_at, fssaiNumber:row.fssai_number||'', gstNumber:row.gst_number||'', ownerName:row.owner_name||'' };
}

function toRowRestaurant(restaurant: Restaurant) {
  return { tax_rate:restaurant.taxRate, service_charge_rate:restaurant.serviceChargeRate||0, service_charge_label:restaurant.serviceChargeLabel||'Service charge', service_status:restaurant.registrationStatus||'offline' };
}

function getTableOrder(row: Row, tableLookup: Map<string,string>): TableOrder {
  const source = row.order_source||'QR/NFC';
  const tableNumber = source==='Counter'?'COUNTER':tableLookup.get(row.table_id)||'01';
  const items = (row.order_items||[]).map((item: Row)=>({ itemId:item.menu_item_id||item.id, name:item.item_name, price:Number(item.unit_price), quantity:Number(item.quantity) }));
  return { id:row.id, restaurantId:row.restaurant_id, tableNumber, diningSessionId:row.dining_session_id||undefined, guestName:row.guest_name||undefined, source, items, subtotal:Number(row.subtotal), tax:Number(row.tax), total:Number(row.total), status:orderStatus[row.status]||'New', placedAt:row.created_at, note:row.guest_note||undefined, trackingToken:row.tracking_token };
}

function getDiningSession(row: Row, tables: Map<string,string>, billLines: Row[] = []): DiningSession {
  return { id:row.id, restaurantId:row.restaurant_id, tableNumber:tables.get(row.table_id)||'01', guestName:row.guest_name, status:row.status, startedAt:row.started_at, billRequestedAt:row.bill_requested_at||undefined, closedAt:row.closed_at||undefined, billLines:billLines.filter(line=>line.dining_session_id===row.id).map(line=>({id:line.id,itemId:line.source_order_item_id||undefined,orderId:line.source_order_id||undefined,name:line.item_name,price:Number(line.unit_price),quantity:Number(line.quantity),kind:line.line_kind})), taxRateSnapshot:row.tax_rate_snapshot==null?undefined:Number(row.tax_rate_snapshot), serviceChargeRateSnapshot:row.service_charge_rate_snapshot==null?undefined:Number(row.service_charge_rate_snapshot), serviceChargeLabelSnapshot:row.service_charge_label_snapshot||undefined, billSubtotal:row.bill_subtotal==null?undefined:Number(row.bill_subtotal), serviceChargeAmount:row.service_charge_amount==null?undefined:Number(row.service_charge_amount), taxAmount:row.tax_amount==null?undefined:Number(row.tax_amount), billTotal:row.bill_total==null?undefined:Number(row.bill_total) };
}

async function unwrap<T>(promise: PromiseLike<{data:T|null;error:any}>): Promise<T> {
  const {data,error}=await promise;
  if(error) throw error;
  return data as T;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [restaurants,setRestaurants]=useState<Restaurant[]>([]);
  const [orders,setOrders]=useState<TableOrder[]>([]);
  const [diningSessions,setDiningSessions]=useState<DiningSession[]>([]);
  const [sessionRestaurantId,setSessionRestaurantId]=useState<string|null>(null);
  const [hydrated,setHydrated]=useState(false);
  const [error,setError]=useState('');
  const client=getSupabaseBrowserClient();

  const refresh=useCallback(async()=>{
    if(!client){setRestaurants([]);setOrders([]);setDiningSessions([]);setHydrated(true);return;}
    try {
      const {data:userData}=await client.auth.getUser();
      const memberRows:Row[]=userData.user ? await unwrap(client.from('restaurant_members').select('restaurant_id,role').eq('user_id',userData.user.id)) : [];
      const memberIds=Array.from(new Set(memberRows.map(row=>row.restaurant_id)));
      const [publicRows,ownedRows]=await Promise.all([
        unwrap(client.from('public_restaurant_profiles').select('*')),
        memberIds.length ? unwrap(client.from('restaurants').select('*').in('id',memberIds)) : Promise.resolve([] as Row[]),
      ]);
      const byId=new Map<string,Row>();[...(publicRows||[]),...(ownedRows||[])].forEach((row:Row)=>byId.set(row.id,row));const restaurantRows=Array.from(byId.values());
      const allIds=restaurantRows.map(row=>row.id);
      const [categoryRows,itemRows,tableRows]=allIds.length ? await Promise.all([
        unwrap(client.from('menu_categories').select('*').in('restaurant_id',allIds).eq('is_active',true).order('sort_order')),
        unwrap(client.from('menu_items').select('*').in('restaurant_id',allIds).order('sort_order')),
        unwrap(client.from('active_public_tables').select('slug,table_number,is_active')),
      ]) : [[],[],[]] as Row[][];
      const tableRowsForMap:Row[]=tableRows.filter((row:Row)=>!memberIds.includes(restaurantRows.find(rest=>rest.slug===row.slug)?.id||'')).map((row:Row)=>({ ...row, restaurant_id:restaurantRows.find(rest=>rest.slug===row.slug)?.id, is_active:row.is_active }));
      if(memberIds.length){
        const privateTables:Row[]=await unwrap(client.from('restaurant_tables').select('*').in('restaurant_id',memberIds));
        for(const table of privateTables) if(!tableRowsForMap.some(existing=>existing.restaurant_id===table.restaurant_id&&existing.table_number===table.table_number)) tableRowsForMap.push(table);
      }
      const categories=(categoryRows as Row[]).map(row=>({id:row.id,name:row.name,restaurantId:row.restaurant_id} as Category & {restaurantId:string}));
      const items=(itemRows as Row[]).map(row=>({restaurantId:row.restaurant_id,item:mapItem(row)}));
      const nextRestaurants=restaurantRows.map(row=>mapRestaurant(row,categories as Category[],items,tableRowsForMap));
      setRestaurants(nextRestaurants);
      if(sessionRestaurantId&&!memberIds.includes(sessionRestaurantId)) setSessionRestaurantId(null);
      else if(!sessionRestaurantId&&memberIds.length) setSessionRestaurantId(memberIds[0]);

      if(memberIds.length){
        const [orderRows,sessionRows,billRows]:Row[][]=await Promise.all([
          unwrap(client.from('orders').select('*,order_items(*)').in('restaurant_id',memberIds).order('created_at',{ascending:false}).limit(500)),
          unwrap(client.from('dining_sessions').select('*').in('restaurant_id',memberIds).order('started_at',{ascending:false}).limit(500)),
          unwrap(client.from('dining_session_items').select('*').in('restaurant_id',memberIds).order('created_at')),
        ]);
        const tableMap=new Map(tableRowsForMap.map((row:Row)=>[row.id,row.table_number]));
        setOrders(orderRows.map(row=>getTableOrder(row,tableMap)));
        setDiningSessions(sessionRows.map(row=>getDiningSession(row,tableMap,billRows)));
      } else {setOrders([]);setDiningSessions([]);}
    } catch (issue) { setError(errorText(issue)); }
    finally { setHydrated(true); }
  },[client,sessionRestaurantId]);

  useEffect(()=>{
    if(!client){setHydrated(true);return;}
    void refresh();
    const {data:{subscription}}=client.auth.onAuthStateChange(()=>{window.setTimeout(()=>void refresh(),0);});
    return ()=>subscription.unsubscribe();
  },[client,refresh]);

  useEffect(()=>{
    if(!client)return;
    const ids=restaurants.filter(r=>r.ownerEmail).map(r=>r.id);
    if(!ids.length)return;
    const channel=client.channel(`tabletouch-live-${ids.join('-')}`);
    ids.forEach(id=>{
      channel.on('postgres_changes',{event:'*',schema:'public',table:'orders',filter:`restaurant_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'order_items',filter:`restaurant_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'dining_sessions',filter:`restaurant_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'restaurant_tables',filter:`restaurant_id=eq.${id}`},()=>void refresh());
    });
    channel.subscribe();
    return ()=>{void client.removeChannel(channel);};
  },[client,restaurants,refresh]);

  const run=useCallback(async(task:()=>Promise<void>)=>{try{await task();setError('');}catch(issue){setError(errorText(issue));throw issue;}},[]);

  const value=useMemo<Store>(()=>({
    restaurants,orders,diningSessions,sessionRestaurantId,hydrated,configured:isSupabaseConfigured(),error,
    setSession:setSessionRestaurantId,refresh,clearError:()=>setError(''),
    signOut:async()=>{if(!client)return;await client.auth.signOut();setRestaurants([]);setOrders([]);setDiningSessions([]);setSessionRestaurantId(null);},
    saveRestaurant:async(restaurant)=>run(async()=>{if(!client)throw new Error('Connect Supabase to save restaurant settings.');await unwrap(client.from('restaurants').update(toRowRestaurant(restaurant)).eq('id',restaurant.id));await refresh();}),
    updateRestaurant:async(id,update)=>run(async()=>{if(!client)throw new Error('Connect Supabase to update restaurant status.');const payload:Row={};if(update.registrationStatus)payload.service_status=update.registrationStatus;if(update.taxRate!==undefined)payload.tax_rate=update.taxRate;if(update.serviceChargeRate!==undefined)payload.service_charge_rate=update.serviceChargeRate;if(update.serviceChargeLabel!==undefined)payload.service_charge_label=update.serviceChargeLabel;await unwrap(client.from('restaurants').update(payload).eq('id',id));await refresh();}),
    updateOrder:async(id,status)=>run(async()=>{if(!client)throw new Error('Connect Supabase to update orders.');await unwrap(client.from('orders').update({status:dbStatus(status)}).eq('id',id));await refresh();}),
    startDiningSession:async(slug,tableNumber,tableToken,guestName)=>{
      if(!client)throw new Error('Table ordering is unavailable until Supabase is configured.');
      if(!tableToken)throw new Error('Use the QR code at your table to start ordering.');
      const startAttemptKey=`${keyFor(slug,tableNumber)}:start-attempt`;let prior:{token:string;guestName:string}|null=null;try{prior=JSON.parse(sessionStorage.getItem(startAttemptKey)||'null')}catch{}
      const token=prior?.guestName===guestName.trim()?prior.token:crypto.randomUUID();sessionStorage.setItem(startAttemptKey,JSON.stringify({token,guestName:guestName.trim()}));
      const sessionId=await unwrap(client.rpc('start_dining_session',{p_restaurant_slug:slug,p_table_number:tableText(tableNumber),p_table_token:tableToken,p_session_token:token,p_guest_name:guestName.trim()}));
      sessionStorage.setItem(keyFor(slug,tableNumber),JSON.stringify({id:sessionId,token}));
      sessionStorage.removeItem(startAttemptKey);
      return await readGuestSession(client,slug,tableNumber,sessionId,token,restaurants);
    },
    resumeDiningSession:async(slug,tableNumber)=>{
      if(!client)return null;
      const stored=sessionStorage.getItem(keyFor(slug,tableNumber));if(!stored)return null;
      try{const {id,token}=JSON.parse(stored);return await readGuestSession(client,slug,tableNumber,id,token,restaurants);}catch{return null;}
    },
    placeGuestOrder:async(session,items,note)=>{
      if(!client)throw new Error('Table ordering is unavailable until Supabase is configured.');
      const restaurant=restaurants.find(row=>row.id===session.restaurantId);if(!restaurant?.slug)throw new Error('Restaurant menu is unavailable.');
      const stored=sessionStorage.getItem(keyFor(restaurant.slug,session.tableNumber));if(!stored)throw new Error('Your table session expired. Please start again.');
      const {token}=JSON.parse(stored);
      const orderAttemptKey=`${keyFor(restaurant.slug,session.tableNumber)}:order-attempt`;const idempotencyKey=sessionStorage.getItem(orderAttemptKey)||crypto.randomUUID();sessionStorage.setItem(orderAttemptKey,idempotencyKey);
      const result=await unwrap(client.rpc('place_dining_session_order',{p_session_id:session.id,p_session_token:token,p_items:items.map(line=>({item_id:line.itemId,quantity:line.quantity})),p_idempotency_key:idempotencyKey,p_guest_note:note||''}));
      sessionStorage.removeItem(orderAttemptKey);
      const row=Array.isArray(result)?result[0]:result;
      const lineItems=items.map(line=>{const item=restaurant.menuItems.find(menu=>menu.id===line.itemId);return {itemId:line.itemId,name:item?.name||'Menu item',price:item?.price||0,quantity:line.quantity};});
      return {id:row.order_id,trackingToken:row.tracking_token,diningSessionId:session.id,guestName:session.guestName,restaurantId:restaurant.id,tableNumber:tableText(session.tableNumber),source:'QR/NFC',items:lineItems,subtotal:lineItems.reduce((sum,line)=>sum+line.price*line.quantity,0),tax:0,total:Number(row.order_total),status:'New',placedAt:new Date().toISOString(),note} as TableOrder;
    },
    requestGuestBill:async(session)=>{
      if(!client)throw new Error('Table service is unavailable until Supabase is configured.');
      const restaurant=restaurants.find(row=>row.id===session.restaurantId);if(!restaurant?.slug)throw new Error('Restaurant menu is unavailable.');
      const stored=sessionStorage.getItem(keyFor(restaurant.slug,session.tableNumber));if(!stored)throw new Error('Your table session expired. Please ask a server for your bill.');
      const {token}=JSON.parse(stored);await unwrap(client.rpc('request_dining_bill',{p_session_id:session.id,p_session_token:token}));
      return await readGuestSession(client,restaurant.slug,session.tableNumber,session.id,token,restaurants);
    },
    placeStaffOrder:async(input)=>run(async()=>{
      if(!client)throw new Error('Connect Supabase before entering staff orders.');
      await unwrap(client.rpc('place_staff_order',{p_restaurant_id:input.restaurant.id,p_table_number:input.tableNumber,p_guest_name:input.guestName,p_items:input.items.map(line=>({item_id:line.itemId,quantity:line.quantity})),p_idempotency_key:input.idempotencyKey,p_source:input.source,p_session_id:input.sessionId||null,p_guest_note:input.note||''}));await refresh();
    }),
    prepareBill:async(sessionId)=>run(async()=>{if(!client)throw new Error('Connect Supabase before preparing bills.');await unwrap(client.rpc('prepare_dining_bill',{p_session_id:sessionId}));await refresh();}),
    replaceBillLines:async(sessionId,lines)=>run(async()=>{if(!client)throw new Error('Connect Supabase before editing bills.');await unwrap(client.rpc('replace_dining_bill_items',{p_session_id:sessionId,p_lines:lines.map(line=>({name:line.name,price:line.price,quantity:line.quantity,kind:line.kind}))}));await refresh();}),
    finalizeBill:async(sessionId)=>run(async()=>{if(!client)throw new Error('Connect Supabase before closing bills.');await unwrap(client.rpc('finalize_dining_bill',{p_session_id:sessionId}));await refresh();}),
    reopenBill:async(sessionId)=>run(async()=>{if(!client)throw new Error('Connect Supabase before reopening bills.');await unwrap(client.rpc('reopen_dining_session',{p_session_id:sessionId}));await refresh();}),
    saveMenuItem:async(restaurantId,item)=>run(async()=>{
      if(!client)throw new Error('Connect Supabase before editing the menu.');
      const payload={restaurant_id:restaurantId,category_id:item.category||null,name:item.name.trim(),description:item.description.trim(),price:item.price,image_url:item.image||null,is_vegetarian:item.veg,is_available:item.available,is_bestseller:item.bestseller,tags:item.tags||[],prep_minutes:item.prepMinutes||null,ingredients:item.ingredients||[],allergens:item.allergens||[],spice_level:item.spiceLevel||null,chef_recommendation:item.chefRecommendation||false,search_keywords:item.searchKeywords||[]};
      if(item.id&&item.id.length>20)await unwrap(client.from('menu_items').update(payload).eq('id',item.id).eq('restaurant_id',restaurantId));else await unwrap(client.from('menu_items').insert(payload));await refresh();
    }),
    saveMenuCategory:async(restaurantId,category)=>run(async()=>{if(!client)throw new Error('Connect Supabase before editing categories.');if(category.id&&category.id.length>20)await unwrap(client.from('menu_categories').update({name:category.name.trim()}).eq('id',category.id).eq('restaurant_id',restaurantId));else await unwrap(client.from('menu_categories').insert({restaurant_id:restaurantId,name:category.name.trim(),sort_order:restaurants.find(row=>row.id===restaurantId)?.categories.length||0}));await refresh();}),
    addTables:async(restaurantId,count)=>run(async()=>{if(!client)throw new Error('Connect Supabase before managing tables.');const restaurant=restaurants.find(row=>row.id===restaurantId);if(!restaurant)throw new Error('Restaurant unavailable.');const branches:Row[]=await unwrap(client.from('branches').select('id').eq('restaurant_id',restaurantId).order('created_at').limit(1));if(!branches[0])throw new Error('Restaurant branch is missing.');const existing=new Set(restaurant.tableNumbers||[]);const max=Math.max(0,...Array.from(existing).map(Number));const rows=Array.from({length:Math.min(100,Math.max(0,count))},(_,index)=>({restaurant_id:restaurantId,branch_id:branches[0].id,table_number:tableText(max+index+1)}));if(rows.length)await unwrap(client.from('restaurant_tables').insert(rows));await refresh();}),
  }),[restaurants,orders,diningSessions,sessionRestaurantId,hydrated,error,client,refresh,run]);

  return <Ctx.Provider value={value}>{children}{error&&<div role="alert" className="store-error-toast"><span>{error}</span><button onClick={()=>setError('')} aria-label="Dismiss message">×</button></div>}</Ctx.Provider>;
}

async function readGuestSession(client: SupabaseClient,slug:string,table:string,id:string,token:string,restaurants:Restaurant[]):Promise<DiningSession>{
  const data:Row=await unwrap(client.rpc('get_dining_session',{p_session_id:id,p_session_token:token}));
  const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('Table session not found.');
  const restaurant=restaurants.find(item=>item.slug===slug);if(!restaurant)throw new Error('Restaurant menu is not available.');
  const guestOrders:TableOrder[]=(row.orders||[]).map((order:Row)=>({id:order.id,restaurantId:restaurant.id,tableNumber:row.table_number,diningSessionId:id,guestName:row.guest_name,source:'QR/NFC',items:(order.items||[]).map((item:Row)=>({itemId:item.item_id||'',name:item.name,price:Number(item.price),quantity:Number(item.quantity)})),subtotal:Number(order.subtotal),tax:0,total:Number(order.total),status:orderStatus[order.status]||'New',placedAt:order.created_at}));
  return {id,restaurantId:restaurant.id,tableNumber:tableText(row.table_number||table),guestName:row.guest_name,status:row.status,startedAt:row.started_at,billRequestedAt:row.bill_requested_at||undefined,billLines:[],orders:guestOrders};
}

export function useStore(){const value=useContext(Ctx);if(!value)throw new Error('StoreProvider missing');return value;}
