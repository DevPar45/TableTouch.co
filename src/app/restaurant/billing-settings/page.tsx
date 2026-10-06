'use client';
import { FormEvent, useEffect, useState } from 'react';
import { Check, ReceiptText } from 'lucide-react';
import { OwnerShell } from '@/components/OwnerShell';
import { BillLine } from '@/data';
import { calculateBill } from '@/lib/billing';
import { useStore } from '@/store';

function BillingSettingsContent(){
 const {restaurants,sessionRestaurantId,saveRestaurant}=useStore();
 const restaurant=restaurants.find(item=>item.id===sessionRestaurantId);
 const [taxRate,setTaxRate]=useState(restaurant?.taxRate||0);
 const [serviceRate,setServiceRate]=useState(restaurant?.serviceChargeRate||0);
 const [serviceLabel,setServiceLabel]=useState(restaurant?.serviceChargeLabel||'Service charge');
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(restaurant){setTaxRate(restaurant.taxRate);setServiceRate(restaurant.serviceChargeRate||0);setServiceLabel(restaurant.serviceChargeLabel||'Service charge')}},[restaurant?.id]);
 if(!restaurant)return null;
 const previewLine:BillLine={id:'preview',name:'Bill preview',price:1000,quantity:1,kind:'item'};
 const preview=calculateBill([previewLine],restaurant,{taxRate,serviceChargeRate:serviceRate,serviceChargeLabel:serviceLabel});
 const submit=async(event:FormEvent)=>{event.preventDefault();try{await saveRestaurant({...restaurant,taxRate,serviceChargeRate:serviceRate,serviceChargeLabel:serviceLabel.trim()||'Service charge'});setSaved(true);window.setTimeout(()=>setSaved(false),2500)}catch{setSaved(false)}};
 return <><div className="owner-page-heading"><div><span className="eyebrow"><span/> BILLING CONFIGURATION</span><h1>Taxes & service charges</h1><p>Set your restaurant’s rates. They are applied once to the complete guest bill, across every order round.</p></div></div><form className="billing-settings-card" onSubmit={submit}><div className="billing-settings-icon"><ReceiptText/></div><div className="billing-field-grid"><label>Tax rate (%)<small>Applied at bill time after food and service charges.</small><input type="number" min="0" max="30" step="0.01" value={taxRate} onChange={event=>setTaxRate(Math.max(0,Number(event.target.value)))}/></label><label>Service charge (%)<small>Set your own rate. Use 0 to turn the charge off.</small><input type="number" min="0" max="30" step="0.01" value={serviceRate} onChange={event=>setServiceRate(Math.max(0,Number(event.target.value)))}/></label><label className="billing-label-field">Service charge name<small>This label appears on the guest’s itemised bill.</small><input maxLength={40} value={serviceLabel} onChange={event=>setServiceLabel(event.target.value)} placeholder="e.g. Service charge"/></label></div><div className="billing-preview"><span className="eyebrow"><span/> EXAMPLE FINAL BILL</span><div><span>Food subtotal</span><b>₹{preview.subtotal.toLocaleString('en-IN')}</b></div>{preview.serviceRate>0&&<div><span>{preview.serviceLabel} ({preview.serviceRate}%)</span><b>₹{preview.serviceCharge.toLocaleString('en-IN')}</b></div>}<div><span>Tax ({preview.taxRate}%)</span><b>₹{preview.tax.toLocaleString('en-IN')}</b></div><div className="billing-preview-total"><span>Total due</span><b>₹{preview.total.toLocaleString('en-IN')}</b></div><small>Example uses a ₹1,000 food subtotal. Final tax and charges are calculated from the entire bill.</small></div><div className="billing-settings-footer"><p>Changing these settings affects bills requested after you save. Open bills keep the rates captured when the guest requested them.</p><button className="button button-dark" type="submit">{saved?<><Check size={15}/> Saved</>:'Save billing settings'}</button></div></form></>;
}
export default function BillingSettingsPage(){return <OwnerShell active="Billing settings"><BillingSettingsContent/></OwnerShell>}

