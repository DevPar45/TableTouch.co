import { BillLine, Restaurant } from '@/data';

export type BillTotals = { subtotal:number; serviceRate:number; serviceLabel:string; serviceCharge:number; taxRate:number; tax:number; total:number };
const roundMoney=(amount:number)=>Math.round((amount+Number.EPSILON)*100)/100;

/** Bill-level calculation: service charge is applied once to all ordered items,
 * then the configured tax rate is applied to food plus service charge. */
export function calculateBill(lines:BillLine[],restaurant:Restaurant,config?:{taxRate?:number;serviceChargeRate?:number;serviceChargeLabel?:string}):BillTotals{
  const subtotal=roundMoney(lines.reduce((sum,line)=>sum+line.price*line.quantity,0));
  const serviceRate=Math.max(0,Number(config?.serviceChargeRate??restaurant.serviceChargeRate??0));
  const serviceCharge=roundMoney(subtotal*serviceRate/100);
  const taxRate=Math.max(0,Number(config?.taxRate??restaurant.taxRate??0));
  const tax=roundMoney((subtotal+serviceCharge)*taxRate/100);
  return {subtotal,serviceRate,serviceLabel:config?.serviceChargeLabel?.trim()||restaurant.serviceChargeLabel?.trim()||'Service charge',serviceCharge,taxRate,tax,total:roundMoney(subtotal+serviceCharge+tax)};
}
