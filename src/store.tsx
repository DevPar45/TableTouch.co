'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { BillLine, Category, DiningSession, HotelRoomServiceOrder, HotelServiceRequest, MenuItem, Restaurant, TableOrder, TableServiceRequest } from './data';
import { getSupabaseBrowserClient, isSupabaseConfigured } from './lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

type Store = {
  restaurants: Restaurant[]; orders: TableOrder[]; diningSessions: DiningSession[]; serviceRequests: TableServiceRequest[]; hotelServiceRequests: HotelServiceRequest[]; hotelRoomServiceOrders: HotelRoomServiceOrder[];
  sessionRestaurantId: string | null; hydrated: boolean; configured: boolean; error: string;
  setSession: (id: string | null) => void; signOut: () => Promise<void>; refresh: () => Promise<void>; clearError: () => void;
  saveRestaurant: (restaurant: Restaurant) => Promise<void>; updateRestaurant: (id: string, update: Partial<Restaurant>) => Promise<void>;
  updateOrder: (id: string, status: TableOrder['status']) => Promise<void>;
  startDiningSession: (slug: string, tableNumber: string, tableToken: string, guestName: string) => Promise<DiningSession>;
  resumeDiningSession: (slug: string, tableNumber: string) => Promise<DiningSession | null>;
  placeGuestOrder: (session: DiningSession, items: { itemId: string; quantity: number }[], note?: string) => Promise<TableOrder>;
  requestGuestBill: (session: DiningSession) => Promise<DiningSession>;
  requestTableService: (session: DiningSession, type: TableServiceRequest['type'], note?: string) => Promise<void>;
  updateTableServiceRequest: (id: string, status: Extract<TableServiceRequest['status'],'acknowledged'|'resolved'|'cancelled'>) => Promise<void>;
  requestHotelService: (input: { hotelSlug: string; roomNumber: string; roomToken: string; type: HotelServiceRequest['type']; note?: string }) => Promise<{ trackingToken: string; status: HotelServiceRequest['status'] }>;
  updateHotelServiceRequest: (id: string, status: Extract<HotelServiceRequest['status'],'acknowledged'|'in_progress'|'completed'|'cancelled'>) => Promise<void>;
  placeHotelRoomServiceOrder: (input: { hotelSlug: string; roomNumber: string; roomToken: string; items: { itemId: string; quantity: number }[]; note?: string }) => Promise<{ trackingToken: string; total: number }>;
  updateHotelRoomServiceOrder: (id: string, status: Extract<HotelRoomServiceOrder['status'],'accepted'|'preparing'|'ready'|'delivered'|'cancelled'>) => Promise<void>;
  placeStaffOrder: (input: { restaurant: Restaurant; tableNumber: string; guestName: string; source: 'POS'|'Waiter'|'Counter'; sessionId?: string; items: {itemId:string;quantity:number}[]; note?: string; idempotencyKey:string }) => Promise<void>;
  prepareBill: (sessionId: string) => Promise<void>; replaceBillLines: (sessionId: string, lines: BillLine[]) => Promise<void>;
  finalizeBill: (sessionId: string) => Promise<void>; reopenBill: (sessionId: string) => Promise<void>;
  saveMenuItem: (restaurantId: string, item: MenuItem) => Promise<void>; saveMenuCategory: (restaurantId: string, category: Category) => Promise<void>;
  addTables: (restaurantId: string, count: number) => Promise<void>;
  addHotelRooms: (hotelId: string, count: number) => Promise<void>;
  rotateTableToken: (restaurantId: string, tableNumber: string) => Promise<void>;
  setTableActive: (restaurantId: string, tableNumber: string, isActive: boolean) => Promise<void>;
  rotateHotelRoomToken: (hotelId: string, roomNumber: string) => Promise<void>;
  setHotelRoomActive: (hotelId: string, roomNumber: string, isActive: boolean) => Promise<void>;
};

