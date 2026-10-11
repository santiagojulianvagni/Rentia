import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/site/legal-page';
import { LEGAL, LEGAL_UPDATED } from '../../lib/legal';
import '../landing-v2.css';

export const metadata: Metadata = { title: 'Política de privacidad — Rentia', description: 'Qué datos usa Rentia, para qué, con quién se comparten y cómo pedir que los borremos.' };

export default function PrivacyPage() {
  return <LegalPage eyebrow="Política de privacidad" title="Tus datos, cuidados y bajo tu control." updated={LEGAL_UPDATED}
    intro="Rentia necesita leer los datos de tu tienda para calcular tu ganancia. Acá contamos qué datos usamos, para qué y cómo podés pedir que los borremos."
    sections={[
      { id: 'que', title: 'Qué datos usamos', body: <><p><b>De tu cuenta:</b> nombre, email, foto de perfil y los datos de las personas que invitás a tu equipo.</p><p><b>De tu tienda:</b> órdenes, productos, stock, costos, envíos, comisiones, cargos de Mercado Libre y datos de tus campañas publicitarias, según las conexiones que autorices.</p><p><b>De tus clientes:</b> solo los datos de las órdenes que las plataformas informan y que hacen falta para calcular la rentabilidad. No los usamos para contactarlos ni para otros fines.</p></> },
      { id: 'para', title: 'Para qué los usamos', body: <p>Para prestarte el servicio: calcular tu ganancia, mostrarte informes, enviarte avisos sobre tu cuenta y cobrarte el plan que elijas. No vendemos tus datos ni los usamos para publicidad de terceros.</p> },
      { id: 'quien', title: 'Con quién los compartimos', body: <p>Solo con proveedores que necesitamos para funcionar y que tratan los datos por nuestra cuenta: Vercel (servidores), Neon (base de datos), Clerk (inicio de sesión) y, cuando estén activos los cobros, Mercado Pago. También nos comunicamos con Tiendanube, Mercado Libre y Meta para leer los datos que autorizaste.</p> },
      { id: 'seguridad', title: 'Cómo los protegemos', body: <p>Las conexiones viajan cifradas. Los accesos a tus plataformas se guardan cifrados y nunca pedimos sus contraseñas. Cada persona de tu equipo entra con su propia cuenta y los permisos se verifican en el servidor.</p> },
      { id: 'tiempo', title: 'Cuánto tiempo los guardamos', body: <p>Mientras tu cuenta exista. Si te das de baja de un plan pago, tus datos se conservan en el plan Gratis. Si pedís cerrar la cuenta, los eliminamos dentro de los 30 días, salvo lo que la ley nos obligue a conservar.</p> },
      { id: 'derechos', title: 'Tus derechos', body: <><p>Podés pedirnos acceder a tus datos, corregirlos o eliminarlos, conforme a la Ley 25.326 de Protección de los Datos Personales. {LEGAL.email ? <>Escribinos a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</> : 'Escribinos desde los canales de contacto publicados en este sitio.'}</p><p>La Agencia de Acceso a la Información Pública, en su carácter de órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.</p></> },
      { id: 'mas', title: 'Más información', body: <p>Las condiciones de uso, el cobro y la baja están en los <Link href="/terminos">Términos y condiciones</Link>.</p> },
    ]}/>;
}
