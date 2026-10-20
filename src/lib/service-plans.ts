export type ServicePlanCode = 'free_pilot'|'card_kit'|'digital_table'|'food_photography'|'complete';
type ServicePlan = {code:ServicePlanCode;name:string;price:string;cadence:string;description:string;features:readonly string[];popular?:boolean};

export const servicePlans: readonly ServicePlan[] = [
  {code:'free_pilot',name:'Free test plan',price:'Free',cadence:'for testing',description:'Try the TableTouch service flow before committing.',features:['Restaurant setup review','Private owner workspace','Menu and table-flow evaluation']},
  {code:'card_kit',name:'10 TableTouch cards',price:'₹6,999',cadence:'one-time',description:'A lifetime set of ten NFC and QR table cards.',features:['10 NFC + QR table cards','Stable table destinations','Card setup and activation']},
  {code:'digital_table',name:'Online menu + TableTouch',price:'₹999',cadence:'per table / month',description:'Live menu and table ordering for every connected table.',features:['Online menu and live ordering','Kitchen and service workflow','Named guest bills and table QR/NFC']},
  {code:'food_photography',name:'Menu photography',price:'₹9,999',cadence:'one-time',description:'Professional food photography prepared for your online menu.',features:['Photography for listed menu dishes','Online-menu ready images','Restaurant brand setup']},
  {code:'complete',name:'TableTouch Complete',price:'₹1,499',cadence:'per restaurant / month',description:'The full TableTouch service with ongoing maintenance.',features:['All listed TableTouch services','Card and menu support','Maintenance and priority support'],popular:true},
] as const;

export const isServicePlanCode=(value:string|null|undefined):value is ServicePlanCode=>servicePlans.some(plan=>plan.code===value);
export const servicePlanByCode=(code:ServicePlanCode)=>servicePlans.find(plan=>plan.code===code)!;
