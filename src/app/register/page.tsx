'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, FileCheck2, LoaderCircle, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowserClient, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuthSession } from '@/lib/auth-session';
import { isServicePlanCode, servicePlanByCode, servicePlans, type ServicePlanCode } from '@/lib/service-plans';

const slugify=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55);
const allowed=new Set(['application/pdf','image/jpeg','image/png','image/webp']);

export default function RestaurantRegistration(){
  const router=useRouter();const supabase=getSupabaseBrowserClient();
  const [account,setAccount]=useState<{email:string;id:string}|null>(null);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [ownerName,setOwnerName]=useState('');
  const [businessType,setBusinessType]=useState<'restaurant'|'hotel'>('restaurant');const [restaurantName,setRestaurantName]=useState('');const [slug,setSlug]=useState('');const [phone,setPhone]=useState('');const [address,setAddress]=useState('');
  const [fssai,setFssai]=useState('');const [gst,setGst]=useState('');const [tableCount,setTableCount]=useState(8);const [currencyCode,setCurrencyCode]=useState('INR');const [timeZone,setTimeZone]=useState('Asia/Kolkata');const [welcomeMessage,setWelcomeMessage]=useState('');const [proofs,setProofs]=useState<File[]>([]);
  const [working,setWorking]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  const [verificationPending,setVerificationPending]=useState(false);const [needsOwnerSignIn,setNeedsOwnerSignIn]=useState(false);
  const [servicePlan,setServicePlan]=useState<ServicePlanCode>('free_pilot');
  const [draftRestored,setDraftRestored]=useState(false);
  const generatedSlug=useMemo(()=>slugify(restaurantName),[restaurantName]);
  const businessLabel=businessType==='hotel'?'hotel':'restaurant';const resourceLabel=businessType==='hotel'?'rooms':'tables';const publicPrefix=businessType==='hotel'?'tabletouch.in/hotel/':'tabletouch.in/r/';
  useEffect(()=>{
    if(!supabase)return;
    let mounted=true;
    const syncSession=async()=>{
      const {data,error:sessionError}=await supabase.auth.getSession();
      if(!mounted||sessionError||!data.session)return;
      const {data:userData}=await supabase.auth.getUser();
      if(!mounted||!userData.user)return;
      setAccount({id:userData.user.id,email:userData.user.email||''});
      setEmail(userData.user.email||'');
      setVerificationPending(false);
      setNeedsOwnerSignIn(false);
    };
    void syncSession();
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      if(!session?.user)return;
      setAccount({id:session.user.id,email:session.user.email||''});
      setEmail(session.user.email||'');
      setVerificationPending(false);
      setNeedsOwnerSignIn(false);
      setPassword('');
      setMessage('Email verified. Your owner account is signed in; finish the application below.');
    });
    const params=new URLSearchParams(window.location.search);
    if(params.get('auth_error'))setError('That verification link could not be completed. Request a fresh link or sign in, then return to your application.');
    return()=>{mounted=false;subscription.unsubscribe();};
  },[supabase]);
  useEffect(()=>{const plan=new URLSearchParams(window.location.search).get('plan');if(isServicePlanCode(plan))setServicePlan(plan);},[]);
  useEffect(()=>{try{const draft=sessionStorage.getItem('tabletouch:application-draft');if(draft){const saved=JSON.parse(draft);setBusinessType(saved.businessType==='hotel'?'hotel':'restaurant');setOwnerName(saved.ownerName||'');setRestaurantName(saved.restaurantName||'');setSlug(saved.slug||'');setPhone(saved.phone||'');setAddress(saved.address||'');setFssai(saved.fssai||'');setGst(saved.gst||'');setTableCount(saved.tableCount||8);setCurrencyCode(saved.currencyCode||'INR');setTimeZone(saved.timeZone||'Asia/Kolkata');setWelcomeMessage(saved.welcomeMessage||'');if(isServicePlanCode(saved.servicePlan))setServicePlan(saved.servicePlan);}}catch{}setDraftRestored(true);},[]);
  useEffect(()=>{if(draftRestored)sessionStorage.setItem('tabletouch:application-draft',JSON.stringify({businessType,ownerName,restaurantName,slug,phone,address,fssai,gst,tableCount,currencyCode,timeZone,welcomeMessage,servicePlan}));},[draftRestored,businessType,ownerName,restaurantName,slug,phone,address,fssai,gst,tableCount,currencyCode,timeZone,welcomeMessage,servicePlan]);

  const continueWithAccount=async()=>{
    if(!supabase){setError('Add your Supabase project URL and publishable key before accepting applications.');return;}
    setError('');setMessage('');setWorking(true);
    try{
      const {data:sessionData,error:sessionError}=await supabase.auth.getSession();if(sessionError)throw sessionError;
      if(sessionData.session){const {data,error:authError}=await supabase.auth.getUser();if(authError)throw authError;if(data.user){setAccount({id:data.user.id,email:data.user.email||email});setMessage('You are signed in. Complete the restaurant details and attach a business proof.');return;}}
      if(verificationPending||needsOwnerSignIn){
        if(!email.trim()||!password){throw new Error('Enter your account email and password to finish signing in.');}
        const {data,error:signInError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if(signInError){if(signInError.code==='email_not_confirmed')throw new Error('Verify your email using the link we sent, then return here and select “I verified my email”.');throw signInError;}
        const activeSession=await requireAuthSession(supabase,data.session);
        setAccount({id:activeSession.user.id,email:activeSession.user.email||email});
        setVerificationPending(false);setNeedsOwnerSignIn(false);setPassword('');
        setMessage('You are signed in. Complete the restaurant details and attach a business proof.');
        return;
      }
      const result=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:ownerName.trim()},emailRedirectTo:`${window.location.origin}/auth/callback?next=%2Fregister`}});
      if(result.error)throw result.error;
      if(result.data.user&&result.data.session){const activeSession=await requireAuthSession(supabase,result.data.session);setAccount({id:activeSession.user.id,email:activeSession.user.email||email});setPassword('');setMessage('Account created. Complete the restaurant details below.');}
      else{setVerificationPending(true);setMessage('We sent a verification link to your email. Open it, then return here. We will sign you in and continue the application.');}
    }catch(issue){setError(issue instanceof Error?issue.message:'Could not create your account.');}
    finally{setWorking(false);}
  };

  const submit=async(event:FormEvent)=>{
    event.preventDefault();setError('');setMessage('');if(!supabase){setError('Add your Supabase project URL and publishable key before accepting applications.');return;}
    if(!account){await continueWithAccount();return;}
    if(proofs.length===0){setError('Attach at least one business registration, tax record, licence, or other business proof.');return;}
    if(proofs.some(file=>!allowed.has(file.type)||file.size>10*1024*1024)){setError('Proofs must be PDF, JPG, PNG, or WebP files under 10 MB each.');return;}
    setWorking(true);
    const uploaded:string[]=[];
    try{
      const activeSession=await requireAuthSession(supabase);
      if(activeSession.user.id!==account.id)throw new Error('Your signed-in account changed. Sign in again with the owner email used for this application.');
      const paths:string[]=[];
      for(const file of proofs){const ext=file.name.split('.').pop()?.toLowerCase()||'bin';const path=`applications/${account.id}/${crypto.randomUUID()}.${ext}`;const {error:uploadError}=await supabase.storage.from('business-proofs').upload(path,file,{contentType:file.type,upsert:false});if(uploadError)throw uploadError;uploaded.push(path);paths.push(path);}
      const finalSlug=slugify(slug||generatedSlug);
      const {data,error:submitError}=await supabase.rpc('register_hospitality_business',{p_business_type:businessType,p_slug:finalSlug,p_name:restaurantName.trim(),p_owner_name:ownerName.trim(),p_phone:phone.trim(),p_address:address.trim(),p_fssai_number:fssai.trim(),p_gst_number:gst.trim(),p_document_paths:paths,p_resource_count:tableCount,p_currency_code:currencyCode.trim().toUpperCase(),p_time_zone:timeZone.trim(),p_welcome_message:welcomeMessage.trim(),p_service_plan:servicePlan});
      if(submitError)throw submitError;
      sessionStorage.removeItem('tabletouch:application-draft');
      router.push(`/register/submitted?id=${encodeURIComponent(data)}`);
    }catch(issue){if(uploaded.length)await supabase.storage.from('business-proofs').remove(uploaded);const detail=issue instanceof Error?issue.message:'Could not submit the application.';if(/session is missing|session has expired|auth session missing/i.test(detail)){setAccount(null);setNeedsOwnerSignIn(true);setError('Your owner sign-in expired before the application finished. Sign in again below; your restaurant details are saved. Reattach the proof files if needed.');}else setError(detail);}
    finally{setWorking(false);}
  };

  const showSupabaseError=!isSupabaseConfigured();
  return <main className="tracking-page onboarding-page"><section className="tracking-card onboarding-card">
    <Link className="tracking-back" href="/"><ArrowLeft size={14}/> Back to Tabletouch</Link>
    <div className="onboarding-icon"><ShieldCheck size={22}/></div><span className="eyebrow"><span/> TABLETOUCH ONBOARDING</span><h1>Bring your {businessLabel} online.</h1>
    <p>Create an owner account, submit your business details and attach business proof. Tabletouch checks each application before any customer service page can go live.</p>
    {showSupabaseError&&<div className="form-error">Supabase is not connected yet. Configure the two public Supabase environment values to activate applications.</div>}
    <form className="onboarding-form" onSubmit={submit}><fieldset className="business-type-picker"><legend>Business type</legend><button type="button" className={businessType==='restaurant'?'selected':''} onClick={()=>setBusinessType('restaurant')}>Restaurant, café or lounge</button><button type="button" className={businessType==='hotel'?'selected':''} onClick={()=>setBusinessType('hotel')}>Hotel or serviced accommodation</button></fieldset>
      {!account?<>
        <h2>{needsOwnerSignIn?'Sign in to continue':'Owner account'}</h2>
        {!needsOwnerSignIn&&<label>Owner’s full name<input required minLength={2} maxLength={100} value={ownerName} onChange={e=>setOwnerName(e.target.value)} autoComplete="name"/></label>}
        <label>Business email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></label>
        <label>Password <small>Use at least 10 characters.</small><input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
        <button className="button button-dark full-button" type="button" disabled={working||showSupabaseError} onClick={continueWithAccount}>{working?<LoaderCircle className="spin" size={16}/>:null}{needsOwnerSignIn?'Sign in and continue':verificationPending?'I verified my email — sign in':'Create owner account and continue'}</button>
        <p className="onboarding-split">Already registered? <Link href="/restaurant/login">Sign in to continue</Link></p>
      </>:<>
        <div className="account-confirmed"><CheckCircle2 size={17}/><span>Signed in as <b>{account.email}</b></span></div>
        <h2>{businessType==='hotel'?'Property details':'Restaurant details'}</h2>
        <label>TableTouch service plan<select value={servicePlan} onChange={event=>setServicePlan(event.target.value as ServicePlanCode)}>{servicePlans.map(plan=><option key={plan.code} value={plan.code}>{plan.name} — {plan.price} {plan.price==='Free'?'':plan.cadence}</option>)}</select><small>{servicePlanByCode(servicePlan).description}</small></label>
        <label>{businessType==='hotel'?'Hotel or property name':'Restaurant name'}<input required minLength={2} maxLength={120} value={restaurantName} onChange={e=>{setRestaurantName(e.target.value);setSlug('')}}/></label>
        <label>Public page address <small>Guests receive this link from their {businessType==='hotel'?'room':'table'} QR or NFC tag.</small><div className="slug-input"><span>{publicPrefix}</span><input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug||generatedSlug} onChange={e=>setSlug(e.target.value.toLowerCase())} placeholder={businessType==='hotel'?'your-hotel':'your-restaurant'}/></div></label>
        <div className="onboarding-two-col"><label>Owner phone<input required minLength={7} maxLength={20} value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="tel"/></label><label>Number of {resourceLabel}<input required type="number" min={1} max={businessType==='hotel'?1000:100} value={tableCount} onChange={e=>setTableCount(Number(e.target.value))}/></label></div>
        <label>{businessType==='hotel'?'Property address':'Restaurant address'}<textarea required minLength={5} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)}/></label>
        {businessType==='hotel'&&<><div className="onboarding-two-col"><label>Currency code<input required pattern="[A-Za-z]{3}" maxLength={3} value={currencyCode} onChange={e=>setCurrencyCode(e.target.value.toUpperCase())}/></label><label>Time zone<input required maxLength={80} value={timeZone} onChange={e=>setTimeZone(e.target.value)} placeholder="Asia/Kolkata"/></label></div><label>Welcome message <small>Shown on room QR and NFC pages.</small><textarea maxLength={500} value={welcomeMessage} onChange={e=>setWelcomeMessage(e.target.value)} placeholder="Welcome to our hotel."/></label></>}
        <div className="onboarding-two-col"><label>FSSAI number <small>If applicable</small><input maxLength={30} value={fssai} onChange={e=>setFssai(e.target.value)}/></label><label>GST number <small>If applicable</small><input maxLength={30} value={gst} onChange={e=>setGst(e.target.value)}/></label></div>
        <label className="proof-upload"><span><FileCheck2 size={17}/> Business proof documents</span><small>FSSAI, GST, shop registration, or other legal business proof. PDF, JPG, PNG, WebP · max 10 MB per file.</small><input required type="file" accept=".pdf,image/jpeg,image/png,image/webp" multiple onChange={e=>setProofs(Array.from(e.target.files||[]))}/>{proofs.length>0&&<b>{proofs.map(file=>file.name).join(' · ')}</b>}</label>
        <button className="button button-dark full-button" disabled={working||showSupabaseError}>{working?<LoaderCircle className="spin" size={16}/>:<ShieldCheck size={16}/>} Submit for verification</button>
      </>}
      {error&&<div className="form-error" role="alert">{error}</div>}{message&&<div className="form-success" role="status">{message}{!account&&verificationPending&&<button type="button" onClick={continueWithAccount}>I verified my email</button>}</div>}
    </form>
    <small className="onboarding-privacy">Business documents are stored in a private bucket. Only the applying owner and verified Tabletouch administrators can access them.</small>
  </section></main>;
}
