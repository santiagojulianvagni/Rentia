'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, CreditCard, Megaphone, Package, ReceiptText, Truck } from 'lucide-react';

const costs = [
  { label: 'Producto', amount: 35000, Icon: Package },
  { label: 'Envío', amount: 5000, Icon: Truck },
  { label: 'Comisiones', amount: 7000, Icon: CreditCard },
  { label: 'Publicidad', amount: 18000, Icon: Megaphone },
  { label: 'Impuestos', amount: 5000, Icon: ReceiptText },
];
const sale = 100000;
const last = costs.length + 1;
const money = (value: number) => `$ ${Math.round(value).toLocaleString('es-AR')}`;

// One illustrative sale, walked through each cost and looped. It pauses on
// hover/focus, while off screen, and shows the final state with reduced motion.
export default function ProfitDemo() {
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
  return <section ref={card} className={`demo${done ? ' done' : ''}`} data-tilt tabIndex={0} aria-label="Demo ilustrativa: una venta explicada"
    onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <header className="demoHead"><span><img src="/favicon.svg" alt=""/>Una venta, explicada</span><small>Demo ilustrativa</small></header>
    <ol className="demoSteps">
      {['Venta', 'Costos', 'Ganancia'].map((label, index) => <li key={label} className={index <= step ? 'on' : undefined}><span>{index + 1}</span>{label}</li>)}
      <li className="demoTrack" aria-hidden="true"><i style={{ '--p': stage / last } as CSSProperties}/></li>
    </ol>
    <div className="demoBody">
      <div className="sale"><span className="saleIcon"><Check aria-hidden="true"/></span><div><small>VENTA COBRADA</small><b>Orden #10482</b></div><strong className="mono">{money(sale)}<br/><small style={{ color: '#6e869b', fontSize: 11 }}>ARS</small></strong></div>
      <div className="ledger">
        <div className="ledgerHead"><span>Lo que cuesta esta venta</span><span>Importe</span></div>
        {costs.map(({ label, amount, Icon }, index) => <div key={label} className={`row${stage > index ? ' on' : ''}${stage === index + 1 ? ' hl' : ''}`}>
          <span><Icon aria-hidden="true"/>{label}</span><b className="mono">{stage > index ? `− ${money(amount)}` : '—'}</b>
        </div>)}
      </div>
      <div className="result">
        <div><small>{done ? 'TE QUEDA' : 'RESTANTE POR REVISAR'}</small><strong className="mono">{money(shown)}</strong><p>{done ? 'Después de todos estos costos' : 'Descontando los costos de la venta'}</p></div>
        <div className="ring"><svg viewBox="0 0 76 76" aria-hidden="true"><circle className="bgc" cx="38" cy="38" r="32"/><circle className="fg" cx="38" cy="38" r="32" style={{ strokeDashoffset: ring }}/></svg><b className="mono">{done ? '30%' : `${Math.min(stage, costs.length)}/${costs.length}`}</b></div>
      </div>
      <div className="bar"><i className="c" style={{ width: `${costShare}%` }}/><i className="g" style={{ width: `${100 - costShare}%` }}/></div>
      <div className="barLabels"><span>{Math.round(costShare)}% costos</span><span>{Math.round(100 - costShare)}% {done ? 'ganancia' : 'por revisar'}</span></div>
    </div>
    <footer className="demoFoot"><span>Importes de ejemplo · ARS</span><span>{reduced ? 'Vista sin animación' : paused ? 'Pausada para leer' : 'Se repite automáticamente'}</span></footer>
    <p className="srOnly">Ejemplo en pesos: una venta de $100.000 menos producto $35.000, envío $5.000, comisiones $7.000, publicidad $18.000 e impuestos $5.000 deja $30.000, un margen del 30%.</p>
  </section>;
}
