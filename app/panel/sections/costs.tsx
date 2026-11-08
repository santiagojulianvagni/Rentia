'use client';

import RpSelect from '../../../components/panel/rp-select';
import { confirmDialog } from '../../../components/panel/rp-confirm';
import RpDate from '../../../components/panel/rp-date';
import { FormEvent, useContext, useState } from 'react';
import { Coins, CreditCard, Plus } from 'lucide-react';
import { PhysicalStores, ExchangeRateSettings, CostRule, AccessContext, usePreferences, useMoney, parseCost } from '../shared';

export function ExternalRevenueSection({onChanged}:{onChanged:()=>Promise<unknown>}) {
  return <PhysicalStores onChanged={onChanged} money={useMoney()} canManage={useContext(AccessContext)}/>;
}

export function ExchangeRateSection({onChanged}:{onChanged:()=>Promise<unknown>}) {
  const {refreshRates}=usePreferences();
  return <ExchangeRateSettings onChanged={onChanged} onRatesChanged={refreshRates}/>;
}

export function AdvancedCostRules({rules,paymentMethods,onChanged}:{rules:CostRule[];paymentMethods:string[];onChanged:()=>Promise<void>}) {
  const money=useMoney();
  const [method,setMethod]=useState('');
  const [commissionPercent,setCommissionPercent]=useState('');
  const [commissionFixed,setCommissionFixed]=useState('');
  const [expenseName,setExpenseName]=useState('');
  const [expenseType,setExpenseType]=useState<'fixed_monthly'|'percentage_revenue'>('fixed_monthly');
  const [expenseValue,setExpenseValue]=useState('');
  const [expenseStart,setExpenseStart]=useState('');
  const [expenseEnd,setExpenseEnd]=useState('');
  const [expenseDueDay,setExpenseDueDay]=useState('');
  const [ruleState,setRuleState]=useState('');
  const [saving,setSaving]=useState(false);

  async function requestRule(body:Record<string,unknown>) {
    if(saving)return false;
    setSaving(true);setRuleState('Guardando y recalculando…');
    try {
      const response=await fetch('/api/costs/rules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      if(!response.ok){setRuleState('No se guardó la regla. Revisá los valores y tus permisos.');return false;}
      await onChanged();setRuleState('Regla guardada y aplicada al historial.');return true;
    } catch {setRuleState('No pudimos confirmar el guardado. Recargá para verificar antes de agregarla otra vez.');return false;}
    finally {setSaving(false);}
  }

  async function addCommission(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name=method.trim(),percentage=parseCost(commissionPercent||'0'),amount=parseCost(commissionFixed||'0');
    if(!name||!Number.isFinite(percentage)||percentage<0||percentage>100||!Number.isFinite(amount)||amount<0||(!percentage&&!amount)){setRuleState('Ingresá un medio de pago y una comisión mayor a cero. El porcentaje no puede superar 100.');return;}
    if(rules.some(rule=>rule.category==='commission'&&rule.match_value?.trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'))){setRuleState('Ya existe una regla para este medio de pago. Revisá la lista antes de agregar otra.');return;}
    const ok=await requestRule({category:'commission',name,matchValue:name,percentage,amount});
    if (ok) {setMethod('');setCommissionPercent('');setCommissionFixed('');}
  }

  async function addExpense(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value=parseCost(expenseValue||'0');
    const ok=await requestRule({category:'additional',name:expenseName,calculation:expenseType,amount:expenseType==='fixed_monthly'?value:0,percentage:expenseType==='percentage_revenue'?value:0,startsAt:expenseStart||null,endsAt:expenseEnd||null,dueDay:expenseType==='fixed_monthly'&&expenseDueDay?Number(expenseDueDay):null});
    if (ok) {setExpenseName('');setExpenseValue('');setExpenseStart('');setExpenseEnd('');setExpenseDueDay('');}
  }

  async function removeRule(id:number) {
    if(saving||!await confirmDialog({title:'¿Eliminar esta regla?',message:'La rentabilidad histórica se recalculará sin ella.',confirmLabel:'Eliminar',danger:true}))return;
    setSaving(true);
    setRuleState('Eliminando y recalculando…');
    try {
      const response=await fetch('/api/costs/rules',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({id})});
      if(response.ok){await onChanged();setRuleState('Regla eliminada. El historial fue recalculado.');}
      else setRuleState('No pudimos eliminar la regla.');
    } catch {setRuleState('No pudimos confirmar la eliminación. Recargá para verificar la lista.');}
    finally {setSaving(false);}
  }

  const commissionRules=rules.filter(rule=>rule.category==='commission');
  const expenseRules=rules.filter(rule=>rule.category==='additional');
  const ruleList=(items:CostRule[],empty:string)=><div>{items.map(rule=><div className="p-ruleRow" key={rule.id}><span><b>{rule.name}</b><small>{rule.category==='commission'?`${rule.percentage||0}%${rule.amount?` + ${money(rule.amount)} por orden`:''}`:rule.calculation==='fixed_monthly'?`${money(rule.amount)} por mes${rule.due_day?` · se paga el día ${rule.due_day}`:''}`:`${rule.percentage}% de facturación`}{rule.starts_at||rule.ends_at?` · ${rule.starts_at||'Inicio'} → ${rule.ends_at||'Sin fin'}`:''}</small></span><button type="button" className="p-btn p-small p-ghost" disabled={saving} onClick={()=>void removeRule(rule.id)}>Eliminar</button></div>)}{!items.length&&empty&&<p className="p-sub">{empty}</p>}</div>;

  return <div className="p-customRules">
    <section className="p-block p-reveal" style={{'--i':3,marginTop:14} as React.CSSProperties} aria-labelledby="custom-payment-title">
      <div className="p-blockHead"><span className="p-bIcon"><CreditCard aria-hidden="true"/></span><div><div className="p-num">04 · PAGOS PERSONALIZADOS</div><h3 id="custom-payment-title">Una regla para cada medio</h3><p>Para transferencias, pasarelas u otros medios sin cargo exacto ni estimación de Pago Nube. La regla reemplaza la comisión general; no se suma a ella.</p></div><span className="p-chip p-c">Se guarda al agregar</span></div>
      <form onSubmit={addCommission}><fieldset disabled={saving} className="p-cfgFields">
        <label className="p-field"><span className="p-fieldLabel">Medio de pago</span><span className="p-input"><input value={method} onChange={event=>{setMethod(event.target.value);setRuleState('')}} maxLength={80} placeholder="Escribí el nombre del medio" required/></span></label>
        {!!paymentMethods.length&&<div className="p-detectedRow"><span className="p-sub">Detectados en el período seleccionado</span>{paymentMethods.map(value=><button key={value} type="button" className={`p-chipBtn ${method===value?'p-on':''}`} aria-pressed={method===value} onClick={()=>{setMethod(value);setRuleState('')}}>{value}</button>)}</div>}
        <div className="p-commRow"><label className="p-field"><span className="p-fieldLabel">Comisión porcentual</span><span className="p-input"><input type="number" min="0" max="100" step="0.01" value={commissionPercent} onChange={event=>setCommissionPercent(event.target.value)} inputMode="decimal" placeholder="0"/><span>%</span></span></label><span className="p-plus" aria-hidden="true">+</span><label className="p-field"><span className="p-fieldLabel">Fijo por orden</span><span className="p-input"><span>ARS</span><input type="number" min="0" step="0.01" value={commissionFixed} onChange={event=>setCommissionFixed(event.target.value)} inputMode="decimal" placeholder="0"/></span></label><button className="p-btn" type="submit" disabled={saving}><Plus className="p-i" aria-hidden="true"/>Agregar comisión</button></div>
        <small className="p-sub">El nombre debe coincidir con el medio informado en la orden. Completá el porcentaje, el monto fijo o ambos según tu acuerdo.</small>
      </fieldset></form>
      <div className="p-rulesHead"><b>Reglas por medio de pago</b><span className="p-chip p-n">{commissionRules.length}</span></div>
      {ruleList(commissionRules,'No hay reglas personalizadas. Se respeta el cargo importado o el respaldo disponible.')}
    </section>

    <section className="p-block p-reveal" style={{'--i':4} as React.CSSProperties} aria-labelledby="additional-title">
      <div className="p-blockHead"><span className="p-bIcon"><Coins aria-hidden="true"/></span><div><div className="p-num">05 · OTROS COSTOS</div><h3 id="additional-title">Gastos de tu operación</h3><p>Agencia, software o depósito: se distribuyen proporcionalmente entre las ventas. No cargues acá un costo que ya descontaste en otra sección.</p></div><span className="p-chip p-n">Opcional</span></div>
      <details className="p-subcard">
        <summary><b>Agregar un gasto adicional</b><Plus className="p-i" aria-hidden="true"/></summary>
        <form onSubmit={addExpense} style={{marginTop:12}}><fieldset disabled={saving} className="p-cfgFields"><div className="p-grid p-g2">
          <label className="p-field" style={{gridColumn:'1/-1'}}><span className="p-fieldLabel">Nombre del gasto</span><span className="p-input"><input value={expenseName} onChange={event=>setExpenseName(event.target.value)} maxLength={80} placeholder="Ej.: agencia de marketing" required/></span></label>
          <label className="p-field"><span className="p-fieldLabel">Forma de cálculo</span><span className="p-input"><RpSelect value={expenseType} onChange={event=>setExpenseType(event.target.value as 'fixed_monthly'|'percentage_revenue')}><option value="fixed_monthly">Importe mensual</option><option value="percentage_revenue">% de facturación</option></RpSelect></span></label>
          <label className="p-field"><span className="p-fieldLabel">Valor</span><span className="p-input">{expenseType==='fixed_monthly'&&<span>ARS</span>}<input type="number" min="0.01" max={expenseType==='percentage_revenue'?100:undefined} step="0.01" value={expenseValue} onChange={event=>setExpenseValue(event.target.value)} inputMode="decimal" placeholder="0" required/>{expenseType==='percentage_revenue'&&<span>%</span>}</span></label>
          {expenseType==='fixed_monthly'&&<label className="p-field"><span className="p-fieldLabel">Día de pago · opcional</span><span className="p-input"><RpSelect value={expenseDueDay} onChange={event=>setExpenseDueDay(event.target.value)}><option value="">Sin día fijo</option>{Array.from({length:31},(_,index)=><option key={index+1} value={String(index+1)}>{`Día ${index+1}`}</option>)}</RpSelect></span></label>}
          <label className="p-field"><span className="p-fieldLabel">Desde · opcional</span><span className="p-input"><RpDate value={expenseStart} max={expenseEnd||undefined} onChange={event=>setExpenseStart(event.target.value)}/></span></label>
          <label className="p-field"><span className="p-fieldLabel">Hasta · opcional</span><span className="p-input"><RpDate value={expenseEnd} min={expenseStart||undefined} onChange={event=>setExpenseEnd(event.target.value)}/></span></label>
        </div><button className="p-btn" type="submit" disabled={saving} style={{marginTop:12}}><Plus className="p-i" aria-hidden="true"/>Agregar gasto</button></fieldset></form>
      </details>
      {!!expenseRules.length&&<><div className="p-rulesHead"><b>Gastos configurados</b><span className="p-chip p-n">{expenseRules.length}</span></div>{ruleList(expenseRules,'')}</>}
    </section>
    {ruleState&&<div className="p-note" role="status" aria-live="polite">{ruleState}</div>}
  </div>;
}

