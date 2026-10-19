// Carritos abandonados: se guardan sin datos de contacto (solo fecha, importe y productos) y
// se resumen por período: cuántos, cuánta plata quedó en la mesa y qué productos se abandonan.
type UnknownRecord=Record<string,unknown>;
const record=(value:unknown):UnknownRecord=>value&&typeof value==='object'&&!Array.isArray(value)?value as UnknownRecord:{};
const text=(value:unknown)=>value===null||value===undefined?'':String(value).trim();
const number=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};

export type CartItem={name:string;quantity:number;price:number;productId:string|null;variantId:string|null};
export type AbandonedCart={externalId:string;createdAt:string;completedAt:string|null;total:number;currency:string;units:number;items:CartItem[]};

export function normalizeTiendanubeCheckout(row:UnknownRecord):AbandonedCart|null {
  const externalId=text(row.id);
  const createdAt=text(row.created_at);
  if(!externalId||!createdAt)return null;
  const items=(Array.isArray(row.products)?row.products:[]).map(value=>{
    const item=record(value);
    const name=typeof item.name==='string'?item.name:text(record(item.name).es)||'Producto';
    return {name:name.trim()||'Producto',quantity:Math.max(0,Math.round(number(item.quantity))),price:number(item.price),productId:text(item.product_id)||null,variantId:text(item.variant_id)||null};
  });
  return {externalId,createdAt,completedAt:text(row.completed_at)||null,total:number(row.total),currency:text(row.currency)||'ARS',units:items.reduce((sum,item)=>sum+item.quantity,0),items};
}

export function cartSummary(carts:AbandonedCart[],paidOrders:number) {
  const open=carts.filter(cart=>!cart.completedAt);
  const value=open.reduce((sum,cart)=>sum+cart.total,0);
  const products=new Map<string,{name:string;carts:number;units:number;value:number}>();
  for(const cart of open) {
    const seen=new Set<string>();
    for(const item of cart.items) {
      const key=item.productId||item.name;
      const row=products.get(key)||{name:item.name,carts:0,units:0,value:0};
      if(!seen.has(key)){row.carts++;seen.add(key);}
      row.units+=item.quantity;row.value+=item.quantity*item.price;
      products.set(key,row);
    }
  }
  const days=new Map<string,{date:string;carts:number;value:number}>();
  for(const cart of open){const date=cart.createdAt.slice(0,10);const day=days.get(date)||{date,carts:0,value:0};day.carts++;day.value+=cart.total;days.set(date,day);}
  return {
    count:open.length,value,average:open.length?value/open.length:0,
    recovered:carts.length-open.length,
    // De cada 100 compras que empezaron con datos de contacto, cuántas no se terminaron.
    rate:open.length+paidOrders?open.length/(open.length+paidOrders):0,
    topProducts:[...products.values()].sort((a,b)=>b.carts-a.carts||b.value-a.value).slice(0,10),
    daily:[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),
    recent:open.slice().sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,20),
  };
}
