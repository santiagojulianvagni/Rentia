import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/site/legal-page';
import { LEGAL, LEGAL_UPDATED } from '../../lib/legal';
import '../landing-v2.css';

export const metadata: Metadata = { title: 'Baja del servicio — Rentia', description: 'Cómo darte de baja de Rentia cuando quieras, sin penalidades, y cómo arrepentirte de una contratación.' };

export default function CancelPage() {
  return <LegalPage eyebrow="Botón de baja" title="Darte de baja es simple." updated={LEGAL_UPDATED}
    intro="Podés dejar de pagar Rentia cuando quieras, sin penalidades y sin tener que hablar con nadie. Así funciona."
    highlight={<div className="legalCallout"><b>Darte de baja ahora</b><p>Entrá a tu panel, abrí <b>Plan y facturación</b> y tocá <b>Dar de baja</b>.</p><Link className="button small" href="/panel?section=plan">Ir a Plan y facturación</Link></div>}
    sections={[
      { id: 'pasos', title: 'Los pasos', body: <ol><li>Entrá a tu panel y abrí <b>Plan y facturación</b>.</li><li>Tocá <b>Dar de baja</b>. Te mostramos qué pasa con tu plan y tus datos.</li><li>Escribí <b>DAR DE BAJA</b> para confirmar.</li><li>Confirmá tu identidad con tu contraseña o un código. Lo pedimos para que nadie pueda dar de baja tu suscripción sin querer o sin tu permiso.</li></ol> },
      { id: 'despues', title: 'Qué pasa después', body: <ul><li>La baja corta las renovaciones automáticas en el momento: no se te vuelve a cobrar.</li><li>Seguís usando tu plan hasta el final del período ya pagado.</li><li>Después pasás al plan Gratis. Tus datos, costos e historial se conservan.</li><li>Podés volver a suscribirte cuando quieras.</li></ul> },
      { id: 'arrepentimiento', title: 'Arrepentimiento', body: <p>Si te arrepentís dentro de los 10 días corridos desde tu primera contratación, podés revocarla y te devolvemos el total cobrado. {LEGAL.email ? <>Pedilo escribiendo a <a href={`mailto:${LEGAL.email}?subject=Arrepentimiento`}>{LEGAL.email}</a> con el asunto «Arrepentimiento».</> : 'Pedilo desde los canales de contacto publicados en este sitio, con el asunto «Arrepentimiento».'} Te confirmamos la recepción con un código de trámite.</p> },
      { id: 'cuenta', title: 'Cerrar la cuenta', body: <p>Si además querés que eliminemos tus datos, pedilo después de la baja. Los borramos dentro de los 30 días, como explica la <Link href="/privacidad">Política de privacidad</Link>.</p> },
    ]}/>;
}
