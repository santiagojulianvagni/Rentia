import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { productIcons, type ProductKind } from './product-icons';
import ProductScene, { sceneOrder, sceneTabs } from './product-scenes';

type Chapter = { kind: ProductKind; slug: string; kicker: string; title: [string, string]; body: string; benefits: string[]; note?: string; link: string; insight?: boolean };

const chapters: Chapter[] = [
  { kind: 'profit', slug: 'ganancia-real', kicker: '01 · RENTABILIDAD', title: ['Vender más está bien.', 'Saber qué te queda, mejor.'], body: 'Reuní la facturación y los costos que Rentia conoce para entender el resultado de tu tienda, por período y por orden.', benefits: ['Producto, envío, comisiones e impuestos en la misma cuenta.', 'Inversión publicitaria visible junto a tus ventas.', 'Costos pendientes señalados, no escondidos.'], link: 'Conocé la ganancia y sus costos', insight: true },
  { kind: 'products', slug: 'productos', kicker: '02 · PRODUCTOS', title: ['No todos tus productos', 'dejan lo mismo.'], body: 'Compará ventas, costos y margen por producto. Encontrá qué aporta a tu resultado, más allá de cuántas unidades vendiste.', benefits: ['Ventas y rentabilidad por producto y variante.', 'Costos vinculados por SKU: el código de cada producto.', 'Información para revisar precios y promociones.'], link: 'Explorá productos y márgenes' },
  { kind: 'inventory', slug: 'inventario', kicker: '03 · INVENTARIO', title: ['Anticipate al', '“nos quedamos sin stock”.'], body: 'Relacioná las unidades disponibles con el ritmo de ventas del período. Mirá cuánto podría durar tu stock antes de decidir una reposición.', benefits: ['Stock y ventas por producto o variante.', 'Duración estimada según el ritmo de venta.', 'Alertas de reposición y productos sin movimiento.'], note: 'La duración es una estimación: cambia si cambia la demanda.', link: 'Conocé cómo se estima tu stock' },
  { kind: 'ads', slug: 'publicidad', kicker: '04 · PUBLICIDAD', title: ['Lo que atribuye Meta.', 'Lo que vende tu tienda.'], body: 'Son dos lecturas distintas. Compará la inversión y las ventas que Meta se atribuye con la facturación completa de tu tienda, sin mezclarlas.', benefits: ['Inversión, ROAS y costo por compra reportados por Meta.', 'Product Ads de Mercado Libre en el mismo lugar.', 'Facturación total de la tienda como referencia separada.'], note: 'Un ROAS alto no garantiza ganancia: también importan tus costos.', link: 'Entendé las dos lecturas del ROAS' },
];

// Scroll storytelling: chapters on the left, a sticky panel on the right that
// switches scene (SiteEffects). On small screens each chapter shows its scene inline.
export default function ProductTour({ withHeading = true }: { withHeading?: boolean }) {
  return <section className="section" id="tour" style={{ paddingTop: 60 }}>
    <div className="shell">
      {withHeading && <div className="sectionHead center" data-reveal><span className="tag">Explorá Rentia</span><h2>De tus números<br/><em>a tu próxima decisión.</em></h2><p className="lede">Ventas, costos, productos y publicidad. Cada parte de tu operación, con una explicación clara.</p></div>}
      <div className="tour">
        <div className="chapters">
          {chapters.map((chapter, index) => {
            const Icon = productIcons[chapter.kind];
            return <article className={`chapter${index === 0 ? ' active' : ''}`} data-chapter={index} key={chapter.kind}>
              <span className="kicker"><i><Icon aria-hidden="true"/></i>{chapter.kicker}</span>
              <h3>{chapter.title[0]}<br/><em>{chapter.title[1]}</em></h3>
              <p>{chapter.body}</p>
              <ul className="benefits">{chapter.benefits.map(benefit => <li key={benefit}><Check aria-hidden="true"/>{benefit}</li>)}</ul>
              {chapter.insight && <div className="insight"><ShieldCheck className="tick" aria-hidden="true" style={{ color: 'var(--cyan)' }}/><span>Si falta un costo, la ganancia sigue siendo provisoria. Primero claridad; después decisiones.</span></div>}
              {chapter.note && <p className="note">{chapter.note}</p>}
              <Link className="more" href={`/producto/${chapter.slug}`}>{chapter.link} <ArrowRight aria-hidden="true" style={{ width: 16, height: 16 }}/></Link>
              <div className="tourScene" data-autoscene><ProductScene kind={chapter.kind} uid={`m${index}`}/></div>
            </article>;
          })}
        </div>
        <div className="stage" aria-hidden="true">
          <div className="stageInner" data-stage>
            <div className="stageBar"><i/><i/><i/><span>Ejemplo</span><div className="stageTabs">{sceneOrder.map((kind, index) => <button type="button" tabIndex={-1} key={kind} className={index === 0 ? 'on' : undefined} data-go={index}>{sceneTabs[kind]}</button>)}</div></div>
            {sceneOrder.map((kind, index) => <ProductScene key={kind} kind={kind} uid={`s${index}`} index={index} on={index === 0}/>)}
          </div>
        </div>
      </div>
    </div>
  </section>;
}
