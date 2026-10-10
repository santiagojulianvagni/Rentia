'use client';

import type { FormEvent } from 'react';
import { pagoNubePlan } from '../lib/pago-nube-fees';
import { Check, ChevronDown, ReceiptText, ShieldCheck, Truck } from 'lucide-react';
import ThemedSelect from './themed-select';

type Props = {
  shipping: string;
  shippingMode: 'actual' | 'average_only';
  fees: string;
  taxes: string;
  pagoNubePlan: string;
  // Plan name as Tiendanube reports it during the import (null until it does).
  detectedPlan: string | null;
  pagoNubePayoutDays: string;
  connected: boolean;
  loaded: boolean;
  saving: boolean;
  message: string;
  onShipping: (value: string) => void;
  onShippingMode: (value: 'actual' | 'average_only') => void;
  onFees: (value: string) => void;
  onTaxes: (value: string) => void;
  onPlan: (value: string) => void;
  onPayout: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const planLabels: Record<string, string> = { inicial: 'Inicial', esencial: 'Esencial', impulso: 'Impulso', escala: 'Escala' };

// The default option shows which plan Tiendanube reported, so it is clear
// whether the estimate already has a plan or one has to be chosen.
function detectedPlanOption(detected: string | null) {
  const plan = pagoNubePlan(detected);
  if (plan) return { label: `Detectado: ${planLabels[plan]}`, description: 'Informado por Tiendanube al importar' };
  if (detected) return { label: 'Plan no reconocido', description: `Tiendanube informa "${detected}"; elegí tu plan` };
  return { label: 'Sin plan detectado', description: 'Tiendanube todavía no informó el plan; elegilo para estimar' };
}

export default function ShippingCommissionSettings(props: Props) {
  const actual = props.shippingMode === 'actual';
  return <form className="deliverySettings" onSubmit={props.onSubmit}>
    <fieldset disabled={!props.loaded || props.saving}>
      <section className="deliveryBlock" aria-labelledby="shipping-title">
        <div className="deliveryBlockHeading">
          <div className="deliveryBlockTitle"><span className="deliverySymbol"><Truck size={23}/></span><div><span className="deliveryEyebrow">01 · ENVÍOS</span><h3 id="shipping-title">¿Cómo calculamos el envío?</h3></div></div>
          <span className="deliveryBadge">{actual ? 'Costo de la orden' : 'Personalizado'}</span>
        </div>
        <p className="deliveryIntro">Elegí el costo que paga tu tienda. No es lo mismo que el envío que le cobrás al cliente.</p>
        <div className="shippingChoices" role="radiogroup" aria-label="Forma de calcular el envío">
          <label className={`shippingChoice ${actual ? 'selected' : ''}`}>
            <input type="radio" name="shipping-mode" value="actual" checked={actual} onChange={() => props.onShippingMode('actual')}/>
            <span><span className="shippingChoiceTitle">Costo de envío de la orden <span className="deliveryRecommendation">Recomendado</span></span><small>Usamos el costo del comercio informado por Tiendanube en cada pedido.</small></span>
            {actual && <Check size={19} className="shippingChoiceCheck" aria-hidden="true"/>}
          </label>
          <label className={`shippingChoice ${!actual ? 'selected' : ''}`}>
            <input type="radio" name="shipping-mode" value="average_only" checked={!actual} onChange={() => props.onShippingMode('average_only')}/>
            <span><span className="shippingChoiceTitle">Costo de envío personalizado</span><small>Aplicamos el mismo monto a todas las órdenes, aunque tengan un costo importado.</small></span>
            {!actual && <Check size={19} className="shippingChoiceCheck" aria-hidden="true"/>}
          </label>
        </div>
        <div className="deliveryInset shippingAmount">
          <label className="deliveryField" htmlFor="shipping-amount">{actual ? 'Respaldo si falta el costo' : 'Costo por orden'}<div className="deliveryNumber"><span>ARS</span><input id="shipping-amount" type="number" min="0" step="1" inputMode="numeric" value={props.shipping} onChange={event => props.onShipping(event.target.value)} placeholder="0"/></div></label>
          <p>{actual ? 'Este monto solo se usa cuando la orden no informa el costo del comercio. Un costo informado de $0 se respeta.' : 'Reemplaza el costo importado en todas las órdenes del historial. Podés volver al costo de la orden cuando quieras.'}</p>
        </div>
      </section>

      <section className="deliveryBlock" aria-labelledby="commission-title">
        <div className="deliveryBlockHeading">
          <div className="deliveryBlockTitle"><img className="deliveryBrand" src="/brands/tiendanube-icon.png" alt=""/><div><span className="deliveryEyebrow">02 · COMISIONES DE PAGO</span><h3 id="commission-title">Primero, el cargo real</h3></div></div>
          <span className={`deliveryBadge ${props.connected ? 'automatic' : 'pending'}`}>{props.connected ? 'Importación automática' : 'Tienda sin conectar'}</span>
        </div>
        <p className="deliveryIntro">Cuando Tiendanube informa una comisión —incluidos los cargos de Pago Nube— usamos ese importe. No le sumamos otra comisión manual.</p>
        <div className="deliveryAssurance"><ShieldCheck size={19}/><span>Si el cargo todavía no está disponible, el cálculo queda pendiente o estimado. Nunca lo presentamos como un costo real.</span></div>
        <div className="deliveryInset generalCommission">
          <div><h4>Comisión general de respaldo</h4><p>Último recurso: se usa si no hay cargo real, costo exacto manual, estimación de Pago Nube ni regla específica para ese medio.</p></div>
          <label className="deliveryField" htmlFor="general-commission">Porcentaje sobre la venta<div className="deliveryNumber suffix"><input id="general-commission" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={props.fees} onChange={event => props.onFees(event.target.value)} placeholder="0"/><span>%</span></div></label>
        </div>
        <details className="deliveryDetails" open={Boolean(props.pagoNubePlan || props.pagoNubePayoutDays) || undefined}>
          <summary><span>Estimación de Pago Nube <small>Respaldo opcional</small></span><ChevronDown size={18}/></summary>
          <div className="deliveryDetailsBody"><p>No es necesaria para importar los cargos reales. Usala solo si conocés el plan y el plazo de tu tienda; las tarifas públicas pueden diferir de tu acuerdo.</p><div className="deliveryFieldPair">
            <ThemedSelect label="Plan de Tiendanube" value={props.pagoNubePlan} disabled={!props.loaded||props.saving} onChange={props.onPlan} options={[{value:'',...detectedPlanOption(props.detectedPlan)},{value:'inicial',label:'Inicial'},{value:'esencial',label:'Esencial'},{value:'impulso',label:'Impulso'},{value:'escala',label:'Escala'}]}/>
            <ThemedSelect label="Plazo de acreditación" value={props.pagoNubePayoutDays} disabled={!props.loaded||props.saving} onChange={props.onPayout} options={[{value:'',label:'Sin plazo de respaldo',description:'No estimar cargos de tarjetas sin plazo'},{value:'1',label:'1 día'},{value:'7',label:'7 días'},{value:'14',label:'14 días'}]}/>
          </div><small>El plan debe estar identificado; para tarjetas también se requiere el plazo. Cuotas y otros cargos pueden no estar incluidos. La comisión real tiene prioridad cuando llega.</small></div>
        </details>
      </section>

      <section className="deliveryBlock taxBlock" aria-labelledby="tax-title">
        <div className="deliveryBlockHeading">
          <div className="deliveryBlockTitle"><span className="deliverySymbol"><ReceiptText size={23}/></span><div><span className="deliveryEyebrow">03 · IMPUESTOS DE LA TIENDA</span><h3 id="tax-title">Tus impuestos, por separado</h3></div></div>
          <span className="deliveryBadge">Opcional</span>
        </div>
        <div className="deliveryTaxContent"><div><p className="deliveryIntro">Configurá un porcentaje adicional sobre el total de cada venta. Se aplica a todos los medios de pago.</p><small>No incluyas impuestos que ya estén dentro del cargo importado. Este valor no calcula ni presenta tus obligaciones fiscales.</small></div>
          <label className="deliveryField" htmlFor="store-tax">Porcentaje de impuestos<div className="deliveryNumber suffix"><input id="store-tax" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={props.taxes} onChange={event => props.onTaxes(event.target.value)} placeholder="0"/><span>%</span></div></label>
        </div>
      </section>
    </fieldset>
    <div className="deliverySave"><div><b>{props.loaded ? 'Cambios que se aplican a tu historial' : 'Cargando tu configuración…'}</b><span role="status" aria-live="polite">{props.message || 'Los valores se guardan solo al confirmar. Tu conexión no cambia.'}</span></div><button className="button" type="submit" disabled={!props.loaded || props.saving}>{props.saving ? 'Guardando…' : 'Guardar configuración'}</button></div>
  </form>;
}
