import type { CSSProperties } from 'react';
import type { ProductKind } from './product-icons';

// Illustrative panel views. They animate (bars grow, lines draw) once the
// parent `.scene` gets the `on` class, set by SiteEffects.
const vars = (values: Record<string, string | number>) => values as CSSProperties;

function ProfitScene({ uid }: { uid: string }) {
  return <>
    <div className="sceneTitle"><b>Ganancia · últimos 30 días</b><small>ARS</small></div>
    <div className="kpiRow">
      <div className="kpi"><small>Facturación</small><b className="mono">$ 16,0 M</b><span className="up">▲ 8,2%</span></div>
      <div className="kpi"><small>Costos</small><b className="mono">$ 11,2 M</b><span className="up" style={{ color: '#ff8c99' }}>70%</span></div>
      <div className="kpi"><small>Ganancia</small><b className="mono" style={{ color: 'var(--cyan)' }}>$ 4,8 M</b><span className="up">▲ 12,4%</span></div>
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
    <div className="pending"><span>!</span>3 productos sin costo: la ganancia de 41 órdenes es provisoria.</div>
  </>;
}

const productRows: Array<[string, number, number, string, 'g' | 'a' | 'r']> = [
  ['Sérum vitamina C', 412, 72, '48%', 'g'],
  ['Crema hidratante', 356, 58, '39%', 'g'],
  ['Kit regalo', 198, 44, '27%', 'a'],
  ['Protector solar', 640, 16, '9%', 'r'],
  ['Agua micelar', 281, 36, '22%', 'a'],
];

function ProductsScene() {
  return <>
    <div className="sceneTitle"><b>Productos por margen</b><small>Últimos 30 días</small></div>
    <div className="table">
      <div className="tr th"><span>Producto</span><span>Unidades</span><span>Margen</span><span/></div>
      {productRows.map(([name, units, width, margin, tone], index) => <div className="tr" key={name}>
        <b>{name}</b><span className="mono">{units}</span>
        <div className={`mbar${tone === 'r' ? ' low' : ''}`}><i style={vars({ '--w': `${width}%`, '--i': index })}/></div>
        <span className={`badge ${tone}`}>{margin}</span>
      </div>)}
    </div>
    <div className="callout">El más vendido no es el que más deja: “Protector solar” vende 640 unidades con 9% de margen.</div>
  </>;
}

const stockRows: Array<[string, string, number, string, string, string]> = [
  ['Protector solar', '12 u · 2/día', 12, 'linear-gradient(90deg,#ff6678,#ff9aa5)', 'r', '6 días'],
  ['Sérum vitamina C', '58 u · 4/día', 34, 'linear-gradient(90deg,#f5c451,#ffe08a)', 'a', '14 días'],
  ['Crema hidratante', '230 u · 5/día', 78, 'linear-gradient(90deg,#21d4c2,#32d583)', 'g', '46 días'],
  ['Kit regalo', '140 u · 3/día', 66, 'linear-gradient(90deg,#21d4c2,#32d583)', 'g', '47 días'],
  ['Tónico facial', '85 u · sin ventas', 52, '#3a5268', 'idle', 'Sin movimiento'],
];

function InventoryScene() {
  return <>
    <div className="sceneTitle"><b>Stock y duración estimada</b><small>Según ventas del período</small></div>
    <div className="stock">
      {stockRows.map(([name, detail, width, color, tone, label], index) => <div className="sitem" key={name}>
        <span><b>{name}</b><small>{detail}</small></span>
        <div className="sbar"><i style={vars({ '--w': `${width}%`, '--i': index, background: color })}/></div>
        <span className={`badge ${tone}`} style={tone === 'idle' ? { background: '#1b2f42', color: '#9db2c3' } : undefined}>{label}</span>
      </div>)}
    </div>
  </>;
}

const metaBars = [40, 55, 48, 70, 62, 82];
const storeBars = [60, 72, 66, 88, 80, 96];

function AdsScene() {
  return <>
    <div className="sceneTitle"><b>Publicidad · dos lecturas</b><small>Últimos 30 días</small></div>
    <div className="ads">
      <div className="adsCol meta"><small>Ventas que Meta se atribuye</small><b className="mono">$ 4,1 M</b><div className="vbars">{metaBars.map((height, index) => <i key={index} style={vars({ '--h': `${height}%`, '--i': index })}/>)}</div></div>
      <div className="adsCol store"><small>Facturación total de la tienda</small><b className="mono">$ 16,0 M</b><div className="vbars">{storeBars.map((height, index) => <i key={index} style={vars({ '--h': `${height}%`, '--i': index })}/>)}</div></div>
    </div>
    <div className="campaigns">
      <div className="camp"><b>Prospección · Primavera</b><span>ROAS Meta <b className="mono" style={{ color: '#8dbaff' }}>4,2x</b></span></div>
      <div className="camp"><b>Retargeting · Carrito</b><span>ROAS Meta <b className="mono" style={{ color: '#8dbaff' }}>6,8x</b></span></div>
      <div className="camp"><b>Product Ads · Mercado Libre</b><span>Inversión <b className="mono">$ 310.000</b></span></div>
    </div>
  </>;
}

export const sceneOrder: ProductKind[] = ['profit', 'products', 'inventory', 'ads'];
export const sceneTabs: Record<ProductKind, string> = { profit: 'Ganancia', products: 'Productos', inventory: 'Stock', ads: 'Publicidad' };

export default function ProductScene({ kind, uid, on = false, index }: { kind: ProductKind; uid: string; on?: boolean; index?: number }) {
  return <div className={`scene${on ? ' on' : ''}`} data-id={index}>
    {kind === 'profit' ? <ProfitScene uid={uid}/> : kind === 'products' ? <ProductsScene/> : kind === 'inventory' ? <InventoryScene/> : <AdsScene/>}
  </div>;
}
