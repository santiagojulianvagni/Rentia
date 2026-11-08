
export const TRIAL_DAYS=14;
export const TRIAL_TEAM_SIZE=2;

export type PlanId='free'|'starter'|'growth'|'pro'|'scale'|'enterprise';

export type RentiaPlan={
  id:PlanId;
  name:string;
  orders:number|null;
  monthlyPrice:number|null;
  users:number|null;
  // Meses de historial que se ven en el panel. null = todo. Los datos se guardan siempre.
  historyMonths:number|null;
  history:string;
  support:string;
  description:string;
};

export const RENTIA_PLANS:RentiaPlan[]=[
  {id:'free',name:'Gratis',orders:50,monthlyPrice:0,users:1,historyMonths:12,history:'Últimos 12 meses',support:'Email',description:'Para conocer Rentia y ordenar los primeros números.'},
  {id:'starter',name:'Starter',orders:300,monthlyPrice:15,users:2,historyMonths:12,history:'Últimos 12 meses',support:'Email',description:'Para tiendas que empiezan a medir la ganancia real.'},
  {id:'growth',name:'Growth',orders:1000,monthlyPrice:39,users:5,historyMonths:24,history:'Últimos 24 meses',support:'Prioritario',description:'Para equipos que ya toman decisiones todos los días.'},
  {id:'pro',name:'Pro',orders:5000,monthlyPrice:99,users:10,historyMonths:36,history:'Últimos 36 meses',support:'Prioritario',description:'Para operaciones en crecimiento con varios canales.'},
  {id:'scale',name:'Scale',orders:10000,monthlyPrice:149,users:20,historyMonths:36,history:'Últimos 36 meses',support:'Prioritario',description:'Para tiendas de alto volumen y equipos más grandes.'},
  {id:'enterprise',name:'Enterprise',orders:null,monthlyPrice:null,users:null,historyMonths:null,history:'Todo el historial',support:'Dedicado',description:'Para más de 10.000 órdenes y necesidades a medida.'},
];

export function getPlan(id:string|null|undefined) {
  return RENTIA_PLANS.find(plan=>plan.id===id)||RENTIA_PLANS[0];
}

// A saved preference or a volume recommendation never grants paid entitlements.
export function teamEntitlement(subscription:{plan_id:string;status:string;trial_ends_at:string}|null,now=Date.now()) {
  if(!subscription)return {limit:1 as number|null,planName:'Gratis'};
  if(subscription.status==='trialing'&&new Date(subscription.trial_ends_at).getTime()>now) {
    return {limit:TRIAL_TEAM_SIZE,planName:'Prueba de 14 días'};
  }
  const plan=getPlan(['active','past_due'].includes(subscription.status)?subscription.plan_id:'free');
  return {limit:plan.users,planName:plan.name};
}

// Meses de historial que ve la tienda según su plan. La prueba gratis ve lo mismo que Gratis
// (al conectar se importan 12 meses). Un plan solo elegido, sin pagar, no amplía el historial.
export function historyEntitlement(subscription:{plan_id:string;status:string;trial_ends_at:string}|null) {
  const plan=getPlan(subscription&&['active','past_due'].includes(subscription.status)?subscription.plan_id:'free');
  return {months:plan.historyMonths,planName:plan.name};
}

// Primer día visible (AAAA-MM-DD) para una cantidad de meses hacia atrás desde hoy.
export function historyStartDate(months:number,now=new Date()) {
  const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-months,1));
  const lastDay=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate();
  start.setUTCDate(Math.min(now.getUTCDate(),lastDay));
  return start.toISOString().slice(0,10);
}

export function recommendedPlan(orderCount:number) {
  return RENTIA_PLANS.find(plan=>plan.orders!==null&&orderCount<=plan.orders)||RENTIA_PLANS[RENTIA_PLANS.length-1];
}

export function annualPrice(plan:RentiaPlan) {
  return plan.monthlyPrice===null?null:plan.monthlyPrice*10;
}

export function planQuote(plan:RentiaPlan,annual:boolean) {
  const total=annual?annualPrice(plan):plan.monthlyPrice;
  return {total,monthlyEquivalent:total===null?null:annual?total/12:total,savings:annual&&plan.monthlyPrice!==null?plan.monthlyPrice*2:0};
}
