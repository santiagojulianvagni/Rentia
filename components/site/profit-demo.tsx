'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, CreditCard, Megaphone, Package, ReceiptText, Truck } from 'lucide-react';
import { LANG_LOCALE, landingCopy, type Lang } from '../../lib/landing-i18n';

const costs = [
  { amount: 35000, Icon: Package },
  { amount: 5000, Icon: Truck },
  { amount: 7000, Icon: CreditCard },
  { amount: 18000, Icon: Megaphone },
  { amount: 5000, Icon: ReceiptText },
];
const sale = 100000;
const last = costs.length + 1;

// One illustrative sale, walked through each cost and looped. It pauses on
// hover/focus, while off screen, and shows the final state with reduced motion.
export default function ProfitDemo({ lang = 'es' }: { lang?: Lang }) {
  const t = landingCopy[lang].demo;
  const money = (value: number) => `$ ${Math.round(value).toLocaleString(LANG_LOCALE[lang])}`;
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [shown, setShown] = useState(sale);
  const shownRef = useRef(sale);
  const card = useRef<HTMLElement>(null);

  const counted = costs.slice(0, Math.min(stage, costs.length)).reduce((sum, cost) => sum + cost.amount, 0);
  const left = sale - counted;
  const done = stage === last;

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    // Reading the user's preference has to happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (media.matches) { setReduced(true); setStage(last); }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .3 });
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || paused || !visible) return;
    const timer = window.setTimeout(() => setStage(current => current >= last ? 0 : current + 1), stage >= last ? 3600 : stage === 0 ? 1100 : 950);
    return () => window.clearTimeout(timer);
  }, [stage, paused, visible, reduced]);

  // The remaining amount counts down instead of jumping.
  useEffect(() => {
    const from = shownRef.current;
    if (from === left) return;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min(1, (now - start) / 600);
      const value = from + (left - from) * (1 - Math.pow(1 - progress, 3));
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [left, reduced]);

  const step = stage === 0 ? 0 : done ? 2 : 1;
  const costShare = counted / sale * 100;
  const ring = 201 * (1 - (done ? .3 : Math.min(stage, costs.length) / costs.length));
  return <section ref={card} className={`demo${done ? ' done' : ''}`} data-tilt tabIndex={0} aria-label={t.aria}
    onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <header className="demoHead"><span><img src="/favicon.svg" alt=""/>{t.title}</span><small>{t.badge}</small></header>
    <ol className="demoSteps">
      {t.steps.map((label, index) => <li key={label} className={index <= step ? 'on' : undefined}><span>{index + 1}</span>{label}</li>)}
      <li className="demoTrack" aria-hidden="true"><i style={{ '--p': stage / last } as CSSProperties}/></li>
    </ol>
    <div className="demoBody">
      <div className="sale"><span className="saleIcon"><Check aria-hidden="true"/></span><div><small>{t.saleLabel}</small><b>{t.order}</b></div><strong className="mono">{money(sale)}<br/><small style={{ color: '#6e869b', fontSize: 11 }}>ARS</small></strong></div>
      <div className="ledger">
        <div className="ledgerHead"><span>{t.ledger[0]}</span><span>{t.ledger[1]}</span></div>
        {costs.map(({ amount, Icon }, index) => <div key={index} className={`row${stage > index ? ' on' : ''}${stage === index + 1 ? ' hl' : ''}`}>
          <span><Icon aria-hidden="true"/>{t.costs[index]}</span><b className="mono">{stage > index ? `− ${money(amount)}` : '—'}</b>
        </div>)}
      </div>
      <div className="result">
        <div><small>{done ? t.leftDone : t.left}</small><strong className="mono">{money(shown)}</strong><p>{done ? t.leftTextDone : t.leftText}</p></div>
        <div className="ring"><svg viewBox="0 0 76 76" aria-hidden="true"><circle className="bgc" cx="38" cy="38" r="32"/><circle className="fg" cx="38" cy="38" r="32" style={{ strokeDashoffset: ring }}/></svg><b className="mono">{done ? '30%' : `${Math.min(stage, costs.length)}/${costs.length}`}</b></div>
      </div>
      <div className="bar"><i className="c" style={{ width: `${costShare}%` }}/><i className="g" style={{ width: `${100 - costShare}%` }}/></div>
      <div className="barLabels"><span>{Math.round(costShare)}% {t.costsShare}</span><span>{Math.round(100 - costShare)}% {done ? t.profitShare : t.pendingShare}</span></div>
    </div>
    <footer className="demoFoot"><span>{t.footAmounts}</span><span>{reduced ? t.reduced : paused ? t.paused : t.looping}</span></footer>
    <p className="srOnly">{t.sr}</p>
  </section>;
}
