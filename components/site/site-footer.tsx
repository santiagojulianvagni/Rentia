import Link from 'next/link';

export default function SiteFooter() {
  return <footer>
    <div className="shell footIn">
      <Link className="brand" href="/#inicio" style={{ fontSize: 17 }}><img src="/favicon.svg" alt="" style={{ width: 24, height: 24 }}/>Rentia</Link>
      <span>© 2026 Rentia. Hecho para el e-commerce latinoamericano.</span>
      <nav aria-label="Pie de página"><Link href="/producto">Producto</Link><Link href="/blog">Blog</Link><Link href="/#privacidad">Acceso y privacidad</Link><Link href="/#faq">Preguntas frecuentes</Link><Link href="/terminos">Términos</Link><Link href="/privacidad">Privacidad</Link><Link href="/baja">Botón de baja</Link></nav>
    </div>
  </footer>;
}
