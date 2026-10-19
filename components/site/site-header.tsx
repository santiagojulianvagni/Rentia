import Link from 'next/link';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { landingProducts } from '../../lib/landing-products';
import { productIcons } from './product-icons';

export default function SiteHeader({ home = false }: { home?: boolean }) {
  const anchor = home ? '' : '/';
  return <header className="nav" id="nav">
    <div className="shell navIn">
      <Link className="brand" href={`${anchor}#inicio`} aria-label="Rentia, inicio"><img src="/favicon.svg" alt=""/>Rentia</Link>
      <nav className="navLinks" aria-label="Principal">
        <div className="menuWrap">
          <button className="menuBtn" type="button" aria-haspopup="true">Producto <ChevronDown aria-hidden="true"/></button>
          <div className="mega">
            <div className="megaIntro"><span>EXPLORÁ RENTIA</span><small>Tus números, con una explicación clara.</small></div>
            <div className="megaGrid">{landingProducts.map(product => {
              const Icon = productIcons[product.kind];
              return <Link href={`/producto/${product.slug}`} key={product.slug}><i><Icon aria-hidden="true"/></i><span><b>{product.label}</b><small>{product.menuDescription}</small></span></Link>;
            })}</div>
            <Link className="megaAll" href="/producto"><span><b>Ver todo el producto</b><small>Ventas, costos, stock y publicidad</small></span><ArrowRight aria-hidden="true"/></Link>
          </div>
        </div>
        <a href={`${anchor}#integraciones`}>Integraciones</a>
        <a href={`${anchor}#precios`}>Precios</a>
        <a href={`${anchor}#faq`}>FAQ</a>
        <Link href="/blog">Blog</Link>
      </nav>
      <div className="navActions"><Link className="login" href="/ingresar">Ingresar</Link><Link className="button small" href="/registro">Crear cuenta</Link></div>
    </div>
  </header>;
}
