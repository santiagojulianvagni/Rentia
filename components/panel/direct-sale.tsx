'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { DIRECT_CHANNELS, DIRECT_CHANNEL_LABELS, DIRECT_PAYMENTS, DIRECT_PAYMENT_LABELS, directChannelOf, directSaleProfit, paymentHasFee, type DirectChannel, type DirectPayment } from '../../lib/direct-sales';
import { confirmDialog } from './rp-confirm';

type Variant={variant_id:number;product_name:string;sku:string|null;price:number;effective_cost:number;stock:number|null;rentia_archived:number};
type Line={variantId:number;name:string;sku:string|null;quantity:string;price:string;cost:number;stock:number|null};
type Sale={external_order_id:string;order_number:string;provider:string;payment_method:string|null;total:number;source_created_at:string;sale_note:string|null;items:Array<{name:string;quantity:number;unitPrice:number}>};

const todayAR=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const amount=(value:string)=>{const number=Number((value||'').replace(/\./g,'').replace(',','.'));return Number.isFinite(number)&&number>=0?number:0;};
const ERRORS:Record<string,string>={invalid_date:'Elegí una fecha de hoy o anterior.',empty_sale:'Agregá al menos un producto o el monto de la venta.',invalid_products:'Algún producto ya no está en tu catálogo. Sacalo y volvé a agregarlo.'};

