'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight, BadgePercent, CirclePlus, Plus, Search, Tag, Utensils } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { MenuItemEditorDialog } from '@/components/admin/MenuItemEditorDialog';
import type { Category, MenuItem } from '@/data';
import { useStore } from '@/store';

function MenuWorkspace(){
 const {restaurants,sessionRestaurantId,orders,saveMenuItem,saveMenuCategory}=useStore();const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 const [editing,setEditing]=useState<MenuItem|null>(null);const [search,setSearch]=useState('');const [newCategory,setNewCategory]=useState('');const [categoryError,setCategoryError]=useState('');
 const bestSellers=useMemo(()=>{const counts=new Map<string,number>();orders.filter(order=>order.restaurantId===restaurant?.id&&order.status!=='Cancelled').forEach(order=>order.items.forEach(item=>counts.set(item.itemId,(counts.get(item.itemId)||0)+item.quantity)));return Array.from(counts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>id)},[orders,restaurant?.id]);
 if(!restaurant)return null;
 const visible=restaurant.menuItems.filter(item=>[item.name,item.description,...(item.tags||[])].join(' ').toLowerCase().includes(search.toLowerCase()));
 const blank:MenuItem={id:'',name:'',description:'',price:0,category:restaurant.categories[0]?.id||'',image:'',veg:false,bestseller:false,available:true,tags:[],ingredients:[],allergens:[],searchKeywords:[]};
 const addCategory=async()=>{const name=newCategory.trim();if(!name)return;setCategoryError('');try{await saveMenuCategory(restaurant.id,{id:'',name});setNewCategory('');}catch(issue){setCategoryError(issue instanceof Error?issue.message:'Could not add category.')}};
 return <>
  <div className="owner-page-heading"><div><span className="eyebrow"><span/> RESTAURANT MENU</span><h1>Your menu</h1><p>Manage dishes, prices, availability and the tags customers see on food photos.</p></div><a className="button button-outline-dark" href={`/r/${restaurant.slug||restaurant.id}`} target="_blank" rel="noreferrer">Preview menu <ArrowUpRight size={14}/></a></div>
  <section className="menu-category-admin"><div><span className="eyebrow"><span/> CATEGORIES</span><p>Organize what customers see on your menu page.</p></div><div className="menu-category-pills">{restaurant.categories.map(category=><span key={category.id}>{category.name}</span>)}</div><form onSubmit={event=>{event.preventDefault();void addCategory()}}><input aria-label="New menu category" placeholder="New category" maxLength={60} value={newCategory} onChange={event=>setNewCategory(event.target.value)}/><button className="button button-outline-dark"><Plus size={14}/> Add</button></form>{categoryError&&<small className="form-error">{categoryError}</small>}</section>
  <section className="owner-panel menu-admin-panel"><div className="owner-panel-head"><div><h2>Menu items</h2><p>{restaurant.menuItems.length} items · edits publish on your customer menu</p></div><button className="button button-dark" onClick={()=>setEditing(blank)}><CirclePlus size={15}/> Add a dish</button></div><label className="menu-admin-search"><Search size={15}/><input aria-label="Search dishes" placeholder="Find a dish" value={search} onChange={event=>setSearch(event.target.value)}/></label>
   {visible.length===0?<div className="orders-empty"><div><Utensils/></div><h2>No menu items yet</h2><p>Add your first dishes, prices and clear photos. Mark high sellers so they stand out to guests.</p><button className="button button-dark" onClick={()=>setEditing(blank)}><Plus size={14}/> Add first dish</button></div>:<div className="menu-admin-grid">{visible.map(item=><article className={`menu-admin-card ${item.available?'':'unavailable'}`} key={item.id}><div className="menu-admin-image" style={item.image?{backgroundImage:`url("${item.image}")`}:{}}>{!item.image&&<Utensils size={19}/>}<div className="menu-admin-tags">{bestSellers.includes(item.id)&&<span className="admin-most-ordered">Most ordered</span>}{item.bestseller&&<span>Bestseller</span>}{(item.tags||[]).map(tag=><span key={tag}><Tag size={10}/>{tag}</span>)}</div></div><div className="menu-admin-copy"><small>{restaurant.categories.find(category=>category.id===item.category)?.name||'Uncategorized'} · {item.veg?'Vegetarian':'Non-vegetarian'}</small><h3>{item.name}</h3><p>{item.description||'No description yet.'}</p><div><b>₹{item.price.toLocaleString('en-IN')}</b><span className={item.available?'menu-item-live':'menu-item-off'}><i/>{item.available?'Available':'Sold out'}</span></div><button onClick={()=>setEditing(item)}>Edit dish and photo</button></div></article>)}</div>}
  </section>
  <aside className="menu-tag-tip"><BadgePercent size={18}/><span><b>Most ordered tags update from live restaurant orders.</b><small>Use Bestseller, Chef’s pick, Popular or New arrival to add your own photo badges.</small></span></aside>
  {editing&&<MenuItemEditorDialog item={editing} categories={restaurant.categories} restaurantId={restaurant.id} existing={Boolean(editing.id)} onSave={item=>{void saveMenuItem(restaurant.id,item).then(()=>setEditing(null)).catch(()=>undefined)}} onClose={()=>setEditing(null)}/>}
 </>;
}
export default function RestaurantMenuAdmin(){return <OwnerShell active="Menu"><MenuWorkspace/></OwnerShell>}
