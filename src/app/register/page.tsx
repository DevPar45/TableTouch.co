'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileCheck2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';

const slugify=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp']);

export default function RestaurantRegistration(){
  const router=useRouter();const supabase=getSupabaseBrowserClient();
  const [account,setAccount]=useState<{email:string;id:string}|null>(null);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [ownerName,setOwnerName]=useState('');
  const [restaurantName,setRestaurantName]=useState('');const [slug,setSlug]=useState('');const [phone,setPhone]=useState('');const [address,setAddress]=useState('');
  const [fssai,setFssai]=useState('');const [gst,setGst]=useState('');const [tableCount,setTableCount]=useState(8);const [proofs,setProofs]=useState<File[]>([]);
  const [working,setWorking]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [draftRestored,setDraftRestored]=useState(false);
  const generatedSlug=useMemo(()=>slugify(restaurantName),[restaurantName]);
  useEffect(()=>{if(!supabase)return;void supabase.auth.getUser().then(({data})=>{if(data.user){setAccount({id:data.user.id,email:data.user.email||''});setEmail(data.user.email||'');}})},[supabase]);
  useEffect(()=>{try{const draft=sessionStorage.getItem('tabletouch:application-draft');if(draft){const saved=JSON.parse(draft);setOwnerName(saved.ownerName||'');setRestaurantName(saved.restaurantName||'');setSlug(saved.slug||'');setPhone(saved.phone||'');setAddress(saved.address||'');setFssai(saved.fssai||'');setGst(saved.gst||'');setTableCount(saved.tableCount||8);}}catch{}setDraftRestored(true);},[]);
  useEffect(()=>{if(draftRestored)sessionStorage.setItem('tabletouch:application-draft',JSON.stringify({ownerName,restaurantName,slug,phone,address,fssai,gst,tableCount}));},[draftRestored,ownerName,restaurantName,slug,phone,address,fssai,gst,tableCount]);

  const continueWithAccount=async()=>{
    if(!supabase){setError('Add your Supabase project URL and publishable key before accepting applications.');return;}
    setError('');setMessage('');setWorking(true);
    try{
      const {data,error:authError}=await supabase.auth.getUser();if(authError)throw authError;
      if(data.user){setAccount({id:data.user.id,email:data.user.email||email});setMessage('Account verified. Complete the restaurant details and attach a business proof.');return;}
      const result=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:ownerName.trim()},emailRedirectTo:`${window.location.origin}/register`}});
      if(result.error)throw result.error;
      if(result.data.user&&result.data.session){setAccount({id:result.data.user.id,email:result.data.user.email||email});setMessage('Account created. Complete the restaurant details below.');}
      else setMessage('We sent a verification link to your email. Verify it, return here in this browser, then select “I verified my email” to finish the application. Your form details remain on this page.');
    }catch(issue){setError(issue instanceof Error?issue.message:'Could not create your account.');}
    finally{setWorking(false);}
  };

  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');setMessage('');if(!supabase){setError('Add your Supabase project URL and publishable key before accepting applications.');return;}
    if(!account){await continueWithAccount();return;}
    if(proofs.length===0){setError('Attach at least one FSSAI, GST, business registration, or other restaurant proof.');return;}
    if(proofs.some(file=>!allowed.has(file.type)||file.size>10*1024*1024)){setError('Proofs must be PDF, JPG, PNG, or WebP files under 10 MB each.');return;}
    setWorking(true);
    const uploaded:string[]=[];
    try{
      const paths:string[]=[];
      for(const file of proofs){const ext=file.name.split('.').pop()?.toLowerCase()||'bin';const path=`applications/${account.id}/${crypto.randomUUID()}.${ext}`;const {error:uploadError}=await supabase.storage.from('business-proofs').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;uploaded.push(path);paths.push(path);}
      const finalSlug=slugify(slug||generatedSlug);
      const {data,error:submitError}=await supabase.rpc('register_restaurant',{p_slug:finalSlug,p_name:restaurantName.trim(),p_owner_name:ownerName.trim(),p_phone:phone.trim(),p_address:address.trim(),p_fssai_number:fssai.trim(),p_gst_number:gst.trim(),p_document_paths:paths,p_table_count:tableCount});
      if(submitError)throw submitError;
      sessionStorage.removeItem('tabletouch:application-draft');
      router.push(`/register/submitted?id=${encodeURIComponent(data)}`);
    }catch(issue){if(uploaded.length)await supabase.storage.from('business-proofs').remove(uploaded);setError(issue instanceof Error?issue.message:'Could not submit the application.');}
    finally{setWorking(false);}
  };

  const showSupabaseError=!isSupabaseConfigured();
  return <main className="tracking-page onboarding-page"><section className="tracking-card onboarding-card">
    <Link className="tracking-back" href="/"><ArrowLeft size={14}/> Back to Tabletouch</Link>
    <div className="onboarding-icon"><ShieldCheck size={22}/></div><span className="eyebrow"><span/> RESTAURANT ONBOARDING</span><h1>Bring your restaurant online.</h1>
    <p>Create an owner account, submit your restaurant details and attach business proof. Tabletouch checks each application before any menu can go live.</p>
    {showSupabaseError&&<div className="form-error">Supabase is not connected yet. Configure the two public Supabase environment values to activate applications.</div>}
    <form className="onboarding-form" onSubmit={submit}>
      {!account?<>
        <h2>Owner account</h2>
        <label>Owner’s full name<input required minLength={2} maxLength={100} value={ownerName} onChange={e=>setOwnerName(e.target.value)} autoComplete="name"/></label>
        <label>Business email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
        <label>Password <small>Use at least 10 characters.</small><input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
        <button className="button button-dark full-button" type="button" disabled={working||showSupabaseError} onClick={continueWithAccount}>{working?<LoaderCircle className="spin" size={16}/>:null}Create owner account and continue</button>
        <p className="onboarding-split">Already registered? <Link href="/restaurant/login">Sign in to continue</Link></p>
      </>:<>
        <div className="account-confirmed"><CheckCircle2 size={17}/><span>Signed in as <b>{account.email}</b></span></div>
        <h2>Restaurant details</h2>
        <label>Restaurant name<input required minLength={2} maxLength={120} value={restaurantName} onChange={e=>{setRestaurantName(e.target.value);setSlug('')}}/></label>
        <label>Restaurant page address <small>Customers receive this link with each table QR.</small><div className="slug-input"><span>tabletouch.in/r/</span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug||generatedSlug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder="your-restaurant"/></div></label>
        <div className="onboarding-two-col"><label>Owner phone<input required minLength={7} maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label><label>Number of tables<input required type="number" min={1} max={100} value={tableCount} onChange={e=>setTableCount(Number(e.target.value))}/></label></div>
        <label>Restaurant address<textarea required minLength={5} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)}/></label>
        <div className="onboarding-two-col"><label>FSSAI number <small>If applicable</small><input maxLength={30} value={fssai} onChange={e=>setFssai(e.target.value)}/></label><label>GST number <small>If applicable</small><input maxLength={30} value={gst} onChange={e=>setGst(e.target.value)}/></label></div>
        <label className="proof-upload"><span><FileCheck2 size={17}/> Business proof documents</span><small>FSSAI, GST, shop registration, or other legal business proof. PDF, JPG, PNG, WebP · max 10 MB per file.</small><input required type="file" accept=".pdf,image/jpeg,image/png,image/webp" multiple onChange={e=>setProofs(Array.from(e.target.files||[]))}/>{proofs.length>0&&<b>{proofs.map(file=>file.name).join(' · ')}</b>}</label>
        <button className="button button-dark full-button" disabled={working||showSupabaseError}>{working?<LoaderCircle className="spin" size={16}/>:<ShieldCheck size={16}/>} Submit for verification</button>
      </>}
      {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}{!account&&message.includes('verification link')&&<button type="button" onClick={continueWithAccount}>I verified my email</button>}</div>}
    </form>
    <small className="onboarding-privacy">Business documents are stored in a private bucket. Only the applying owner and verified Tabletouch administrators can access them.</small>
  </section></main>;
}
