import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '../../components/site/legal-page';
import WithdrawalForm from '../../components/site/withdrawal-form';
import { LEGAL_UPDATED } from '../../lib/legal';
import '../landing-v2.css';

export const metadata: Metadata = { title: 'Botón de arrepentimiento — Rentia', description: 'Revocá tu contratación de Rentia dentro de los 10 días, sin cuenta y con código de trámite al instante.' };

export default function WithdrawalPage() {
  return <LegalPage eyebrow="Botón de arrepentimiento" title="Te arrepentiste: lo resolvemos." updated={LEGAL_UPDATED}
    intro="Tenés 10 días corridos desde que contrataste un plan para revocar la contratación, sin dar explicaciones y sin costo. Completá el formulario y te damos un código de trámite en el momento."
    highlight={<WithdrawalForm/>}
    sections={[
      { id: 'plazo', title: 'Quién puede pedirlo', body: <p>Cualquier persona que haya contratado un plan pago de Rentia, dentro de los 10 días corridos desde la contratación (artículo 34 de la Ley 24.240 de Defensa del Consumidor y Resolución 424/2020).</p> },
      { id: 'que-pasa', title: 'Qué pasa después', body: <ul><li>Te damos un código de trámite en la pantalla y te lo mandamos por mail.</li><li>Cancelamos la suscripción: no se te vuelve a cobrar.</li><li>Te devolvemos el total cobrado, por el mismo medio de pago, sin costo para vos.</li><li>Tus datos se conservan en el plan Gratis, salvo que nos pidas eliminarlos.</li></ul> },
      { id: 'baja', title: 'Si pasaron más de 10 días', body: <p>Podés darte de baja cuando quieras desde <b>Plan y facturación</b>: no se te cobra más y seguís usando el plan hasta el final del período pagado. Lo explicamos en la página de <Link href="/baja">baja del servicio</Link>.</p> },
      { id: 'reclamos', title: 'Reclamos', body: <p>Si algo no salió como esperabas, escribinos a <a href="mailto:hola@rentiaapp.com">hola@rentiaapp.com</a> con tu código. También podés hacer un reclamo ante <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener noreferrer">Defensa de las y los Consumidores</a>.</p> },
    ]}/>;
}
