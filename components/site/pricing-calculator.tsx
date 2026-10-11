'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { RENTIA_PLANS, annualPrice } from '../../lib/plans';

const format = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const ordersLabel = (orders: number | null) => orders === null ? '+10.000' : orders.toLocaleString('es-AR');

// Monthly orders -> recommended plan. Same plans and prices as the app (lib/plans).
export default function PricingCalculator() {
  const [index, setIndex] = useState(1);
  const [annual, setAnnual] = useState(false);
  const [swap, setSwap] = useState(0);
  const plan = RENTIA_PLANS[index];
  const choose = (next: number) => { setIndex(next); setSwap(value => value + 1); };

  const yearly = annualPrice(plan);
  const price = plan.monthlyPrice === null ? 'A medida' : `USD ${format(annual && yearly !== null ? yearly / 12 : plan.monthlyPrice)}`;
  const billed = plan.monthlyPrice === null ? 'Lo definimos con vos según tu operación'
    : plan.monthlyPrice === 0 ? 'Sin límite de tiempo'
    : annual && yearly !== null ? `USD ${format(yearly)} facturados por año · ahorrás USD ${format(plan.monthlyPrice * 12 - yearly)}`
    : 'Facturación mensual';
  const features = [
    plan.orders === null ? 'Más de 10.000 órdenes por mes' : `Hasta ${ordersLabel(plan.orders)} órdenes por mes`,
    plan.users === null ? 'Usuarios a medida' : `${plan.users} ${plan.users === 1 ? 'usuario' : 'usuarios'}`,
    `${plan.history} de historial por canal`,
    `Soporte ${plan.support.toLocaleLowerCase('es-AR')}`,
    'Todas las integraciones y funciones',
  ];

  return <div className="pricing" data-reveal>
    <div className="calc">
      <h3>¿Cuántas órdenes tenés por mes?</h3>
      <p>Mové el control y te mostramos el plan que te corresponde.</p>
      <div className="ordersOut"><b className="mono">{ordersLabel(plan.orders)}</b><span>órdenes por mes</span></div>
      <input type="range" min={0} max={RENTIA_PLANS.length - 1} step={1} value={index} aria-label="Órdenes por mes" aria-valuetext={`${ordersLabel(plan.orders)} órdenes por mes`}
        onChange={event => choose(Number(event.target.value))} style={{ '--fill': `${index / (RENTIA_PLANS.length - 1) * 100}%` } as CSSProperties}/>
      <div className="ticks">{RENTIA_PLANS.map(item => <span key={item.id}>{ordersLabel(item.orders)}</span>)}</div>
      <div className="billing" role="group" aria-label="Facturación">
        <button type="button" className={annual ? undefined : 'on'} aria-pressed={!annual} onClick={() => setAnnual(false)}>Mensual</button>
        <button type="button" className={annual ? 'on' : undefined} aria-pressed={annual} onClick={() => setAnnual(true)}>Anual <em>2 meses gratis</em></button>
      </div>
      <div className="planStrip">{RENTIA_PLANS.map((item, itemIndex) => <button type="button" key={item.id} className={itemIndex === index ? 'on' : undefined} aria-pressed={itemIndex === index} onClick={() => choose(itemIndex)}><b>{item.name}</b>{ordersLabel(item.orders)}</button>)}</div>
    </div>
    <div className={`planCard${swap ? ' swap' : ''}`} key={swap}>
      <small className="rec">TU PLAN RECOMENDADO</small>
      <div className="planName">{plan.name}</div>
      <p className="planDesc">{plan.description}</p>
      <div className="planPrice"><b className="mono">{price}</b><span>{plan.monthlyPrice ? '/mes' : ''}</span></div>
      <p className="planBilled">{billed}</p>
      <ul className="planFeats">{features.map(feature => <li key={feature}><Check aria-hidden="true"/>{feature}</li>)}</ul>
      <Link className="button" href="/registro">{plan.monthlyPrice === 0 ? 'Empezar gratis' : 'Empezar 14 días gratis'} <ArrowRight aria-hidden="true"/></Link>
    </div>
  </div>;
}