type Row = Record<string, any>;
const Ctx = createContext<Store | null>(null);
const orderStatus: Record<string, TableOrder['status']> = { new:'New', accepted:'Accepted', preparing:'Preparing', ready:'Ready', served:'Served', completed:'Completed', cancelled:'Cancelled' };
const dbStatus = (status: TableOrder['status']) => status.toLowerCase();
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const tableText = (value: string|number) => String(value).padStart(2,'0');
const keyFor = (slug: string, table: string) => `tabletouch:session:${slug}:${tableText(table)}`;
const hotelRequestKeyFor = (slug: string, room: string, type: HotelServiceRequest['type']) => `tabletouch:hotel-request:${slug}:${room}:${type}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function getPublicRestaurantSlug(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'r') return segments[1] || null;
  if (segments[0] === 'menu') return segments[1] || null;
  return null;
}

function getPublicHotelSlug(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments[0] === 'hotel' ? segments[1] || null : null;
}

function mapItem(row: Row): MenuItem {
  return { id:row.id, name:row.name, description:row.description||'', price:Number(row.price), category:row.category_id||'', image:row.image_url||'', veg:Boolean(row.is_vegetarian), bestseller:Boolean(row.is_bestseller), available:Boolean(row.is_available), tags:row.tags||[], prepMinutes:row.prep_minutes||undefined, ingredients:row.ingredients||[], allergens:row.allergens||[], spiceLevel:row.spice_level||undefined, chefRecommendation:Boolean(row.chef_recommendation), searchKeywords:row.search_keywords||[] };
}

function mapRestaurant(row: Row, categories: Category[], items: {restaurantId:string;item:MenuItem}[], tables: Row[], rooms: Row[], roles: Map<string,Restaurant['memberRole']>): Restaurant {
  const logo = row.logo_url ? '' : initials(row.name||'');
  const activeTables = tables.filter(table=>table.restaurant_id===row.id&&table.is_active);
  const activeRooms=rooms.filter(room=>room.hotel_id===row.id&&room.is_active&&!room.archived_at);
  return { id:row.id, businessType:row.business_type||'restaurant', slug:row.slug, name:row.name, logo, logoUrl:row.logo_url||'', primaryColor:row.primary_color||'#4b111b', secondaryColor:row.accent_color||'#bc9b62', coverImage:row.cover_url||'', description:row.description||'', address:row.address||'', phone:row.phone||'', instagram:row.instagram||'', hours:row.hours||'Hours not set', taxRate:Number(row.tax_rate||0), serviceChargeRate:Number(row.service_charge_rate||0), serviceChargeLabel:row.service_charge_label||'Service charge', tableCount:activeTables.length, tableNumbers:activeTables.map(table=>table.table_number).sort(), tableTokens:Object.fromEntries(activeTables.filter(table=>table.public_token).map(table=>[table.table_number,table.public_token])), tableDetails:tables.filter(table=>table.restaurant_id===row.id).map(table=>({tableNumber:table.table_number,isActive:Boolean(table.is_active),publicToken:table.public_token||undefined})).sort((a,b)=>a.tableNumber.localeCompare(b.tableNumber,undefined,{numeric:true})), roomCount:activeRooms.length, roomDetails:rooms.filter(room=>room.hotel_id===row.id).map(room=>({roomNumber:room.room_number,roomType:room.room_type||'',floorLabel:room.floor_label||'',isActive:Boolean(room.is_active),roomServiceEnabled:Boolean(room.room_service_enabled),housekeepingStatus:room.housekeeping_status||'clean',publicToken:room.public_token||undefined})).sort((a,b)=>a.roomNumber.localeCompare(b.roomNumber,undefined,{numeric:true})), currencyCode:row.currency_code||'INR',timeZone:row.time_zone||'Asia/Kolkata',welcomeMessage:row.welcome_message||'',roomServiceEnabled:Boolean(row.room_service_enabled),categories:categories.filter(category=>category.restaurantId===row.id).map(category=>({id:category.id,name:category.name})), menuItems:items.filter(item=>item.restaurantId===row.id).map(item=>item.item), ownerEmail:row.owner_email||'', memberRole:roles.get(row.id), approvalStatus:row.approval_status, registrationStatus:row.service_status, registeredAt:row.created_at, fssaiNumber:row.fssai_number||'', gstNumber:row.gst_number||'', ownerName:row.owner_name||'' };
}

function toRowRestaurant(restaurant: Restaurant) {
  return {
    name:restaurant.name.trim(),
    description:restaurant.description.trim(),
    logo_url:restaurant.logoUrl?.trim()||null,
    cover_url:restaurant.coverImage.trim()||null,
    primary_color:restaurant.primaryColor,
    accent_color:restaurant.secondaryColor,
    phone:restaurant.phone.trim(),
    address:restaurant.address.trim(),
    hours:restaurant.hours.trim(),
    instagram:restaurant.instagram.trim(),
    tax_rate:restaurant.taxRate,
    service_charge_rate:restaurant.serviceChargeRate||0,
    service_charge_label:restaurant.serviceChargeLabel||'Service charge',
    service_status:restaurant.registrationStatus||'offline',
  };
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

function getTableServiceRequest(row: Row, tables: Map<string,string>): TableServiceRequest {
  return {id:row.id,restaurantId:row.restaurant_id,tableNumber:tables.get(row.table_id)||'01',diningSessionId:row.dining_session_id,type:row.request_type,note:row.note||undefined,status:row.status,createdAt:row.created_at,acknowledgedAt:row.acknowledged_at||undefined,resolvedAt:row.resolved_at||undefined};
}

function getHotelServiceRequest(row: Row, rooms: Map<string,string>): HotelServiceRequest {
  return {id:row.id,hotelId:row.hotel_id,roomNumber:rooms.get(row.room_id)||'—',type:row.request_type,note:row.note||undefined,status:row.status,assignedTo:row.assigned_to||undefined,createdAt:row.created_at,acknowledgedAt:row.acknowledged_at||undefined,completedAt:row.completed_at||undefined};
}
function getHotelRoomServiceOrder(row: Row, rooms: Map<string,string>): HotelRoomServiceOrder {
  return {id:row.id,hotelId:row.hotel_id,roomNumber:rooms.get(row.room_id)||'—',items:(row.order_items||[]).map((item:Row)=>({itemId:item.menu_item_id||'',name:item.item_name,price:Number(item.unit_price),quantity:Number(item.quantity)})),subtotal:Number(row.subtotal),total:Number(row.total),note:row.guest_note||undefined,status:row.status,trackingToken:row.tracking_token,createdAt:row.created_at,acceptedAt:row.accepted_at||undefined,deliveredAt:row.delivered_at||undefined};
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
  const [serviceRequests,setServiceRequests]=useState<TableServiceRequest[]>([]);
  const [hotelServiceRequests,setHotelServiceRequests]=useState<HotelServiceRequest[]>([]);
  const [hotelRoomServiceOrders,setHotelRoomServiceOrders]=useState<HotelRoomServiceOrder[]>([]);
  const [sessionRestaurantId,setSessionRestaurantId]=useState<string|null>(null);
  const [hydrated,setHydrated]=useState(false);
  const [error,setError]=useState('');
  const client=getSupabaseBrowserClient();
  const pathname=usePathname();
  const publicRestaurantSlug=useMemo(()=>getPublicRestaurantSlug(pathname),[pathname]);
  const publicHotelSlug=useMemo(()=>getPublicHotelSlug(pathname),[pathname]);

  const refresh=useCallback(async()=>{
    if(!client){setRestaurants([]);setOrders([]);setDiningSessions([]);setServiceRequests([]);setHotelServiceRequests([]);setHotelRoomServiceOrders([]);setHydrated(true);return;}
    try {
      const {data:userData}=await client.auth.getUser();
      const memberRows:Row[]=userData.user ? await unwrap(client.from('restaurant_members').select('restaurant_id,role').eq('user_id',userData.user.id)) : [];
      const memberIds=Array.from(new Set(memberRows.map(row=>row.restaurant_id)));
      const roleByRestaurant=new Map<string,Restaurant['memberRole']>(memberRows.map(row=>[row.restaurant_id,row.role]));
      const [publicRestaurantRows,publicHotelRows,ownedRows]=await Promise.all([
        publicRestaurantSlug
          ? unwrap(client.from('public_restaurant_profiles').select('*').eq('slug',publicRestaurantSlug).limit(1))
          : Promise.resolve([] as Row[]),
        publicHotelSlug
          ? unwrap(client.from('public_hotel_profiles').select('*').eq('slug',publicHotelSlug).limit(1))
          : Promise.resolve([] as Row[]),
        memberIds.length ? unwrap(client.from('restaurants').select('*').in('id',memberIds)) : Promise.resolve([] as Row[]),
      ]);
      const byId=new Map<string,Row>();[...(publicRestaurantRows||[]),...(publicHotelRows||[]),...(ownedRows||[])].forEach((row:Row)=>byId.set(row.id,row));const restaurantRows=Array.from(byId.values());
      const allIds=restaurantRows.map(row=>row.id);
      const [categoryRows,itemRows,tableRows,publicRoomRows]=allIds.length ? await Promise.all([
        unwrap(client.from('menu_categories').select('*').in('restaurant_id',allIds).eq('is_active',true).order('sort_order')),
        unwrap(client.from('menu_items').select('*').in('restaurant_id',allIds).order('sort_order')),
        publicRestaurantSlug
          ? unwrap(client.from('active_public_tables').select('slug,table_number,is_active').eq('slug',publicRestaurantSlug))
          : Promise.resolve([] as Row[]),
        publicHotelSlug
          ? unwrap(client.from('active_public_hotel_rooms').select('slug,room_number,room_service_enabled').eq('slug',publicHotelSlug))
          : Promise.resolve([] as Row[]),
      ]) : [[],[],[],[]] as Row[][];
      const tableRowsForMap:Row[]=tableRows.filter((row:Row)=>!memberIds.includes(restaurantRows.find(rest=>rest.slug===row.slug)?.id||'')).map((row:Row)=>({ ...row, restaurant_id:restaurantRows.find(rest=>rest.slug===row.slug)?.id, is_active:row.is_active }));
      if(memberIds.length){
        const privateTables:Row[]=await unwrap(client.from('restaurant_tables').select('*').in('restaurant_id',memberIds));
        for(const table of privateTables) if(!tableRowsForMap.some(existing=>existing.restaurant_id===table.restaurant_id&&existing.table_number===table.table_number)) tableRowsForMap.push(table);
      }
      const roomRowsForMap:Row[]=(publicRoomRows as Row[]).filter(row=>!memberIds.includes(restaurantRows.find(rest=>rest.slug===row.slug)?.id||'')).map(row=>({...row,hotel_id:restaurantRows.find(rest=>rest.slug===row.slug)?.id,is_active:true,archived_at:null}));
      if(memberIds.length){const privateRooms:Row[]=await unwrap(client.from('hotel_rooms').select('*').in('hotel_id',memberIds));for(const room of privateRooms)if(!roomRowsForMap.some(existing=>existing.hotel_id===room.hotel_id&&existing.room_number===room.room_number))roomRowsForMap.push(room);}
      const categories=(categoryRows as Row[]).map(row=>({id:row.id,name:row.name,restaurantId:row.restaurant_id} as Category & {restaurantId:string}));
      const items=(itemRows as Row[]).map(row=>({restaurantId:row.restaurant_id,item:mapItem(row)}));
      const nextRestaurants=restaurantRows.map(row=>mapRestaurant(row,categories as Category[],items,tableRowsForMap,roomRowsForMap,roleByRestaurant));
      setRestaurants(nextRestaurants);
      if(sessionRestaurantId&&!memberIds.includes(sessionRestaurantId)) setSessionRestaurantId(null);
      else if(!sessionRestaurantId&&memberIds.length) setSessionRestaurantId(memberIds[0]);

      if(memberIds.length){
        const [orderRows,sessionRows,billRows,serviceRequestRows,hotelServiceRequestRows,hotelRoomOrderRows]:Row[][]=await Promise.all([
          unwrap(client.from('orders').select('*,order_items(*)').in('restaurant_id',memberIds).order('created_at',{ascending:false}).limit(500)),
          unwrap(client.from('dining_sessions').select('*').in('restaurant_id',memberIds).order('started_at',{ascending:false}).limit(500)),
          unwrap(client.from('dining_session_items').select('*').in('restaurant_id',memberIds).order('created_at')),
          unwrap(client.from('table_service_requests').select('*').in('restaurant_id',memberIds).order('created_at',{ascending:false}).limit(250)),
          unwrap(client.from('hotel_service_requests').select('*').in('hotel_id',memberIds).order('created_at',{ascending:false}).limit(250)),
          unwrap(client.from('hotel_room_service_orders').select('*').in('hotel_id',memberIds).order('created_at',{ascending:false}).limit(250)),
        ]);
        const tableMap=new Map(tableRowsForMap.map((row:Row)=>[row.id,row.table_number]));
        const roomMap=new Map(roomRowsForMap.map((row:Row)=>[row.id,row.room_number]));
        setOrders(orderRows.map(row=>getTableOrder(row,tableMap)));
        setDiningSessions(sessionRows.map(row=>getDiningSession(row,tableMap,billRows)));
        setServiceRequests(serviceRequestRows.map(row=>getTableServiceRequest(row,tableMap)));
        setHotelServiceRequests(hotelServiceRequestRows.map(row=>getHotelServiceRequest(row,roomMap)));
        setHotelRoomServiceOrders(hotelRoomOrderRows.map(row=>getHotelRoomServiceOrder(row,roomMap)));
      } else {setOrders([]);setDiningSessions([]);setServiceRequests([]);setHotelServiceRequests([]);setHotelRoomServiceOrders([]);}
    } catch (issue) { setError(errorText(issue)); }
    finally { setHydrated(true); }
  },[client,publicRestaurantSlug,publicHotelSlug,sessionRestaurantId]);

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
      channel.on('postgres_changes',{event:'*',schema:'public',table:'table_service_requests',filter:`restaurant_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'hotel_service_requests',filter:`hotel_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'hotel_room_service_orders',filter:`hotel_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'restaurant_tables',filter:`restaurant_id=eq.${id}`},()=>void refresh());
      channel.on('postgres_changes',{event:'*',schema:'public',table:'hotel_rooms',filter:`hotel_id=eq.${id}`},()=>void refresh());
    });
    channel.subscribe();
    return ()=>{void client.removeChannel(channel);};
  },[client,restaurants,refresh]);

  const run=useCallback(async(task:()=>Promise<void>)=>{try{await task();setError('');}catch(issue){setError(errorText(issue));throw issue;}},[]);

  const value=useMemo<Store>(()=>({
    restaurants,orders,diningSessions,serviceRequests,hotelServiceRequests,hotelRoomServiceOrders,sessionRestaurantId,hydrated,configured:isSupabaseConfigured(),error,
    setSession:setSessionRestaurantId,refresh,clearError:()=>setError(''),
    signOut:async()=>{if(!client)return;await client.auth.signOut();setRestaurants([]);setOrders([]);setDiningSessions([]);setServiceRequests([]);setHotelServiceRequests([]);setHotelRoomServiceOrders([]);setSessionRestaurantId(null);},
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
      const refreshedSession=await readGuestSession(client,restaurant.slug,session.tableNumber,session.id,token,restaurants);
      const savedOrder=refreshedSession.orders?.find(order=>order.id===row.order_id);
      if(savedOrder)return savedOrder;
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
    requestTableService:async(session,type,note)=>{
      if(!client)throw new Error('Table service is unavailable until Supabase is configured.');
      const restaurant=restaurants.find(row=>row.id===session.restaurantId);if(!restaurant?.slug)throw new Error('Restaurant menu is unavailable.');
      const stored=sessionStorage.getItem(keyFor(restaurant.slug,session.tableNumber));if(!stored)throw new Error('Your table session expired. Please ask a server for help.');
      const {token}=JSON.parse(stored);await unwrap(client.rpc('request_table_service',{p_session_id:session.id,p_session_token:token,p_request_type:type,p_note:note?.trim()||''}));
    },
    updateTableServiceRequest:async(id,status)=>run(async()=>{if(!client)throw new Error('Connect Supabase before updating service requests.');await unwrap(client.rpc('update_table_service_request',{p_request_id:id,p_status:status}));await refresh();}),
    requestHotelService:async(input)=>{
      if(!client)throw new Error('Hotel service is unavailable until Supabase is configured.');
      if(!input.roomToken)throw new Error('Use the QR or NFC tag provided in this room.');
      const key=hotelRequestKeyFor(input.hotelSlug,input.roomNumber,input.type);
      let attempt:{idempotencyKey:string;trackingToken:string}|null=null;
      try{attempt=JSON.parse(sessionStorage.getItem(key)||'null');}catch{}
      if(!attempt)attempt={idempotencyKey:crypto.randomUUID(),trackingToken:crypto.randomUUID()};
      sessionStorage.setItem(key,JSON.stringify(attempt));
      const result=await unwrap(client.rpc('request_hotel_service',{p_hotel_slug:input.hotelSlug,p_room_number:input.roomNumber,p_room_token:input.roomToken,p_request_type:input.type,p_note:input.note?.trim()||'',p_idempotency_key:attempt.idempotencyKey,p_tracking_token:attempt.trackingToken}));
      const row=Array.isArray(result)?result[0]:result;
      if(!row?.tracking_token)throw new Error('The hotel service request could not be confirmed. Please try again.');
      sessionStorage.removeItem(key);
      return {trackingToken:String(row.tracking_token),status:row.status as HotelServiceRequest['status']};
    },
    updateHotelServiceRequest:async(id,status)=>run(async()=>{if(!client)throw new Error('Connect Supabase before updating hotel service requests.');await unwrap(client.rpc('update_hotel_service_request',{p_request_id:id,p_status:status}));await refresh();}),
    placeHotelRoomServiceOrder:async(input)=>{
      if(!client)throw new Error('Room service is unavailable until Supabase is configured.');
      if(!input.roomToken)throw new Error('Use the QR or NFC tag provided in this room.');
      const key=`tabletouch:room-order:${input.hotelSlug}:${input.roomNumber}`;
      const idempotencyKey=sessionStorage.getItem(key)||crypto.randomUUID();sessionStorage.setItem(key,idempotencyKey);
      const result=await unwrap(client.rpc('place_hotel_room_service_order',{p_hotel_slug:input.hotelSlug,p_room_number:input.roomNumber,p_room_token:input.roomToken,p_items:input.items.map(item=>({item_id:item.itemId,quantity:item.quantity})),p_idempotency_key:idempotencyKey,p_guest_note:input.note?.trim()||''}));
      const row=Array.isArray(result)?result[0]:result;if(!row?.tracking_token)throw new Error('The room-service order could not be confirmed. Please try again.');
      sessionStorage.removeItem(key);return {trackingToken:String(row.tracking_token),total:Number(row.order_total)};
    },
    updateHotelRoomServiceOrder:async(id,status)=>run(async()=>{if(!client)throw new Error('Connect Supabase before updating room-service orders.');await unwrap(client.rpc('update_hotel_room_service_order',{p_order_id:id,p_status:status}));await refresh();}),
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
    addTables:async(restaurantId,count)=>run(async()=>{if(!client)throw new Error('Connect Supabase before managing tables.');const restaurant=restaurants.find(row=>row.id===restaurantId);if(!restaurant)throw new Error('Restaurant unavailable.');const branches:Row[]=await unwrap(client.from('branches').select('id').eq('restaurant_id',restaurantId).order('created_at').limit(1));if(!branches[0])throw new Error('Restaurant branch is missing.');const existing=new Set((restaurant.tableDetails||restaurant.tableNumbers||[]).map(table=>typeof table==='string'?table:table.tableNumber));const max=Math.max(0,...Array.from(existing).map(Number));const rows=Array.from({length:Math.min(100,Math.max(0,count))},(_,index)=>({restaurant_id:restaurantId,branch_id:branches[0].id,table_number:tableText(max+index+1)}));if(rows.length)await unwrap(client.from('restaurant_tables').insert(rows));await refresh();}),
    addHotelRooms:async(hotelId,count)=>run(async()=>{if(!client)throw new Error('Connect Supabase before managing rooms.');const hotel=restaurants.find(row=>row.id===hotelId&&row.businessType==='hotel');if(!hotel)throw new Error('Hotel unavailable.');const existing=new Set((hotel.roomDetails||[]).map(room=>room.roomNumber));const numericRooms=Array.from(existing).filter(value=>/^\d+$/.test(value)).map(Number);const max=Math.max(0,...numericRooms);const rows=Array.from({length:Math.min(100,Math.max(0,count))},(_,index)=>({hotel_id:hotelId,room_number:String(max+index+1).padStart(3,'0')}));if(rows.length)await unwrap(client.from('hotel_rooms').insert(rows));await refresh();}),
    rotateTableToken:async(restaurantId,tableNumber)=>run(async()=>{if(!client)throw new Error('Connect Supabase before rotating a table link.');await unwrap(client.rpc('rotate_table_public_token',{p_restaurant_id:restaurantId,p_table_number:tableText(tableNumber)}));await refresh();}),
    setTableActive:async(restaurantId,tableNumber,isActive)=>run(async()=>{if(!client)throw new Error('Connect Supabase before changing a table status.');await unwrap(client.rpc('set_restaurant_table_active',{p_restaurant_id:restaurantId,p_table_number:tableText(tableNumber),p_is_active:isActive}));await refresh();}),
    rotateHotelRoomToken:async(hotelId,roomNumber)=>run(async()=>{if(!client)throw new Error('Connect Supabase before rotating a room link.');await unwrap(client.rpc('rotate_hotel_room_public_token',{p_hotel_id:hotelId,p_room_number:roomNumber}));await refresh();}),
    setHotelRoomActive:async(hotelId,roomNumber,isActive)=>run(async()=>{if(!client)throw new Error('Connect Supabase before changing a room status.');await unwrap(client.rpc('set_hotel_room_active',{p_hotel_id:hotelId,p_room_number:roomNumber,p_is_active:isActive}));await refresh();}),
  }),[restaurants,orders,diningSessions,serviceRequests,hotelServiceRequests,hotelRoomServiceOrders,sessionRestaurantId,hydrated,error,client,refresh,run]);

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
