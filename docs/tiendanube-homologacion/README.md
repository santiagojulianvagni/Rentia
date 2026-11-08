# Homologación de Rentia en Tiendanube

App **Rentia #46771** (Portal de Partners con hola@rentiaapp.com). Solicitud enviada el 08/11/2026, estado "En aprobación".

Cuando Tiendanube responda la solicitud, se manda:

1. **Diagrama de secuencia:** `diagrama.pdf` (también `diagrama.png`).
2. **Video demo:** se graba siguiendo el guion de abajo.
3. **Acceso de prueba:** la tienda demo y una cuenta de Rentia de prueba. El usuario y la contraseña se mandan por el canal de Tiendanube; no se guardan acá.

## Qué ya está listo

- **Datos básicos:**
  - Categoría Estadísticas, publicada en la Tienda de aplicaciones.
  - Redirect `https://www.rentiaapp.com/api/integrations/tiendanube/callback`.
  - Permisos de solo lectura: órdenes, productos, logística y fulfillment orders.
- **Webhooks de privacidad (LGPD):** `/api/webhooks/tiendanube/privacy/{store-redact,customers-redact,customers-data-request}`.
- **Datos de publicación (Argentina):**
  - Descripción breve y larga, ícono 200×200 y 5 imágenes de 1920×1080.
  - 7 preguntas frecuentes.
  - Cobro "Gratis": Rentia cobra aparte con Mercado Pago, que es lo que indica Tiendanube para facturación propia.
  - Soporte en hola@rentiaapp.com y política de privacidad en rentiaapp.com/privacidad.
- **Instalación desde la Tienda de aplicaciones sin cuenta previa:** probada de punta a punta con la tienda demo `prueba3880` el 08/11/2026.
- **User-Agent:** `Rentia (hola@rentiaapp.com)`.
- **Otros:** no inyecta scripts en la tienda ni en el checkout, así que NubeSDK no aplica.

## Guion del video (unos 3 a 4 minutos)

Grabá la pantalla con la Herramienta Recortes de Windows: **Win + Shift + R**, elegís la zona y Grabar.

**Antes de grabar:**
- Cerrá sesión en Rentia.
- En la tienda demo, cargá 2 o 3 productos con precio y 1 o 2 ventas manuales, así el panel no aparece vacío.
- Si Rentia ya está instalada en la demo, desinstalala desde el admin de la demo: Aplicaciones → Rentia → Desinstalar.

1. **Instalación desde Tiendanube (30 s)**
   - Con la sesión del admin de la demo abierta, entrá a `https://www.tiendanube.com/apps/46771/authorize`.
   - Mostrá la pantalla de permisos, todos de solo lectura, y tocá Aceptar.
2. **Registro de un usuario nuevo (45 s)**
   - Rentia abre el registro con el aviso "Instalaste Rentia en prueba…".
   - Creá una cuenta con un mail nuevo, completá "Contanos sobre tu tienda" (el nombre ya viene completado) y continuá.
   - Mostrá Integraciones con Tiendanube "Conectada" y la actualización en tiempo real activa.
3. **Funciones principales (1 min)**
   - **Dashboard:** facturación, ganancia real y margen.
   - **Órdenes:** abrí una y mostrá el desglose de costo, envío, comisión y ganancia.
   - **Productos:** cargá el costo de un producto y mostrá cómo cambia la ganancia.
   - **Carritos abandonados, Cashflow y Resumen semanal**, rápido.
4. **Venta en tiempo real (20 s)**
   - Creá una venta manual en la demo.
   - Volvé a Rentia y mostrá que aparece sola, sin tocar "Actualizar".
5. **Desinstalar y volver a instalar (40 s)**
   - Desinstalá Rentia desde el admin de la demo y mostrá en Rentia que la conexión quedó desconectada.
   - Volvé a instalar con el link del paso 1.
6. **Ingreso de un usuario que ya tiene cuenta (30 s)**
   - Si estás logueado, cerrá sesión primero. Al volver del paso 5, Rentia muestra el registro con el aviso.
   - Tocá "Iniciar sesión" y entrá con la cuenta del paso 2.
   - Mostrá que la tienda quedó conectada de nuevo y que el historial sigue ahí.

**Después de grabar:** subilo a YouTube como "No listado" y pegá el link en la ficha, en "Video de la aplicación", o mandalo directo a Tiendanube cuando lo pidan.
