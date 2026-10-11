export const landingProducts = [
  {
    slug: 'ganancia-real', kind: 'profit', label: 'Ganancia y costos', short: 'Ganancia',
    menuDescription: 'Lo que queda de tus ventas, con los costos a la vista.',
    tag: 'RENTABILIDAD', title: 'Ganancia y costos de tu tienda',
    heading: ['Tus ventas no son', 'tu ganancia.'],
    description: 'Reuní ventas, productos, envíos, comisiones y publicidad para entender qué queda en tu tienda. Con los datos pendientes a la vista, no escondidos en el resultado.',
    benefits: ['Facturación y ganancia conocida en el mismo panel.', 'Costos por orden y comparación entre períodos.', 'Calidad de datos para saber qué falta completar.'],
    insight: 'Un número útil también te dice cuánto podés confiar en él. Si falta un costo, la ganancia sigue siendo provisoria.',
    stepsTitle: 'De una venta a un resultado que entendés.',
    steps: [
      ['Conectá tus datos', 'Sincronizá las órdenes de Tiendanube y la inversión de tu cuenta de Meta Ads.'],
      ['Completá los costos', 'Cargá productos, envíos e impuestos. Rentia usa las comisiones informadas o el respaldo que configuraste.'],
      ['Revisá lo que queda', 'Consultá la ganancia conocida y los costos pendientes antes de comparar el resultado de tu tienda.'],
    ],
    questions: [
      ['¿La ganancia incluye todos mis gastos?', 'Incluye los costos que Rentia pudo identificar y los que configuraste. Si falta información, el resultado es provisorio. Revisá Calidad de datos antes de tomar una decisión.'],
      ['¿Las comisiones de Pago Nube son reales?', 'Importamos los cargos reales que Tiendanube informa. Si todavía no están disponibles, se señala el pendiente o se usa tu respaldo configurado; una estimación no se presenta como cargo real.'],
      ['¿Reemplaza el cierre de mi contador?', 'No. Rentia ayuda a analizar la operación; no presenta impuestos ni reemplaza el asesoramiento contable.'],
    ],
  },
  {
    slug: 'productos', kind: 'products', label: 'Productos y márgenes', short: 'Productos',
    menuDescription: 'Ventas, costos y margen por producto y variante.',
    tag: 'PRODUCTOS', title: 'Ventas y margen por producto',
    heading: ['Conocé el aporte', 'de cada producto.'],
    description: 'Una lista de ventas no cuenta toda la historia. Compará unidades, costos y margen por producto para revisar tu catálogo con más información.',
    benefits: ['Resultados por producto y variante.', 'Costos identificados por SKU.', 'Información para revisar precios y promociones.'],
    insight: 'Un producto puede vender mucho y dejar poco margen. Mirá ambas cosas antes de cambiar su precio o promocionarlo.',
    stepsTitle: 'Tu catálogo, con una lectura más completa.',
    steps: [
      ['Traé tu catálogo', 'La conexión de Tiendanube reúne los productos, variantes y ventas disponibles.'],
      ['Vinculá sus costos', 'Completá el costo de cada producto o variante. El SKU permite identificarlo sin confundirlo con otro.'],
      ['Compará el período', 'Revisá ventas, costos y margen para entender qué aporta cada producto al resultado.'],
    ],
    questions: [
      ['¿Qué es un SKU?', 'Es el código que identifica un producto o una variante. Por ejemplo, una remera negra talle M puede tener un SKU distinto de la misma remera talle L.'],
      ['¿Puedo trabajar con variantes?', 'Sí. Rentia usa la información de productos y variantes de tu tienda para vincular ventas, costos y stock.'],
      ['¿Qué pasa si no cargué el costo?', 'Ese dato queda pendiente y la rentabilidad debe interpretarse como provisoria. Completalo en Costo de productos para mejorar la lectura.'],
    ],
  },
  {
    slug: 'inventario', kind: 'inventory', label: 'Inventario', short: 'Inventario',
    menuDescription: 'Stock, ritmo de ventas y reposición con contexto.',
    tag: 'INVENTARIO', title: 'Stock y planificación de inventario',
    heading: ['Que el stock acompañe', 'tus próximas ventas.'],
    description: 'Relacioná las unidades disponibles con el ritmo de venta. Detectá productos que necesitan una revisión y planificá la reposición con una estimación clara.',
    benefits: ['Stock por producto y variante.', 'Ventas diarias promedio del período.', 'Duración estimada, faltantes y productos sin movimiento.'],
    insight: '12 unidades a un ritmo de 2 por día equivalen a unos 6 días de stock. Si cambia la demanda, también cambia la estimación.',
    stepsTitle: 'Más contexto para planificar una reposición.',
    steps: [
      ['Consultá el stock', 'Revisá las unidades que informa tu tienda para cada producto y variante.'],
      ['Elegí el período', 'El ritmo diario se calcula a partir de las ventas del período que seleccionaste.'],
      ['Revisá las alertas', 'Usá la duración estimada y los productos sin movimiento como señales para planificar, no como una garantía.'],
    ],
    questions: [
      ['¿Cómo se calculan los días de stock?', 'Dividimos las unidades disponibles por las ventas diarias promedio del período. Es una estimación basada en ventas pasadas.'],
      ['¿Qué pasa si un producto no tuvo ventas?', 'Se muestra sin movimiento o sin ventas, en lugar de inventar una duración de stock. Podés revisar otro período para darle contexto.'],
      ['¿Rentia hace pedidos a mis proveedores?', 'No. Las alertas y estimaciones te ayudan a decidir; la compra y reposición las gestionás vos.'],
    ],
  },
  {
    slug: 'publicidad', kind: 'ads', label: 'Publicidad y ROAS', short: 'Publicidad',
    menuDescription: 'Meta Ads y facturación de la tienda, sin mezclar lecturas.',
    tag: 'PUBLICIDAD', title: 'Meta Ads y resultados de tu tienda',
    heading: ['Dale contexto', 'a tu publicidad.'],
    description: 'Mirá la inversión y las ventas que Meta se atribuye junto a la facturación completa de tu tienda. Dos lecturas distintas, explicadas en el mismo lugar.',
    benefits: ['Inversión, compras, ROAS y costo por compra de Meta.', 'Campañas y selección de cuenta publicitaria.', 'Facturación de tienda como referencia separada.'],
    insight: 'El ROAS mide ventas en relación con inversión, no ganancia. Para interpretar la rentabilidad, también necesitás conocer los costos.',
    stepsTitle: 'Primero entendé la lectura. Después decidí.',
    steps: [
      ['Conectá Meta Ads', 'Elegí la cuenta publicitaria que corresponde a tu tienda.'],
      ['Revisá sus métricas', 'Consultá la inversión, las compras y las ventas atribuidas que informa Meta.'],
      ['Sumá el contexto', 'Compará esa lectura con la facturación completa y los costos conocidos de tu tienda. No sumes ambas ventas.'],
    ],
    questions: [
      ['¿Por qué el ROAS de Meta y el total son distintos?', 'Meta atribuye ventas según sus reglas. La referencia total compara la facturación de tu tienda con la inversión. No miden exactamente lo mismo y ninguna relación equivale por sí sola a ganancia.'],
      ['¿Rentia cambia mis campañas?', 'No. Esta sección muestra y compara la información para ayudarte a analizarla; no modifica automáticamente los anuncios ni sus presupuestos.'],
      ['¿Puedo conectar Google Ads o TikTok hoy?', 'Hoy podés conectar Meta Ads y Product Ads de Mercado Libre. No mostramos otras plataformas como activas antes de que estén listas.'],
    ],
  },
] as const;

export type LandingProductKind = typeof landingProducts[number]['kind'];
export const findLandingProduct = (slug: string) => landingProducts.find(product => product.slug === slug);
