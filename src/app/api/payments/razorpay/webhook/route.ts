import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { paymentAdmin } from '@/lib/payments';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const raw=await request.text();
  const signature=request.headers.get('x-razorpay-signature')||'';
  const secret=process.env.RAZORPAY_WEBHOOK_SECRET;
  if(!secret||!signature)return NextResponse.json({error:'Webhook is not configured.'},{status:401});
  const expected=createHmac('sha256',secret).update(raw).digest('hex');
  if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
  try{
    const event=JSON.parse(raw) as {event?:string;payload?:{payment?:{entity?:{id?:string;order_id?:string;status?:string;amount?:number;currency?:string}}}};
    const paymentEntity=event.payload?.payment?.entity;
    const eventKey=createHash('sha256').update(paymentEntity?.id?`${event.event||''}:${paymentEntity.id}`:raw).digest('hex');
    const admin=paymentAdmin();
    const {error:insertError}=await admin.from('payment_provider_events').insert({provider:'razorpay',event_key:eventKey,payload:event});
    if(insertError?.code==='23505')return NextResponse.json({received:true,duplicate:true});
    if(insertError)throw insertError;
    if(event.event==='payment.captured'&&paymentEntity?.order_id&&paymentEntity.id){
      const {data:storedPayment,error:lookupError}=await admin.from('payments').select('id,restaurant_id,dining_session_id,amount,currency,status').eq('provider_order_id',paymentEntity.order_id).maybeSingle();
      if(lookupError)throw lookupError;
      if(!storedPayment){await admin.from('payment_provider_events').update({processed_at:new Date().toISOString()}).eq('event_key',eventKey);return NextResponse.json({received:true,ignored:true});}
      const expectedAmount=Math.round(Number(storedPayment?.amount||0)*100);
      const matchesStoredPayment=paymentEntity.amount===expectedAmount&&paymentEntity.currency===storedPayment.currency;
      if(!matchesStoredPayment){await admin.from('payment_provider_events').update({processed_at:new Date().toISOString()}).eq('event_key',eventKey);return NextResponse.json({received:true,ignored:true});}
      const {data:payment,error:paymentError}=await admin.from('payments').update({status:'paid',provider_payment_id:paymentEntity.id,paid_at:new Date().toISOString()}).eq('id',storedPayment.id).neq('status','paid').select('id,restaurant_id,dining_session_id,amount,currency').maybeSingle();
      if(paymentError)throw paymentError;
      if(payment){
        const receiptNumber=`TT-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${payment.id.slice(0,8).toUpperCase()}`;
        const {error:receiptError}=await admin.from('receipts').insert({restaurant_id:payment.restaurant_id,dining_session_id:payment.dining_session_id,payment_id:payment.id,receipt_number:receiptNumber,amount:payment.amount,currency:payment.currency});
        if(receiptError?.code!=='23505'&&receiptError)throw receiptError;
      }
    }else if(event.event==='payment.failed'&&paymentEntity?.order_id){
      const {error}=await admin.from('payments').update({status:'failed',provider_payment_id:paymentEntity.id||null}).eq('provider_order_id',paymentEntity.order_id).neq('status','paid');
      if(error)throw error;
    }
    await admin.from('payment_provider_events').update({processed_at:new Date().toISOString()}).eq('event_key',eventKey);
    return NextResponse.json({received:true});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Webhook processing failed.'},{status:500});}
}