// Registrar una venta cerrada fuera de los canales conectados (WhatsApp, Instagram, en persona…).
// Entra como una orden más: con sus productos y su costo real, y descuenta el stock en Rentia.
export default function DirectSale({money,canManage,onChanged}:{money:(value:number)=>string;canManage:boolean;onChanged:()=>Promise<unknown>}) {
  const [catalog,setCatalog]=useState<Variant[]>([]);
  const [sales,setSales]=useState<Sale[]|null>(null);
  const [taxPercent,setTaxPercent]=useState(0);
  const [commissionPercent,setCommissionPercent]=useState(0);
  const [date,setDate]=useState(todayAR);
  const [channel,setChannel]=useState<DirectChannel>('whatsapp');
  const [payment,setPayment]=useState<DirectPayment>('transferencia');
  const [lines,setLines]=useState<Line[]>([]);
  const [query,setQuery]=useState('');
  const [onlyAmount,setOnlyAmount]=useState(false);
  const [total,setTotal]=useState('');
  const [goodsCost,setGoodsCost]=useState('');
  const [commission,setCommission]=useState('');
  const [shipping,setShipping]=useState('');
  const [note,setNote]=useState('');
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState('');

  const loadSales=useCallback(async()=>{
    const response=await fetch('/api/sales/direct',{cache:'no-store'});
    if(!response.ok)throw new Error();
    const data=await response.json() as {sales:Sale[];taxPercent:number;commissionPercent:number};
    setSales(data.sales);setTaxPercent(data.taxPercent);setCommissionPercent(data.commissionPercent);
  },[]);
  useEffect(()=>{
    queueMicrotask(()=>{
      loadSales().catch(()=>setSales([]));
      fetch('/api/costs/products',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(data=>setCatalog(Array.isArray(data?.products)?(data.products as Variant[]).filter(row=>!Number(row.rentia_archived)):[])).catch(()=>undefined);
    });
  },[loadSales]);

  const matches=useMemo(()=>{
    const text=query.trim().toLocaleLowerCase('es-AR');
    if(text.length<2)return [];
    return catalog.filter(row=>`${row.product_name} ${row.sku||''}`.toLocaleLowerCase('es-AR').includes(text)).slice(0,6);
  },[catalog,query]);

  const saleTotal=onlyAmount?amount(total):lines.reduce((sum,line)=>sum+amount(line.quantity)*amount(line.price),0);
  const productCost=onlyAmount?amount(goodsCost):lines.reduce((sum,line)=>sum+amount(line.quantity)*line.cost,0);
  const hasFee=paymentHasFee(payment);
  const suggestedFee=Math.round(saleTotal*commissionPercent/100);
  const fee=hasFee?(commission.trim()?amount(commission):suggestedFee):0;
  const result=directSaleProfit({total:saleTotal,productCost,shipping:amount(shipping),commission:fee,taxPercent});
  const costMissing=onlyAmount?!goodsCost.trim():lines.some(line=>!(line.cost>0));

  function add(row:Variant) {
    setLines(current=>current.some(line=>line.variantId===row.variant_id)?current.map(line=>line.variantId===row.variant_id?{...line,quantity:String(amount(line.quantity)+1)}:line):[...current,{variantId:row.variant_id,name:row.product_name,sku:row.sku,quantity:'1',price:String(Math.round(Number(row.price)||0)),cost:Number(row.effective_cost)||0,stock:row.stock===null?null:Number(row.stock)}]);
    setQuery('');setMessage('');
  }
  const setLine=(id:number,patch:Partial<Line>)=>setLines(current=>current.map(line=>line.variantId===id?{...line,...patch}:line));

  async function submit(event:FormEvent) {
    event.preventDefault();
    if(!canManage||saving)return;
    if(!(saleTotal>0)){setMessage(onlyAmount?'Poné el monto de la venta.':'Agregá al menos un producto.');return;}
    setSaving(true);setMessage('');
    try {
      const body={date,channel,payment,commission:fee,shipping:amount(shipping),note:note.trim()||null,
        items:onlyAmount?[]:lines.map(line=>({variantId:line.variantId,quantity:Math.max(1,Math.round(amount(line.quantity))),unitPrice:amount(line.price)})),
        amount:onlyAmount?amount(total):null,productCost:onlyAmount&&goodsCost.trim()?amount(goodsCost):null};
      const response=await fetch('/api/sales/direct',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const data=await response.json().catch(()=>({})) as {sale?:{orderNumber:string};error?:string};
      if(!response.ok||!data.sale)throw new Error(data.error);
      setLines([]);setTotal('');setGoodsCost('');setCommission('');setShipping('');setNote('');setDate(todayAR());
      setMessage(`Listo: venta ${data.sale.orderNumber} registrada. Ya está en tu resumen.`);
      await Promise.all([loadSales().catch(()=>undefined),onChanged().catch(()=>undefined)]);
    } catch(error) {setMessage(ERRORS[error instanceof Error?error.message:'']||'No pudimos registrar la venta. Intentá de nuevo.');}
    finally {setSaving(false);}
  }

  async function remove(sale:Sale) {
    if(!await confirmDialog({title:`¿Borrar la venta ${sale.order_number}?`,message:`Sale del resumen y se devuelve al stock de Rentia lo que había descontado (${money(sale.total)}).`,confirmLabel:'Borrar venta',cancelLabel:'Cancelar',danger:true}))return;
    const response=await fetch('/api/sales/direct',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id:sale.external_order_id})}).catch(()=>null);
    if(!response?.ok){setMessage('No pudimos borrar la venta.');return;}
    await Promise.all([loadSales().catch(()=>undefined),onChanged().catch(()=>undefined)]);
  }

  const numberField=(label:string,value:string,set:(value:string)=>void,options:{placeholder?:string;hint?:string}={})=><label className="p-field"><span className="p-fieldLabel">{label}</span><span className="p-input"><b className="p-simAffix">$</b><input inputMode="decimal" value={value} placeholder={options.placeholder} onChange={event=>set(event.target.value.replace(/[^\d.,]/g,''))} disabled={!canManage||saving}/></span>{options.hint&&<small className="p-sub">{options.hint}</small>}</label>;

  return <>
    {canManage&&<form className="p-card p-reveal p-dsale" onSubmit={submit}>
      <div className="p-cardHead"><div><span className="p-eyebrowS">REGISTRAR UNA VENTA</span><h3>¿Vendiste por WhatsApp, Instagram o en persona?</h3><span className="p-sub">Cargala acá y entra en tu resumen con su ganancia real.</span></div></div>

      <div className="p-dsaleRow">
        <label className="p-field p-dsaleDate"><span className="p-fieldLabel">Fecha</span><span className="p-input"><input type="date" value={date} max={todayAR()} onChange={event=>setDate(event.target.value)} disabled={saving}/></span></label>
        <div className="p-field"><span className="p-fieldLabel">Canal</span><div className="p-simChips" role="group" aria-label="Canal de la venta">{DIRECT_CHANNELS.map(item=><button type="button" key={item} className={channel===item?'p-on':undefined} aria-pressed={channel===item} onClick={()=>setChannel(item)} disabled={saving}>{DIRECT_CHANNEL_LABELS[item]}</button>)}</div></div>
      </div>

      <div className="p-dsaleBlock">
        <div className="p-dsaleBlockHead"><span className="p-fieldLabel">{onlyAmount?'Monto de la venta':'Productos'}</span><button type="button" className="p-linkBtn" onClick={()=>{setOnlyAmount(value=>!value);setMessage('');}}>{onlyAmount?'Elegir los productos':'Prefiero poner solo el monto'}</button></div>
        {onlyAmount?<div className="p-simTwo">
          {numberField('Total cobrado',total,setTotal)}
          {numberField('Costo de la mercadería',goodsCost,setGoodsCost,{hint:'Opcional. Sin este dato, la ganancia de la venta queda pendiente.'})}
        </div>:<>
          <div className="p-simPick">
            <span className="p-input"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={catalog.length?'Buscá el producto por nombre o SKU':'Cargando tu catálogo…'} aria-label="Buscar producto" disabled={saving}/></span>
            {matches.length>0&&<ul className="p-simMatches">{matches.map(row=><li key={row.variant_id}><button type="button" onClick={()=>add(row)}><span>{row.product_name}{row.sku?<small className="p-sub"> · {row.sku}</small>:null}{row.stock!==null?<small className="p-sub"> · stock {row.stock}</small>:null}</span><b className="p-mono">{money(Number(row.price)||0)}</b></button></li>)}</ul>}
            {query.trim().length>=2&&!matches.length&&<small className="p-sub">No encontramos productos con esa búsqueda.</small>}
          </div>
          {lines.length>0&&<div className="p-dsaleLines">{lines.map(line=><div className="p-dsaleLine" key={line.variantId}>
            <div className="p-dsaleName"><b>{line.name}</b><small className="p-sub">{line.sku?`${line.sku} · `:''}{line.cost>0?`costo ${money(line.cost)}`:'sin costo cargado'}{line.stock!==null?` · stock ${line.stock}`:''}</small></div>
            <label className="p-dsaleQty"><span className="p-sub">Cant.</span><span className="p-input"><input inputMode="numeric" value={line.quantity} onChange={event=>setLine(line.variantId,{quantity:event.target.value.replace(/\D/g,'')})} aria-label={`Cantidad de ${line.name}`}/></span></label>
            <label className="p-dsalePrice"><span className="p-sub">Precio</span><span className="p-input"><b className="p-simAffix">$</b><input inputMode="decimal" value={line.price} onChange={event=>setLine(line.variantId,{price:event.target.value.replace(/[^\d.,]/g,'')})} aria-label={`Precio de ${line.name}`}/></span></label>
            <b className="p-mono p-dsaleSub">{money(amount(line.quantity)*amount(line.price))}</b>
            <button type="button" className="p-iconBtn" aria-label={`Sacar ${line.name}`} onClick={()=>setLines(current=>current.filter(item=>item.variantId!==line.variantId))}><X aria-hidden="true"/></button>
          </div>)}</div>}
        </>}
      </div>

      <div className="p-dsaleRow">
        <div className="p-field"><span className="p-fieldLabel">¿Cómo te pagó?</span><div className="p-simChips" role="group" aria-label="Medio de pago">{DIRECT_PAYMENTS.map(item=><button type="button" key={item} className={payment===item?'p-on':undefined} aria-pressed={payment===item} onClick={()=>setPayment(item)} disabled={saving}>{DIRECT_PAYMENT_LABELS[item]}</button>)}</div></div>
      </div>
      <div className="p-dsaleGrid">
        {hasFee&&numberField('Comisión que te cobraron',commission,setCommission,{placeholder:String(suggestedFee),hint:commissionPercent?`Si no la sabés, usamos tu promedio (${commissionPercent.toLocaleString('es-AR')} %).`:undefined})}
        {numberField('Envío que pagaste vos',shipping,setShipping,{placeholder:'0',hint:'Dejalo vacío si lo pagó el cliente o lo retiró.'})}
        <label className="p-field"><span className="p-fieldLabel">Cliente o nota <small className="p-sub">(opcional)</small></span><span className="p-input"><input value={note} maxLength={120} onChange={event=>setNote(event.target.value)} placeholder="Laura, pedido por WhatsApp" disabled={saving}/></span></label>
      </div>

      {saleTotal>0&&<div className="p-dsaleSummary" aria-live="polite">
        <span><small>Cobrado</small><b className="p-mono">{money(saleTotal)}</b></span>
        <span><small>Productos</small><b className="p-mono">− {money(productCost)}</b></span>
        {amount(shipping)>0&&<span><small>Envío</small><b className="p-mono">− {money(amount(shipping))}</b></span>}
        {fee>0&&<span><small>Comisión</small><b className="p-mono">− {money(fee)}</b></span>}
        {result.taxes>0&&<span><small>Impuestos ({taxPercent.toLocaleString('es-AR')} %)</small><b className="p-mono">− {money(result.taxes)}</b></span>}
        <span className="p-dsaleProfit"><small>Ganancia de esta venta</small>{costMissing?<b>Falta el costo</b>:<b className={`p-mono ${result.profit>=0?'p-pos':'p-neg'}`}>{money(result.profit)} <em>{Math.round(result.margin)} %</em></b>}</span>
      </div>}

      <div className="p-dsaleActions">
        <button type="submit" className="p-btn p-primary" disabled={saving}>{saving?'Registrando…':'Registrar venta'}</button>
        {message?<span className="p-sub" role="status">{message}</span>:!onlyAmount&&lines.some(line=>line.stock!==null)&&<span className="p-sub">Descuenta el stock en Rentia. Para no vender de más en tu tienda online, descontalo también en Tiendanube.</span>}
      </div>
    </form>}

    {sales&&sales.length>0&&<div className="p-card p-reveal p-dsaleList">
      <div className="p-cardHead"><div><span className="p-eyebrowS">VENTAS CARGADAS</span><h3>Últimas ventas directas</h3></div></div>
      <ul>{sales.map(sale=>{const channelName=DIRECT_CHANNEL_LABELS[directChannelOf(sale.provider)||'otro'];return <li key={sale.external_order_id}>
        <div><b>{sale.order_number} · {channelName}</b><small className="p-sub">{new Date(sale.source_created_at).toLocaleDateString('es-AR',{day:'numeric',month:'short',timeZone:'America/Argentina/Buenos_Aires'})} · {sale.payment_method}{sale.sale_note?` · ${sale.sale_note}`:''}</small><small className="p-sub">{sale.items.map(item=>`${item.quantity} × ${item.name}`).join(', ')}</small></div>
        <b className="p-mono">{money(sale.total)}</b>
        {canManage&&<button type="button" className="p-iconBtn" aria-label={`Borrar la venta ${sale.order_number}`} onClick={()=>void remove(sale)}><Trash2 aria-hidden="true"/></button>}
      </li>;})}</ul>
    </div>}
  </>;
}
