import { createClient } from '@supabase/supabase-js';

export function paymentConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const razorpayKeyId=process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret=process.env.RAZORPAY_KEY_SECRET;
  if(!url||!serviceRoleKey||!razorpayKeyId||!razorpayKeySecret)throw new Error('Payment service is not configured.');
  return {url,serviceRoleKey,razorpayKeyId,razorpayKeySecret};
}

export function paymentAdmin(){
  const config=paymentConfig();
  return createClient(config.url,config.serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
}

export function publicSupabaseConfig(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)throw new Error('Supabase is not configured.');
  return {url,key};
}
