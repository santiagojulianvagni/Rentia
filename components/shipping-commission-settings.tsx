'use client';

import type { FormEvent } from 'react';
import { pagoNubePlan } from '../lib/pago-nube-fees';
import { ChevronDown, ReceiptText, ShieldCheck, Truck } from 'lucide-react';

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
  const detected = detectedPlanOption(props.detectedPlan);
  return <form className="p-cfg" onSubmit={props.onSubmit}>
    <fieldset disabled={!props.loaded || props.saving} className="p-cfgFields">
      <section className="p-block p-reveal" aria-labelledby="shipping-title">
        <div className="p-blockHead"><span className="p-bIcon"><Truck aria-hidden="true"/></span><div><div className="p-num">01 · ENVÍOS</div><h3 id="shipping-title">¿Cómo calculamos el envío?</h3><p>Elegí el costo que paga tu tienda. No es lo mismo que el envío que le cobrás al cliente.</p></div><span className="p-chip p-g">{actual ? 'Costo de la orden' : 'Personalizado'}</span></div>
        <div className="p-grid p-g2" role="radiogroup" aria-label="Forma de calcular el envío">
          <label className={`p-opt ${actual ? 'p-on' : ''}`}><input type="radio" name="shipping-mode" value="actual" checked={actual} onChange={() => props.onShippingMode('actual')}/><span className="p-radio" aria-hidden="true"/><span><b>Costo de envío de la orden <span className="p-chip p-g">Recomendado</span></b><small>Usamos el costo del comercio informado por Tiendanube en cada pedido.</small></span></label>
          <label className={`p-opt ${!actual ? 'p-on' : ''}`}><input type="radio" name="shipping-mode" value="average_only" checked={!actual} onChange={() => props.onShippingMode('average_only')}/><span className="p-radio" aria-hidden="true"/><span><b>Costo de envío personalizado</b><small>Aplicamos el mismo monto a todas las órdenes, aunque tengan un costo importado.</small></span></label>
        </div>
        <div className="p-cfgRow"><label className="p-field" htmlFor="shipping-amount"><span className="p-fieldLabel">{actual ? 'Respaldo si falta el costo' : 'Costo por orden'}</span><span className="p-input"><span>ARS</span><input id="shipping-amount" type="number" min="0" step="1" inputMode="numeric" value={props.shipping} onChange={event => props.onShipping(event.target.value)} placeholder="0"/></span></label><p className="p-sub">{actual ? 'Este monto solo se usa cuando la orden no informa el costo del comercio. Un costo informado de $0 se respeta.' : 'Reemplaza el costo importado en todas las órdenes del historial. Podés volver al costo de la orden cuando quieras.'}</p></div>
      </section>

      <section className="p-block p-reveal" style={{'--i':1} as React.CSSProperties} aria-labelledby="commission-title">
        <div className="p-blockHead"><span className="p-bIcon"><img src="/brands/tiendanube-icon.png" alt=""/></span><div><div className="p-num">02 · COMISIONES DE PAGO</div><h3 id="commission-title">Primero, el cargo real</h3><p>Cuando Tiendanube informa una comisión —incluidos los cargos de Pago Nube— usamos ese importe. No le sumamos otra comisión manual.</p></div><span className={`p-chip ${props.connected ? 'p-g' : 'p-a'}`}>{props.connected ? 'Importación automática' : 'Tienda sin conectar'}</span></div>
        <p className="p-warnLine p-soft"><ShieldCheck className="p-i" aria-hidden="true"/> Si el cargo todavía no está disponible, el cálculo queda pendiente o estimado. Nunca lo presentamos como un costo real.</p>
        <div className="p-cfgRow"><label className="p-field" htmlFor="general-commission"><span className="p-fieldLabel">Comisión general de respaldo</span><span className="p-input"><input id="general-commission" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={props.fees} onChange={event => props.onFees(event.target.value)} placeholder="0"/><span>% sobre la venta</span></span></label><p className="p-sub">Último recurso: se usa si no hay cargo real, costo exacto manual, estimación de Pago Nube ni regla específica para ese medio.</p></div>
        <details className="p-subcard" open={Boolean(props.pagoNubePlan || props.pagoNubePayoutDays) || undefined}>
          <summary><b>Estimación de Pago Nube <span className="p-chip p-n">Respaldo opcional</span></b><ChevronDown className="p-i" aria-hidden="true"/></summary>
          <p className="p-sub" style={{margin:'10px 0 12px'}}>No es necesaria para importar los cargos reales. Usala solo si conocés el plan y el plazo de tu tienda; las tarifas públicas pueden diferir de tu acuerdo.</p>
          <div className="p-grid p-g2">
            <label className="p-field"><span className="p-fieldLabel">Plan de Tiendanube</span><span className="p-input"><select value={props.pagoNubePlan} disabled={!props.loaded||props.saving} onChange={event=>props.onPlan(event.target.value)}><option value="">{detected.label}</option><option value="inicial">Inicial</option><option value="esencial">Esencial</option><option value="impulso">Impulso</option><option value="escala">Escala</option></select></span>{detected.description&&<small className="p-detected">{detected.description}</small>}</label>
            <label className="p-field"><span className="p-fieldLabel">Plazo de acreditación</span><span className="p-input"><select value={props.pagoNubePayoutDays} disabled={!props.loaded||props.saving} onChange={event=>props.onPayout(event.target.value)}><option value="">Sin plazo de respaldo</option><option value="1">1 día</option><option value="7">7 días</option><option value="14">14 días</option></select></span></label>
          </div>
          <p className="p-sub" style={{fontSize:12,margin:'10px 0 0'}}>El plan debe estar identificado; para tarjetas también se requiere el plazo. Cuotas y otros cargos pueden no estar incluidos. La comisión real tiene prioridad cuando llega.</p>
        </details>
      </section>

      <section className="p-block p-reveal" style={{'--i':2} as React.CSSProperties} aria-labelledby="tax-title">
        <div className="p-blockHead"><span className="p-bIcon"><ReceiptText aria-hidden="true"/></span><div><div className="p-num">03 · IMPUESTOS DE LA TIENDA</div><h3 id="tax-title">Tus impuestos, por separado</h3><p>Configurá un porcentaje adicional sobre el total de cada venta. Se aplica a todos los medios de pago.</p></div><span className="p-chip p-n">Opcional</span></div>
        <div className="p-cfgRow"><label className="p-field" htmlFor="store-tax"><span className="p-fieldLabel">Porcentaje de impuestos</span><span className="p-input"><input id="store-tax" type="number" min="0" max="100" step="0.01" inputMode="decimal" value={props.taxes} onChange={event => props.onTaxes(event.target.value)} placeholder="0"/><span>%</span></span></label><p className="p-sub">No incluyas impuestos que ya estén dentro del cargo importado. Este valor no calcula ni presenta tus obligaciones fiscales.</p></div>
      </section>
    </fieldset>
    <div className="p-saveBar"><div><b>{props.loaded ? 'Cambios que se aplican a tu historial' : 'Cargando tu configuración…'}</b><small role="status" aria-live="polite">{props.message || 'Los valores se guardan solo al confirmar. Tu conexión no cambia.'}</small></div><div className="p-actions"><button className="p-btn p-primary" type="submit" disabled={!props.loaded || props.saving}>{props.saving ? 'Guardando…' : 'Guardar configuración'}</button></div></div>
  </form>;
}
