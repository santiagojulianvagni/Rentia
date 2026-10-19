import type { CSSProperties } from 'react';
import type { ProductKind } from './product-icons';
import { landingCopy, type Lang, type LandingCopy } from '../../lib/landing-i18n';

// Illustrative panel views. They animate (bars grow, lines draw) once the
// parent `.scene` gets the `on` class, set by SiteEffects.
type Copy = LandingCopy['scenes'];
const vars = (values: Record<string, string | number>) => values as CSSProperties;

function ProfitScene({ uid, t }: { uid: string; t: Copy }) {
  return <>
    <div className="sceneTitle"><b>{t.profitTitle}</b><small>ARS</small></div>
    <div className="kpiRow">
      <div className="kpi"><small>{t.revenue}</small><b className="mono">$ 16,0 M</b><span className="up">▲ 8,2%</span></div>
      <div className="kpi"><small>{t.costs}</small><b className="mono">$ 11,2 M</b><span className="up" style={{ color: '#ff8c99' }}>70%</span></div>
      <div className="kpi"><small>{t.profit}</small><b className="mono" style={{ color: 'var(--cyan)' }}>$ 4,8 M</b><span className="up">▲ 12,4%</span></div>
    </div>
    <div className="chartBox">
      <svg viewBox="0 0 520 190" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`fa-${uid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3b8cff" stopOpacity=".3"/><stop offset="1" stopColor="#3b8cff" stopOpacity="0"/></linearGradient>
          <linearGradient id={`fb-${uid}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#21d4c2" stopOpacity=".4"/><stop offset="1" stopColor="#21d4c2" stopOpacity="0"/></linearGradient>
        </defs>
        <g stroke="#1b3045"><line x1="0" x2="520" y1="47" y2="47"/><line x1="0" x2="520" y1="95" y2="95"/><line x1="0" x2="520" y1="143" y2="143"/></g>
        <path className="area" d="M0 110 C40 96 70 104 104 88 S170 64 208 74 270 48 312 56 380 30 416 38 480 18 520 22 V190 H0Z" fill={`url(#fa-${uid})`}/>
        <path className="draw" d="M0 110 C40 96 70 104 104 88 S170 64 208 74 270 48 312 56 380 30 416 38 480 18 520 22" fill="none" stroke="#3b8cff" strokeWidth="2.5"/>
        <path className="area" d="M0 160 C40 152 70 156 104 146 S170 132 208 138 270 120 312 126 380 108 416 112 480 96 520 98 V190 H0Z" fill={`url(#fb-${uid})`}/>
        <path className="draw" d="M0 160 C40 152 70 156 104 146 S170 132 208 138 270 120 312 126 380 108 416 112 480 96 520 98" fill="none" stroke="#21d4c2" strokeWidth="2.5" style={{ transitionDelay: '.25s' }}/>
      </svg>
    </div>
    <div className="pending"><span>!</span>{t.pending}</div>
  </>;
}

// [name index in the copy, units, bar width, margin, tone]
const productRows: Array<[number, number, number, string, 'g' | 'a' | 'r']> = [
  [0, 412, 72, '48%', 'g'],
  [1, 356, 58, '39%', 'g'],
  [2, 198, 44, '27%', 'a'],
  [3, 640, 16, '9%', 'r'],
  [4, 281, 36, '22%', 'a'],
];

function ProductsScene({ t }: { t: Copy }) {
  return <>
    <div className="sceneTitle"><b>{t.productsTitle}</b><small>{t.last30}</small></div>
    <div className="table">
      <div className="tr th"><span>{t.product}</span><span>{t.units}</span><span>{t.margin}</span><span/></div>
      {productRows.map(([name, units, width, margin, tone], index) => <div className="tr" key={name}>
        <b>{t.products[name]}</b><span className="mono">{units}</span>
        <div className={`mbar${tone === 'r' ? ' low' : ''}`}><i style={vars({ '--w': `${width}%`, '--i': index })}/></div>
        <span className={`badge ${tone}`}>{margin}</span>
      </div>)}
    </div>
    <div className="callout">{t.productsCallout}</div>
  </>;
}

// [name index, bar width, color, tone, days left (null = no movement)]
const stockRows: Array<[number, number, string, string, number | null]> = [
  [3, 12, 'linear-gradient(90deg,#ff6678,#ff9aa5)', 'r', 6],
  [0, 34, 'linear-gradient(90deg,#f5c451,#ffe08a)', 'a', 14],
  [1, 78, 'linear-gradient(90deg,#21d4c2,#32d583)', 'g', 46],
  [2, 66, 'linear-gradient(90deg,#21d4c2,#32d583)', 'g', 47],
  [5, 52, '#3a5268', 'idle', null],
];

function InventoryScene({ t }: { t: Copy }) {
  return <>
    <div className="sceneTitle"><b>{t.stockTitle}</b><small>{t.stockSub}</small></div>
    <div className="stock">
      {stockRows.map(([name, width, color, tone, days], index) => <div className="sitem" key={name}>
        <span><b>{t.products[name]}</b><small>{t.stockDetails[index]}</small></span>
        <div className="sbar"><i style={vars({ '--w': `${width}%`, '--i': index, background: color })}/></div>
        <span className={`badge ${tone}`} style={tone === 'idle' ? { background: '#1b2f42', color: '#9db2c3' } : undefined}>{days === null ? t.idle : t.days(days)}</span>
      </div>)}
    </div>
  </>;
}

const metaBars = [40, 55, 48, 70, 62, 82];
const storeBars = [60, 72, 66, 88, 80, 96];

function AdsScene({ t }: { t: Copy }) {
  return <>
    <div className="sceneTitle"><b>{t.adsTitle}</b><small>{t.last30}</small></div>
    <div className="ads">
      <div className="adsCol meta"><small>{t.metaAttributed}</small><b className="mono">$ 4,1 M</b><div className="vbars">{metaBars.map((height, index) => <i key={index} style={vars({ '--h': `${height}%`, '--i': index })}/>)}</div></div>
      <div className="adsCol store"><small>{t.storeRevenue}</small><b className="mono">$ 16,0 M</b><div className="vbars">{storeBars.map((height, index) => <i key={index} style={vars({ '--h': `${height}%`, '--i': index })}/>)}</div></div>
    </div>
    <div className="campaigns">
      <div className="camp"><b>{t.campaigns[0]}</b><span>{t.roasMeta} <b className="mono" style={{ color: '#8dbaff' }}>4,2x</b></span></div>
      <div className="camp"><b>{t.campaigns[1]}</b><span>{t.roasMeta} <b className="mono" style={{ color: '#8dbaff' }}>6,8x</b></span></div>
      <div className="camp"><b>{t.campaigns[2]}</b><span>{t.spend} <b className="mono">$ 310.000</b></span></div>
    </div>
  </>;
}

export const sceneOrder: ProductKind[] = ['profit', 'products', 'inventory', 'ads'];

export default function ProductScene({ kind, uid, on = false, index, lang = 'es' }: { kind: ProductKind; uid: string; on?: boolean; index?: number; lang?: Lang }) {
  const t = landingCopy[lang].scenes;
  return <div className={`scene${on ? ' on' : ''}`} data-id={index}>
    {kind === 'profit' ? <ProfitScene uid={uid} t={t}/> : kind === 'products' ? <ProductsScene t={t}/> : kind === 'inventory' ? <InventoryScene t={t}/> : <AdsScene t={t}/>}
  </div>;
}
