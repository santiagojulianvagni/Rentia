# Rentia

Ventas, rentabilidad, productos, publicidad e informes para e-commerce.

## Tecnología

- Next.js 16 (App Router), React y TypeScript.
- Vercel para el hosting y Postgres de Neon para la base de datos.
- Clerk para las cuentas y la autenticación.
- Integraciones con Tiendanube, Mercado Libre, Product Ads y Meta Ads.

## Publicar en Vercel

1. Importar este repositorio en Vercel (New Project).
2. En el proyecto: **Storage → Create Database → Neon**. Eso carga `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.
3. Completar el resto de las variables de `.env.example` en **Settings → Environment Variables**.
4. Deploy. En cada deploy, `npm run vercel-build` aplica las migraciones de `migrations/` y después compila.

Después del primer deploy hay que actualizar las URLs de retorno (callback) en Tiendanube, Mercado Libre y Meta con el dominio nuevo, y completar `RENTIA_PUBLIC_ORIGIN` con ese dominio.

## Desarrollo

```sh
npm ci
npm run db:migrate   # con DATABASE_URL en .env.local
npm run dev
```

- `npm test`: tests unitarios y de escala contra un Postgres en memoria (PGlite).
- `npm run test:integration`: verificaciones de Mercado Libre, facturación, Product Ads y OAuth, también sobre PGlite.
- Los tests requieren Node 24.

## Carpetas

- `app/`: páginas, estilos y API.
- `components/`: interfaz de usuario.
- `lib/`: lógica de negocio e integraciones.
- `db/`: acceso a la base de datos (`db/client.ts` es la conexión).
- `server/http/`: autenticación, validación y errores de la API.
- `migrations/`: esquema de Postgres.
- `tests/` y `scripts/`: pruebas y verificaciones.

Algunos documentos de `docs/` describen la etapa anterior en Cloudflare (Workers y D1).
