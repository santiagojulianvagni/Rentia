# Rentia: contexto para Claude

## Cómo trabajar con el dueño del proyecto

- **Todo en español rioplatense** (vos), incluidos los avisos cortos de avance. Nunca en inglés.
- Explicar sin jerga técnica: es el dueño del negocio, no un programador.
- No escribir contraseñas: los inicios de sesión los hace él.
- Al probar en producción, no modificar sus datos reales (no guardar planes, no cargar ni borrar costos, no marcar alertas).
- Las propuestas de diseño (carpeta `propuestas/`, excluida de git) quedan locales hasta que pida subirlas.
- Después de publicar, verificar en el sitio (`www.rentiaapp.com`) y contar lo que se vio, no lo que se supone.

## Qué es Rentia

SaaS de rentabilidad real para e-commerce en Argentina: une Tiendanube, Mercado Libre (ventas, cargos y Product Ads) y Meta Ads con los costos de cada tienda para mostrar la ganancia real. Compite con Escalafy y Ecomind.

- Next.js 16.4 (App Router), React 19, TypeScript. Clerk (organizaciones: una por tienda; hoy instancia de **desarrollo**). Postgres en Neon.
- Dominio `rentiaapp.com` (comprado en Hostinger, DNS ahí): `www.rentiaapp.com` es el principal y `rentiaapp.com` redirige; `rentia-ruby.vercel.app` sigue andando. Mail de contacto `hola@rentiaapp.com` (Hostinger), cargado en Vercel como `NEXT_PUBLIC_RENTIA_CONTACT_EMAIL`.
- Vercel, plan Hobby, proyecto `nexo-6cb9/rentia`. Las funciones corren en `gru1` (San Pablo), igual que la base. Se publica solo con cada push a `main`.
- `vercel-build` corre las migraciones de `migrations/` (la próxima es `0009_…`) y después compila.

## Código

- Panel: `app/panel/page.tsx` (componente cliente grande) y `components/panel/*`. Los estilos usan clases `p-` dentro de `.p-root`: `app/panel/rp.css` (base) y `app/panel/rp-extra.css` (agregados). Las secciones de configuración se cargan con `next/dynamic`.
- Sin controles genéricos del navegador: usar `RpSelect`, `RpDate`, `confirmDialog` y botones propios.
- Cálculos puros en `lib/` con pruebas en `tests/*.test.mjs` (Node test runner y PGlite): `campaign-profit`, `alerts`, `achievements`, `records`, `cashflow`. La lógica nueva va en `lib/` y lleva su prueba.
- Las rutas de API usan `route()` de `server/http/route.ts`: sesión, rol, origen, validación con zod y registro de errores en `error_reports`. Los archivos `route.ts` solo pueden exportar los métodos HTTP.
- `tests/scaling.test.mjs` cuenta las tablas (hoy 35): actualizarlo al agregar una.
- Ojo al editar con scripts de Node: en `String.replace` los patrones `$'` y `` $` `` son especiales.

## Cómo publicar

1. `npx tsc --noEmit -p .`
2. `npm run build`
3. `npm test`
4. Solo si todo pasa: commit con los archivos puntuales y `git push origin main`. No dejar archivos modificados afuera del commit.
5. Esperar el deploy (alrededor de 1 minuto) y verificar en el sitio.

## Hecho recientemente (octubre 2026)

- Panel rehecho igual a la propuesta, en computadora y celular, con las tarjetas alineadas.
- El resumen se recalcula solo cuando cambian los datos (`/api/dashboard/version`).
- Planes, términos, baja en dos pasos y límite de órdenes. El límite se activa con `RENTIA_BILLING_ENFORCED=1` cuando haya cobro.
- Ganancia estimada por campaña (Meta y Mercado Libre Ads).
- Alertas con campana: umbrales por tienda; vistas y ocultas por persona.
- Resumen semanal.
- Compartir: formato historia o publicación, QR a `/registro?ref=compartir`, récords y rachas, producto estrella con foto, sin montos por defecto.
- Cashflow: punto de equilibrio, proyección de cierre, plata por cobrar (Pago Nube y Mercado Libre), calendario semanal con día de pago de los gastos, simulador con porcentaje personalizado y alerta si el mes viene en rojo.
- Seguridad: encabezados, robots y sitemap, 404 en español, registro de errores, Next.js actualizado.
- 19/10: Blog (`/blog`, contenido en `lib/guides.ts`) y comparaciones (`/comparar/...`) **sin nombres de la competencia** (lo pidió él): contra planillas, apps de estadísticas y el ROAS de Meta.
- 19/10: portada en inglés (`/en`) y portugués (`/pt`) con selector de idioma y hreflang. Textos en `lib/landing-i18n.ts` (el español es el original; una prueba verifica que los tres idiomas tengan los mismos textos). Legales, blog y app siguen en español. En/pt avisan que hoy funciona con tiendas de Argentina.
- 19/10: Eventos (sección del panel, tabla `sales_events`, lógica en `lib/sales-events.ts`): compara un evento contra el promedio diario de las 4 semanas anteriores (salteando la semana previa) y contra la semana siguiente.

## Pendiente

**Decidido y aplicado (12/10):** los gastos fijos mensuales ya no se cargan a órdenes ni productos (muestran su margen antes de gastos fijos). Se restan una vez en la ganancia total (renglón "Gastos fijos" del desglose) y se reparten por día en el gráfico. Las alertas de margen usan `marginBeforeFixed`; la cobertura de los fijos la avisa la alerta de Cashflow.

**Próximo trabajo:**
- Inventario multicanal: unir el mismo producto de Tiendanube y Mercado Libre por SKU.
- Pixel propio y atribución (necesita aprobación de Tiendanube y Meta).
- Emails (alertas, resumen semanal, código de baja): falta que cree una cuenta en Resend.
- Sentry: falta el DSN.

**Depende de él:**
- Constituir la SRL (para cobrar con Mercado Pago y verificar el negocio en Meta).
- Pasar a Vercel Pro y activar el límite de gasto.
- Clerk en producción: listo desde el 19/10 (dominio rentiaapp.com verificado, organizaciones con membresía obligatoria, contraseña de 8 con fuerza mínima y rechazo de filtradas, Google con credenciales propias del proyecto de Google Cloud "Rentia" publicado en producción). Pendiente: plan Pro de Clerk para exigir mayúscula, minúscula, número y símbolo, y para más de 5 miembros por tienda (los planes Pro y Scale de Rentia prometen 10 y 20). Al pasarlo, poner CLERK_ORG_MEMBER_CAP en Vercel. Agregar `https://www.rentiaapp.com` en las apps de Mercado Libre, Meta y Tiendanube y recién después poner `RENTIA_PUBLIC_ORIGIN=https://www.rentiaapp.com` en Vercel.
- Trámites de permisos en Meta, Mercado Libre (publicidad) y Tiendanube.
- Revisión legal (incluye el paso de escribir "DAR DE BAJA").
- Decidir si suma analítica de visitas.
