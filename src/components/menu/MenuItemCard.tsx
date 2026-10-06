'use client';

import { Leaf, Minus, Plus } from 'lucide-react';
import { MenuItem } from '@/data';

type Props = {
  item: MenuItem;
  quantity: number;
  topOrdered: boolean;
  canOrder: boolean;
  onChange: (item: MenuItem, delta: number) => void;
};

export function MenuItemCard({ item, quantity, topOrdered, canOrder, onChange }: Props) {
  const price = (value: number) => `₹${value.toLocaleString('en-IN')}`;
  const tags = item.tags || [];
  const showsChefTag = tags.some(tag => tag.toLowerCase().includes('chef'));

  return <article className="food-card">
    <div className="food-image" style={{ backgroundImage: `url(${item.image})` }}>
      <div className="food-badges">
        {item.bestseller && <span className="food-badge bestseller">BESTSELLER</span>}
        {tags.map(tag => <span className="food-badge owner-tag" key={tag}>{tag.toUpperCase()}</span>)}
        {item.chefRecommendation && !showsChefTag && <span className="food-badge owner-tag">CHEF RECOMMENDED</span>}
        {topOrdered && <span className="food-badge top-ordered">MOST ORDERED</span>}
      </div>
      <span className={`food-mark ${item.veg ? 'veg' : 'nonveg'}`}><i/></span>
    </div>
    <div className="food-copy">
      <div className="food-title-row"><h3>{item.name}</h3><strong>{price(item.price)}</strong></div>
      <p>{item.description}</p>
      {(item.ingredients?.length || item.allergens?.length || item.prepMinutes || item.spiceLevel) ? <div className="food-details">
        {item.ingredients?.length ? <span>Ingredients: {item.ingredients.join(', ')}</span> : null}
        {item.allergens?.length ? <span className="food-allergens">Allergens: {item.allergens.join(', ')}</span> : null}
        {(item.prepMinutes || item.spiceLevel) ? <span>{item.prepMinutes ? `${item.prepMinutes} min prep` : ''}{item.prepMinutes && item.spiceLevel ? ' · ' : ''}{item.spiceLevel ? `${item.spiceLevel} spice` : ''}</span> : null}
      </div> : null}
      <div className="food-bottom">
        <span>{item.veg ? <><Leaf size={13}/> Vegetarian</> : 'Non-vegetarian'}</span>
        {!canOrder ? <small className="scan-to-order">Scan a table QR to order</small> : quantity === 0 ? <button className="add-button" onClick={() => onChange(item, 1)}>ADD <Plus size={14}/></button> : <div className="quantity-control"><button onClick={() => onChange(item, -1)} aria-label={`Remove one ${item.name}`}><Minus size={13}/></button><b>{quantity}</b><button onClick={() => onChange(item, 1)} aria-label={`Add one ${item.name}`}><Plus size={13}/></button></div>}
      </div>
    </div>
  </article>;
}
