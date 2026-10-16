'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Check, ImageUp, Palette, Store } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { RestaurantMark } from '@/components/RestaurantMark';
import type { Restaurant } from '@/data';
import { getSupabaseBrowserClient } from '@/lib/supabase';
import { useStore } from '@/store';

type BrandingDraft = Pick<Restaurant, 'name' | 'description' | 'phone' | 'address' | 'hours' | 'instagram' | 'primaryColor' | 'secondaryColor' | 'logoUrl' | 'coverImage'>;

function makeDraft(restaurant: Restaurant): BrandingDraft {
  return { name: restaurant.name, description: restaurant.description, phone: restaurant.phone, address: restaurant.address, hours: restaurant.hours, instagram: restaurant.instagram, primaryColor: restaurant.primaryColor, secondaryColor: restaurant.secondaryColor, logoUrl: restaurant.logoUrl || '', coverImage: restaurant.coverImage || '' };
}

function isHexColor(value: string) { return /^#[0-9a-f]{6}$/i.test(value); }

function RestaurantSettingsContent() {
  const { restaurants, sessionRestaurantId, saveRestaurant } = useStore();
  const restaurant = restaurants.find(item => item.id === sessionRestaurantId);
  const [draft, setDraft] = useState<BrandingDraft | null>(restaurant ? makeDraft(restaurant) : null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  useEffect(() => { if (restaurant) setDraft(makeDraft(restaurant)); }, [restaurant?.id]);
  if (!restaurant || !draft) return null;

  const update = <K extends keyof BrandingDraft>(key: K, value: BrandingDraft[K]) => { setDraft(current => current ? { ...current, [key]: value } : current); setSaved(false); };
  const upload = async (kind: 'logo' | 'cover', file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError('Choose a JPG, PNG or WebP image under 8 MB.'); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError('Supabase is not configured.'); return; }
    setUploading(kind); setError('');
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${restaurant.id}/branding/${kind}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('restaurant-assets').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path);
      update(kind === 'logo' ? 'logoUrl' : 'coverImage', data.publicUrl);
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Image upload failed.'); }
    finally { setUploading(null); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (name.length < 2 || name.length > 120) { setError('Restaurant name must be between 2 and 120 characters.'); return; }
    if (!isHexColor(draft.primaryColor) || !isHexColor(draft.secondaryColor)) { setError('Use a six-digit hex colour, such as #4B111B.'); return; }
    setSaving(true); setSaved(false); setError('');
    try { await saveRestaurant({ ...restaurant, ...draft, name }); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not save restaurant settings.'); }
    finally { setSaving(false); }
  };
  const preview = { ...restaurant, ...draft };
  return <>
    <div className="owner-page-heading"><div><span className="eyebrow"><span /> RESTAURANT PROFILE</span><h1>Restaurant settings</h1><p>Set the details and visual identity guests see on your online menu and printed bill.</p></div></div>
    <form className="restaurant-settings-card" onSubmit={submit}>
      <section className="restaurant-settings-preview" style={{ backgroundImage: draft.coverImage ? `url("${draft.coverImage}")` : undefined }}><div className="restaurant-settings-preview-shade" /><div className="restaurant-settings-preview-copy"><RestaurantMark restaurant={preview} className="restaurant-settings-mark" /><span><small>MENU PREVIEW</small><b>{draft.name || 'Your restaurant'}</b><em>{draft.description || 'Add a short description for your guests.'}</em></span></div></section>
      <div className="restaurant-settings-body">
        <div className="restaurant-settings-heading"><div className="restaurant-settings-icon"><Store /></div><div><h2>Public restaurant details</h2><p>These details are displayed only for this restaurant.</p></div></div>
        <div className="restaurant-settings-grid">
          <label>Restaurant name<input required minLength={2} maxLength={120} value={draft.name} onChange={event => update('name', event.target.value)} /></label><label>Phone number<input maxLength={40} value={draft.phone} onChange={event => update('phone', event.target.value)} placeholder="+91 98765 43210" /></label>
          <label className="restaurant-settings-wide">Menu description<textarea maxLength={700} value={draft.description} onChange={event => update('description', event.target.value)} placeholder="Tell guests about your restaurant" /></label>
          <label>Address<input maxLength={300} value={draft.address} onChange={event => update('address', event.target.value)} placeholder="Restaurant address" /></label><label>Opening hours<input maxLength={160} value={draft.hours} onChange={event => update('hours', event.target.value)} placeholder="Daily · 12 PM to 11 PM" /></label>
          <label className="restaurant-settings-wide">Instagram<input maxLength={100} value={draft.instagram} onChange={event => update('instagram', event.target.value)} placeholder="@yourrestaurant" /></label>
        </div>
        <div className="restaurant-settings-heading restaurant-settings-heading-space"><div className="restaurant-settings-icon"><Palette /></div><div><h2>Brand and images</h2><p>Upload images or use a direct image URL. Public menu images are limited to 8 MB.</p></div></div>
        <div className="restaurant-settings-grid">
          <label>Primary colour<div className="restaurant-color-input"><input aria-label="Primary colour picker" type="color" value={draft.primaryColor} onChange={event => update('primaryColor', event.target.value.toUpperCase())} /><input value={draft.primaryColor} maxLength={7} onChange={event => update('primaryColor', event.target.value)} /></div></label>
          <label>Accent colour<div className="restaurant-color-input"><input aria-label="Accent colour picker" type="color" value={draft.secondaryColor} onChange={event => update('secondaryColor', event.target.value.toUpperCase())} /><input value={draft.secondaryColor} maxLength={7} onChange={event => update('secondaryColor', event.target.value)} /></div></label>
          <label>Logo image URL<input type="url" value={draft.logoUrl} onChange={event => update('logoUrl', event.target.value)} placeholder="https://…" /></label><label>Cover image URL<input type="url" value={draft.coverImage} onChange={event => update('coverImage', event.target.value)} placeholder="https://…" /></label>
        </div>
        <div className="restaurant-upload-grid"><label className="restaurant-upload"><ImageUp size={18} /><span><b>Upload logo</b><small>Square JPG, PNG or WebP.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload('logo', event.target.files?.[0])} />{uploading === 'logo' && <em>Uploading…</em>}</label><label className="restaurant-upload"><ImageUp size={18} /><span><b>Upload menu cover</b><small>Wide JPG, PNG or WebP.</small></span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void upload('cover', event.target.files?.[0])} />{uploading === 'cover' && <em>Uploading…</em>}</label></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="restaurant-settings-footer"><p>Saving updates your public menu, owner workspace and bill heading. Existing order and bill records stay unchanged.</p><button className="button button-dark" disabled={saving || uploading !== null}>{saved ? <><Check size={15} /> Saved</> : saving ? 'Saving…' : 'Save restaurant settings'}</button></div>
      </div>
    </form>
  </>;
}

export default function RestaurantSettingsPage() { return <OwnerShell active="Restaurant settings"><RestaurantSettingsContent /></OwnerShell>; }
