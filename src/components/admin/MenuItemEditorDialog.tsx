'use client';

import { FormEvent, useState } from 'react';
import { Save, X } from 'lucide-react';
import { Category, MenuItem } from '@/data';
import { getSupabaseBrowserClient } from '@/lib/supabase';

const TAG_OPTIONS = ['Chef’s pick', 'Popular', 'Bestseller', 'New arrival'];
const joinList = (values?: string[]) => (values || []).join(', ');
const splitList = (value: string) => Array.from(new Set(value.split(',').map(item => item.trim()).filter(Boolean)));

type Props = {
  item: MenuItem;
  categories: Category[];
  existing: boolean;
  restaurantId: string;
  onSave: (item: MenuItem) => void;
  onClose: () => void;
};

export function MenuItemEditorDialog({ item, categories, existing, restaurantId, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<MenuItem>({ ...item, tags: item.tags || [] });
  const [ingredients, setIngredients] = useState(joinList(item.ingredients));
  const [allergens, setAllergens] = useState(joinList(item.allergens));
  const [keywords, setKeywords] = useState(joinList(item.searchKeywords));
  const [uploading,setUploading]=useState(false);
  const [uploadError,setUploadError]=useState('');
  const toggleTag = (tag: string) => setDraft(current => ({
    ...current,
    tags: current.tags?.includes(tag) ? current.tags.filter(value => value !== tag) : [...(current.tags || []), tag],
  }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({
      ...draft,
      ingredients: splitList(ingredients),
      allergens: splitList(allergens),
      searchKeywords: splitList(keywords),
      prepMinutes: draft.prepMinutes ? Math.max(1, Math.min(1440, Math.round(draft.prepMinutes))) : undefined,
    });
  };
  const uploadImage=async(file?:File)=>{
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){setUploadError('Choose a JPG, PNG or WebP image under 8 MB.');return;}
    const supabase=getSupabaseBrowserClient();if(!supabase){setUploadError('Supabase is not configured.');return;}
    setUploading(true);setUploadError('');
    try{const ext=file.name.split('.').pop()?.toLowerCase()||'jpg';const path=`${restaurantId}/menu/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from('restaurant-assets').upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;const {data}=supabase.storage.from('restaurant-assets').getPublicUrl(path);setDraft(current=>({...current,image:data.publicUrl}));}
    catch(issue){setUploadError(issue instanceof Error?issue.message:'Image upload failed.');}
    finally{setUploading(false);}
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <form className="edit-modal" onSubmit={submit} onClick={event => event.stopPropagation()}>
      <div className="modal-head">
        <div><span className="eyebrow"><span/> MENU MANAGEMENT</span><h2>{existing ? 'Edit item' : 'Add a menu item'}</h2></div>
        <button type="button" onClick={onClose} className="round-tool" aria-label="Close editor"><X size={16}/></button>
      </div>
      <label>Item name<input required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Paneer Tikka"/></label>
      <label>Description<textarea maxLength={700} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Tell guests what makes it special"/></label>
      <div className="form-split">
        <label>Price (₹)<input required min="0" step="0.01" type="number" value={draft.price || ''} onChange={event => setDraft({ ...draft, price: Number(event.target.value) })}/></label>
        <label>Category<select required value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}><option value="">Choose a category</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>
      <label>Food image URL<input type="url" value={draft.image} onChange={event => setDraft({ ...draft, image: event.target.value })} placeholder="https://…"/></label>
      <label className="food-image-upload">Or upload a food photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void uploadImage(event.target.files?.[0])}/><small>JPG, PNG or WebP · up to 8 MB. Uploads go to this restaurant’s public menu images.</small>{uploading&&<small>Uploading image…</small>}{draft.image&&<img src={draft.image} alt="Menu item preview"/>}{uploadError&&<small className="form-error">{uploadError}</small>}</label>
      <label>Ingredients <span className="optional">(comma separated; used in menu search)</span><input value={ingredients} onChange={event => setIngredients(event.target.value)} placeholder="paneer, yoghurt, chilli"/></label>
      <label>Allergens <span className="optional">(enter only verified allergens)</span><input value={allergens} onChange={event => setAllergens(event.target.value)} placeholder="milk, nuts, gluten"/></label>
      <div className="form-split">
        <label>Spice level<select value={draft.spiceLevel || ''} onChange={event => setDraft({ ...draft, spiceLevel: (event.target.value || undefined) as MenuItem['spiceLevel'] })}><option value="">Not specified</option><option>Mild</option><option>Medium</option><option>Hot</option><option>Very hot</option></select></label>
        <label>Preparation time (minutes)<input min="1" max="1440" step="1" type="number" value={draft.prepMinutes || ''} onChange={event => setDraft({ ...draft, prepMinutes: event.target.value ? Number(event.target.value) : undefined })}/></label>
      </div>
      <label>Search keywords <span className="optional">(comma separated)</span><input value={keywords} onChange={event => setKeywords(event.target.value)} placeholder="tandoori, grilled, house special"/></label>
      <div className="form-options">
        <label><input type="checkbox" checked={draft.veg} onChange={event => setDraft({ ...draft, veg: event.target.checked })}/> Vegetarian</label>
        <label><input type="checkbox" checked={draft.bestseller} onChange={event => setDraft({ ...draft, bestseller: event.target.checked })}/> Bestseller</label>
        <label><input type="checkbox" checked={draft.chefRecommendation || false} onChange={event => setDraft({ ...draft, chefRecommendation: event.target.checked })}/> Chef recommendation</label>
        <label><input type="checkbox" checked={draft.available} onChange={event => setDraft({ ...draft, available: event.target.checked })}/> Available</label>
      </div>
      <fieldset className="food-tag-picker">
        <legend>Tags shown on the food photo</legend>
        {TAG_OPTIONS.map(tag => <label key={tag}><input type="checkbox" checked={draft.tags?.includes(tag) || false} onChange={() => toggleTag(tag)}/><span>{tag}</span></label>)}
        <small>“Most ordered” requires connected restaurant order data.</small>
      </fieldset>
      <button className="button button-dark full-button" disabled={uploading}><Save size={15}/> Save and publish</button>
    </form>
  </div>;
}

