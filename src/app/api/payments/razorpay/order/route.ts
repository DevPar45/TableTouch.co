import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paymentAdmin, paymentConfig, publicSupabaseConfig } from '@/lib/payments';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  try{
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if(!token)return NextResponse.json({error:'Sign in is required.'},{status:401});
    const {url,key}=publicSupabaseConfig();
    const authClient=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:{user},error:authError}=await authClient.auth.getUser(token);
    if(authError||!user)return NextResponse.json({error:'Invalid sign-in session.'},{status:401});
    const body=await request.json() as {diningSessionId?:string};
    if(!body.diningSessionId)return NextResponse.json({error:'Dining session is required.'},{status:400});
    const admin=paymentAdmin();
    const {data:session,error:sessionError}=await admin.from('dining_sessions').select('id,restaurant_id,status,bill_total').eq('id',body.diningSessionId).maybeSingle();
    if(sessionError||!session||session.status!=='closed'||Number(session.bill_total)<=0)return NextResponse.json({error:'Finalize a non-zero bill before collecting payment.'},{status:409});
    const {data:member}=await admin.from('restaurant_members').select('role').eq('restaurant_id',session.restaurant_id).eq('user_id',user.id).in('role',['owner','manager']).maybeSingle();
    if(!member)return NextResponse.json({error:'Restaurant manager access required.'},{status:403});
    const {data:existing}=await admin.from('payments').select('id,status,provider_order_id').eq('dining_session_id',session.id).in('status',['created','paid']).order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(existing?.status==='paid')return NextResponse.json({error:'This bill has already been paid.'},{status:409});
    if(existing?.provider_order_id)return NextResponse.json({paymentId:existing.id,orderId:existing.provider_order_id,reused:true});
    const config=paymentConfig();
    const receipt=`tt_${session.id.replaceAll('-','').slice(0,20)}`;
    const providerResponse=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{'content-type':'application/json',authorization:`Basic ${Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64')}`},body:JSON.stringify({amount:Math.round(Number(session.bill_total)*100),currency:'INR',receipt,notes:{dining_session_id:session.id,restaurant_id:session.restaurant_id}})});
    if(!providerResponse.ok)return NextResponse.json({error:'Razorpay could not create a payment order.'},{status:502});
    const providerOrder=await providerResponse.json() as {id:string};
    const {data:payment,error:paymentError}=await admin.from('payments').insert({restaurant_id:session.restaurant_id,dining_session_id:session.id,provider:'razorpay',provider_order_id:providerOrder.id,amount:Number(session.bill_total),metadata:{created_by:user.id}}).select('id').single();
    if(paymentError)throw paymentError;
    return NextResponse.json({paymentId:payment.id,orderId:providerOrder.id,amount:Math.round(Number(session.bill_total)*100),currency:'INR',keyId:config.razorpayKeyId});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Unable to create payment order.'},{status:503});}
}
