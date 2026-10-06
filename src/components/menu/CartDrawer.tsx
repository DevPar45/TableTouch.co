'use client';
import { Check, Minus, Plus, ShoppingBag, X } from 'lucide-react';
import { MenuItem, Restaurant } from '@/data';
type Props={restaurant:Restaurant;cart:Record<string,number>;subtotal:number;submitted:boolean;trackingToken?:string;busy?:boolean;onClose:()=>void;onQuantity:(item:MenuItem,delta:number)=>void;onSubmit:()=>void};
const money=(n:number)=>`₹${n.toLocaleString('en-IN')}`;
export function CartDrawer({restaurant,cart,subtotal,submitted,trackingToken,busy=false,onClose,onQuantity,onSubmit}:Props){
 const items=restaurant.menuItems.filter(item=>item.available&&cart[item.id]);
 const count=Object.values(cart).reduce((sum,value)=>sum+value,0);
 return <div className="drawer-backdrop" onClick={onClose}><aside className="cart-drawer" onClick={event=>event.stopPropagation()}>
  <div className="drawer-head"><div><span className="eyebrow"><span/> YOUR SELECTION</span><h2>Your cart <em>({count})</em></h2></div><button className="round-tool" onClick={onClose} aria-label="Close cart"><X size={17}/></button></div>
  {count===0?(submitted?<div className="cart-empty order-success"><div className="success-check"><Check size={17}/></div><h3>Order round sent</h3><p>Your order is added to the bill under your dining name. Add another round whenever you’re ready.</p>{trackingToken&&<a className="button button-dark" href={`/order/${trackingToken}`}>Track this round</a>}</div>:<div className="cart-empty"><ShoppingBag size={28}/><h3>Your cart is waiting</h3><p>Add something delicious from the menu.</p></div>):<>
   <div className="cart-items">{items.map(item=><div className="cart-row" key={item.id}><div className="cart-thumb" style={{backgroundImage:`url(${item.image})`}}/><div className="cart-item-copy"><b>{item.name}</b><span>{money(item.price)}</span><div className="quantity-control"><button onClick={()=>onQuantity(item,-1)} aria-label={`Remove one ${item.name}`}><Minus size={12}/></button><b>{cart[item.id]}</b><button onClick={()=>onQuantity(item,1)} aria-label={`Add one ${item.name}`}><Plus size={12}/></button></div></div><strong>{money(item.price*cart[item.id])}</strong></div>)}</div>
   <div className="cart-summary"><div><span>This order round</span><b>{money(subtotal)}</b></div><div className="cart-total"><span>Round subtotal</span><b>{money(subtotal)}</b></div><button className="button button-dark full-button" onClick={onSubmit} disabled={busy}>{busy?'Sending order…':'Add this round to my bill'} <Check size={15}/></button><p className="bill-calc-note">Taxes and any restaurant service charge are calculated once on your combined final bill.</p></div>
  </>}
 </aside></div>;
}
