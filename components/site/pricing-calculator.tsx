'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { RENTIA_PLANS, annualPrice } from '../../lib/plans';
import { LANG_LOCALE, landingCopy, type Lang } from '../../lib/landing-i18n';

// Monthly orders -> recommended plan. Same plans and prices as the app (lib/plans).
export default function PricingCalculator({ lang = 'es' }: { lang?: Lang }) {
  const t = landingCopy[lang].calc;
  const locale = LANG_LOCALE[lang];
  const format = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const ordersLabel = (orders: number | null) => orders === null ? `+${(10000).toLocaleString(locale)}` : orders.toLocaleString(locale);
  const [index, setIndex] = useState(1);
  const [annual, setAnnual] = useState(false);
  const [swap, setSwap] = useState(0);
  const plan = RENTIA_PLANS[index];
  const choose = (next: number) => { setIndex(next); setSwap(value => value + 1); };

  const yearly = annualPrice(plan);
  const price = plan.monthlyPrice === null ? t.custom : `USD ${format(annual && yearly !== null ? yearly / 12 : plan.monthlyPrice)}`;
  const billed = plan.monthlyPrice === null ? t.customText
    : plan.monthlyPrice === 0 ? t.forever
    : annual && yearly !== null ? t.billedYearly(format(yearly), format(plan.monthlyPrice * 12 - yearly))
    : t.billedMonthly;
  const features = [
    plan.orders === null ? t.moreThan : t.upTo(ordersLabel(plan.orders)),
    plan.users === null ? t.customUsers : t.users(plan.users),
    t.history,
    t.support(t.supportLevels[plan.support] || plan.support),
    t.allFeatures,
  ];

  return <div className="pricing" data-reveal>
    <div className="calc">
      <h3>{t.title}</h3>
      <p>{t.text}</p>
      <div className="ordersOut"><b className="mono">{ordersLabel(plan.orders)}</b><span>{t.orders}</span></div>
      <input type="range" min={0} max={RENTIA_PLANS.length - 1} step={1} value={index} aria-label={t.orders} aria-valuetext={`${ordersLabel(plan.orders)} ${t.orders}`}
        onChange={event => choose(Number(event.target.value))} style={{ '--fill': `${index / (RENTIA_PLANS.length - 1) * 100}%` } as CSSProperties}/>
      <div className="ticks">{RENTIA_PLANS.map(item => <span key={item.id}>{ordersLabel(item.orders)}</span>)}</div>
      <div className="billing" role="group" aria-label={t.billing}>
        <button type="button" className={annual ? undefined : 'on'} aria-pressed={!annual} onClick={() => setAnnual(false)}>{t.monthly}</button>
        <button type="button" className={annual ? 'on' : undefined} aria-pressed={annual} onClick={() => setAnnual(true)}>{t.annual} <em>{t.annualBonus}</em></button>
      </div>
      <div className="planStrip">{RENTIA_PLANS.map((item, itemIndex) => <button type="button" key={item.id} className={itemIndex === index ? 'on' : undefined} aria-pressed={itemIndex === index} onClick={() => choose(itemIndex)}><b>{item.name}</b>{ordersLabel(item.orders)}</button>)}</div>
    </div>
    <div className={`planCard${swap ? ' swap' : ''}`} key={swap}>
      <small className="rec">{t.recommended}</small>
      <div className="planName">{plan.name}</div>
      <p className="planDesc">{t.planDescriptions[plan.id] || plan.description}</p>
      <div className="planPrice"><b className="mono">{price}</b><span>{plan.monthlyPrice ? t.perMonth : ''}</span></div>
      <p className="planBilled">{billed}</p>
      <ul className="planFeats">{features.map(feature => <li key={feature}><Check aria-hidden="true"/>{feature}</li>)}</ul>
      <Link className="button" href="/registro">{plan.monthlyPrice === 0 ? t.startFree : t.startTrial} <ArrowRight aria-hidden="true"/></Link>
    </div>
  </div>;
}
