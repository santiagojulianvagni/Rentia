// Contenido del blog y de las comparaciones del sitio público. Sin marcas de la competencia:
// se compara contra formas de trabajar (planillas, apps de estadísticas, el ROAS de Meta).
export type GuideBlock=string|{list:string[]}|{formula:string;note?:string}|{tip:string};
export type GuideSection={id:string;title:string;blocks:GuideBlock[]};
export type Guide={
  slug:string;tag:string;title:string;description:string;published:string;minutes:number;
  sections:GuideSection[];
};
export type Comparison={
  slug:string;label:string;title:string;description:string;intro:string;
  otherName:string;chooseOtherTitle:string;rows:Array<[string,string,string]>;
  chooseOther:string[];chooseRentia:string[];
  sections:GuideSection[];faqs:Array<[string,string]>;
};

export const guides:Guide[]=[
  {
    slug:'ganancia-real-tienda-online',tag:'RENTABILIDAD',published:'2026-10-19',minutes:6,
    title:'Cómo calcular la ganancia real de tu tienda online',
    description:'Vender más no siempre es ganar más. Qué costos restar a cada venta, en qué orden y cómo evitar los errores más comunes al calcular la ganancia de tu e-commerce.',
    sections:[
      {id:'ventas-no-son-ganancia',title:'Las ventas no son tu ganancia',blocks:[
        'El panel de tu tienda te muestra cuánto facturaste. Es un buen número para saber si el negocio se mueve, pero no te dice cuánto te queda. Entre la venta y tu bolsillo hay una fila de costos que muchas veces no se ven en el mismo lugar: el producto, el envío, la comisión del medio de pago, los impuestos, la publicidad y los gastos fijos del mes.',
        'Por eso es común vender récord en un mes y llegar a fin de mes con la misma plata, o menos. No es mala suerte: es que la ganancia se mide con todos los costos, no con las ventas.',
      ]},
      {id:'que-restar',title:'Qué restarle a cada venta',blocks:[
        'Para cada orden, partí del total cobrado y restá, en este orden:',
        {list:[
          'Costo del producto: lo que te costó comprar o fabricar cada unidad vendida (incluí el envase si lo pagás aparte).',
          'Envío: lo que pagaste vos, aunque el cliente lo haya visto "gratis".',
          'Comisiones: la del medio de pago (por ejemplo, Pago Nube o Mercado Pago), la del marketplace y el costo de las cuotas sin interés si las ofrecés.',
          'Impuestos que dependen de la venta, como Ingresos Brutos o las retenciones que te hacen al cobrar.',
          'Publicidad: lo que invertiste en Meta Ads, Google o los anuncios de Mercado Libre en ese período.',
        ]},
        'Lo que queda es la contribución de tus ventas. Recién después restás los gastos fijos del mes (alquiler, sueldos, herramientas, contador) para llegar a la ganancia del negocio.',
        {formula:'Ganancia = ventas − producto − envío − comisiones − impuestos − publicidad − gastos fijos'},
      ]},
      {id:'ejemplo',title:'Un ejemplo con números',blocks:[
        'Una orden de $100.000 con un producto que te costó $35.000, un envío de $5.000, comisiones por $7.000 e impuestos por $5.000 deja $48.000 antes de publicidad. Si ese día invertiste $18.000 en anuncios para traer esa venta, quedan $30.000: un margen del 30%.',
        'Mirado solo desde las ventas, parecía un día de $100.000. Mirado desde la ganancia, fue un día de $30.000. Las dos cifras son ciertas, pero solo una te dice si te conviene seguir invirtiendo igual.',
        {tip:'Si a una orden le falta un costo (por ejemplo, el del producto), no la cuentes como ganancia segura. Marcala como provisoria hasta completarla: una ganancia sin todos los costos siempre parece más linda de lo que es.'},
      ]},
      {id:'errores',title:'Los errores más comunes',blocks:[
        {list:[
          'Usar un porcentaje fijo para las comisiones cuando cada medio de pago y cada cantidad de cuotas cobra distinto.',
          'Olvidar el envío "gratis": para el cliente es gratis, para vos no.',
          'Restar la publicidad del mes entero contra las ventas de una sola semana, o al revés.',
          'Repartir los gastos fijos dentro de cada producto: así un producto parece malo solo porque vendió poco ese mes.',
          'No actualizar el costo de los productos cuando sube la mercadería.',
        ]},
      ]},
      {id:'automatizarlo',title:'Cómo automatizarlo',blocks:[
        'Hacerlo a mano en una planilla funciona con pocas órdenes. Cuando vendés todos los días por más de un canal, mantener los cargos al día lleva horas y los errores de fórmula aparecen solos.',
        'Rentia conecta Tiendanube, Mercado Libre y Meta Ads, importa los cargos reales que informa cada canal y calcula la ganancia de cada orden con los costos que cargaste. Si falta un dato, te lo señala en lugar de esconderlo en el resultado.',
      ]},
    ],
  },
  {
    slug:'roas-de-equilibrio',tag:'PUBLICIDAD',published:'2026-10-19',minutes:5,
    title:'ROAS de equilibrio: cuánto podés gastar en publicidad sin perder plata',
    description:'Un ROAS de 3 puede ser excelente o puede hacerte perder plata. Cómo calcular el ROAS mínimo que necesita tu tienda según tu margen.',
    sections:[
      {id:'que-es-roas',title:'Qué es el ROAS y qué no te dice',blocks:[
        'El ROAS compara las ventas que la plataforma atribuye a tus anuncios con lo que invertiste. Si invertís $10.000 y Meta te atribuye $30.000 en ventas, tu ROAS es 3.',
        'El problema es que el ROAS no sabe cuánto te costó el producto, el envío ni las comisiones. Un ROAS de 3 con un margen alto deja mucha plata; el mismo ROAS con un margen chico puede dejarte en rojo.',
      ]},
      {id:'calculo',title:'Cómo se calcula el ROAS de equilibrio',blocks:[
        'Primero calculá tu margen antes de publicidad: lo que queda de cada $100 de venta después de restar producto, envío, comisiones e impuestos.',
        {formula:'ROAS de equilibrio = 1 ÷ margen antes de publicidad',note:'Con el margen expresado como número decimal (40% = 0,40).'},
        'Si tu margen antes de publicidad es del 40%, tu ROAS de equilibrio es 1 ÷ 0,40 = 2,5. Con un ROAS de 2,5 no ganás ni perdés: cada peso de publicidad se lleva toda la ganancia de las ventas que trae. Por encima de 2,5 ganás; por debajo, perdés.',
      ]},
      {id:'tabla',title:'Una referencia rápida',blocks:[
        {list:[
          'Margen antes de publicidad 60% → ROAS de equilibrio 1,67',
          'Margen 50% → ROAS de equilibrio 2',
          'Margen 40% → ROAS de equilibrio 2,5',
          'Margen 30% → ROAS de equilibrio 3,33',
          'Margen 20% → ROAS de equilibrio 5',
        ]},
        'Fijate cómo crece: cuando el margen es chico, el ROAS que necesitás se dispara. Por eso subir un poco el precio o bajar el costo de envío a veces mejora más tus anuncios que tocar la campaña.',
      ]},
      {id:'atribucion',title:'Cuidado con las ventas atribuidas',blocks:[
        'Meta cuenta como suya una venta si la persona vio o tocó un anuncio dentro de su ventana de atribución. Esa misma venta también puede aparecer en Google o venir de alguien que te iba a comprar igual. Si sumás lo que se atribuye cada plataforma, muchas veces da más que lo que vendiste de verdad.',
        'Por eso conviene mirar dos cosas a la vez: el ROAS de cada campaña para compararlas entre sí, y la ganancia total de la tienda después de toda la publicidad para saber si el conjunto funciona.',
        {tip:'Si el ROAS de una campaña está apenas por encima del equilibrio, no la escales todavía: un pequeño cambio en el costo o en la atribución la puede dar vuelta.'},
      ]},
      {id:'en-rentia',title:'Cómo lo ves en Rentia',blocks:[
        'En la sección de campañas, Rentia calcula el ROAS de equilibrio con tu margen real del canal y te dice, para cada campaña de Meta Ads y de Mercado Libre, si deja ganancia, está en equilibrio o pierde plata. Es una estimación basada en las ventas que la plataforma atribuye, y así se indica en el panel.',
      ]},
    ],
  },
  {
    slug:'cargos-mercado-libre',tag:'MERCADO LIBRE',published:'2026-10-19',minutes:5,
    title:'Qué te descuenta Mercado Libre en cada venta',
    description:'Cargo por venta, envíos, cuotas, impuestos y publicidad: los conceptos que hacen que lo que cobrás en Mercado Libre sea menos que el precio publicado.',
    sections:[
      {id:'precio-vs-cobro',title:'El precio publicado no es lo que cobrás',blocks:[
        'Cuando vendés en Mercado Libre, entre el precio que ve el comprador y la plata que te queda en la cuenta hay varios descuentos. Algunos se ven en el detalle de la venta y otros aparecen después, en la facturación del mes. Si no los mirás todos juntos, la ganancia de cada publicación parece mayor de lo que es.',
        {tip:'Los porcentajes y montos cambian según la categoría, el tipo de publicación, tu reputación y tu situación fiscal, y Mercado Libre los actualiza seguido. Tomá siempre los valores de tu propia cuenta, no los de una tabla general.'},
      ]},
      {id:'conceptos',title:'Los conceptos que más pesan',blocks:[
        {list:[
          'Cargo por venta: un porcentaje del precio que depende de la categoría y del tipo de publicación (clásica o premium).',
          'Costo fijo por unidad: en productos de precio bajo, Mercado Libre suma un monto fijo por cada unidad vendida.',
          'Cuotas sin interés: en las publicaciones que las ofrecen, el costo de financiar esas cuotas lo pagás vos.',
          'Envíos: según el precio del producto y tu reputación, pagás todo o parte del envío, aunque el comprador lo vea gratis.',
          'Impuestos y retenciones: al cobrar te pueden retener Ingresos Brutos, IVA o Ganancias según tu condición y tu provincia.',
          'Product Ads: si promocionás tus publicaciones, la inversión en anuncios es otro costo de esas ventas.',
        ]},
      ]},
      {id:'devoluciones',title:'Devoluciones y reclamos',blocks:[
        'Cuando una venta termina en devolución o reclamo, el problema no es solo la plata que devolvés. Según el caso, también podés perder el envío de ida y de vuelta y el producto, si vuelve dañado. Esas pérdidas conviene registrarlas aparte, para ver cuánto te cuestan por mes.',
      ]},
      {id:'como-verlo',title:'Cómo verlo todo junto',blocks:[
        'La forma manual es cruzar cada venta con el detalle de cargos y con la facturación del mes. Rentia lo hace solo: trae las ventas, los cargos y los Product Ads de Mercado Libre, los separa de tus ventas de Tiendanube para no duplicarlas, y calcula la ganancia de cada orden y de cada publicación con el costo de tus productos.',
      ]},
    ],
  },
  {
    slug:'hot-sale-cyber-monday-ganancia',tag:'FECHAS ESPECIALES',published:'2026-10-19',minutes:5,
    title:'Hot Sale y Cyber Monday: cómo saber si de verdad ganaste plata',
    description:'Las fechas especiales venden mucho, pero con descuentos, cuotas y más publicidad. Cómo comparar el evento contra una semana normal para saber si valió la pena.',
    sections:[
      {id:'vender-mas',title:'Vender más no es ganar más',blocks:[
        'En el Hot Sale o el Cyber Monday casi todas las tiendas venden más que una semana normal. La pregunta importante es otra: ¿ganaste más que en una semana normal? Con descuentos más grandes, más cuotas sin interés y más inversión en publicidad, el margen de cada venta baja. Si baja demasiado, podés vender el doble y ganar lo mismo, o menos.',
      ]},
      {id:'comparar',title:'Compará contra una semana normal',blocks:[
        'Tomá los días del evento y compáralos con la misma cantidad de días de una semana típica, antes del evento. En los dos períodos mirá:',
        {list:[
          'Ventas y cantidad de órdenes.',
          'Ticket promedio: con descuentos suele bajar.',
          'Margen antes de publicidad: cuánto te dejaron las ventas después de producto, envío, comisiones e impuestos.',
          'Inversión en publicidad y ROAS.',
          'Ganancia final del período.',
        ]},
        'La cuenta que importa es la diferencia de ganancia entre los dos períodos, no la diferencia de ventas.',
      ]},
      {id:'despues',title:'No te olvides del después',blocks:[
        'Muchas compras del evento se adelantan: gente que te iba a comprar la semana siguiente compró antes y con descuento. Por eso conviene mirar también la semana posterior. Si cae mucho por debajo de lo normal, parte de lo que vendiste en el evento no fue venta nueva.',
        {tip:'Prepará el evento con el stock y los costos al día. Un producto sin costo cargado o vendido sin stock durante el evento distorsiona toda la comparación.'},
      ]},
      {id:'decidir',title:'Qué decidir para el próximo',blocks:[
        {list:[
          'Si el margen cayó mucho, probá descuentos más chicos en tus productos de menor margen y concentrá la promoción en los que aguantan.',
          'Si la publicidad se llevó la ganancia, revisá el ROAS de equilibrio de cada campaña antes de subir el presupuesto.',
          'Si la semana siguiente se desplomó, el evento solo adelantó ventas: evaluá si te conviene participar con todo el catálogo.',
        ]},
        'En Rentia podés comparar cualquier período contra otro y ver la ganancia, el margen y la publicidad de cada uno. Estamos sumando una sección de eventos para que la comparación con una semana normal quede armada sola.',
      ]},
    ],
  },
];

export const comparisons:Comparison[]=[
  {
    slug:'planillas-de-excel',label:'Planillas de Excel',otherName:'Planilla',chooseOtherTitle:'Te alcanza con una planilla si…',
    title:'Rentia vs una planilla de Excel',
    description:'Calcular la ganancia de tu tienda en una planilla funciona al principio. Qué cambia cuando las ventas, los cargos y la publicidad se cargan solos.',
    intro:'La planilla es el primer paso de casi todas las tiendas, y está bien: obliga a mirar los costos. El problema aparece cuando vendés todos los días, por más de un canal, y mantenerla al día te lleva horas.',
    rows:[
      ['Cargar las ventas','A mano o exportando cada semana','Se sincronizan solas desde Tiendanube y Mercado Libre'],
      ['Comisiones y cargos','Un porcentaje estimado','Los cargos reales que informa cada canal, orden por orden'],
      ['Publicidad','Copiás los números del administrador de anuncios','Meta Ads y Product Ads de Mercado Libre, por día y por campaña'],
      ['Corregir un costo','Revisar fórmulas y rehacer meses','Lo cargás una vez y se recalculan todas las órdenes'],
      ['Ganancia por producto y por orden','Posible, con mucho trabajo','Automática'],
      ['Datos que faltan','Quedan en cero sin que lo notes','Rentia te avisa qué falta y marca la ganancia como provisoria'],
      ['Equipo','Todos editan el mismo archivo','Roles de propietario, administrador y consulta'],
      ['Precio','Gratis','Plan gratis hasta 50 órdenes por mes; planes pagos desde USD 15'],
    ],
    chooseOther:[
      'Vendés pocas órdenes por mes y te alcanza con una revisión semanal.',
      'Tenés costos muy particulares que querés modelar a tu manera.',
      'Querés armar tus propios cálculos y no te molesta mantenerlos.',
    ],
    chooseRentia:[
      'Vendés todos los días y no querés pasar horas cargando datos.',
      'Vendés en Tiendanube y en Mercado Libre, o invertís en publicidad.',
      'Querés saber la ganancia de cada orden y de cada producto, no solo la del mes.',
      'Trabajás en equipo y no querés que alguien rompa una fórmula.',
    ],
    sections:[
      {id:'donde-falla',title:'Dónde se complica la planilla',blocks:[
        'Las comisiones cambian según el medio de pago y las cuotas; Mercado Libre cobra cargos distintos por categoría y por envío; Meta reparte la inversión en varias campañas. En una planilla, cada uno de esos datos es una columna más que hay que completar a tiempo. Cuando falta uno, la celda queda en cero y la ganancia se ve mejor de lo que es.',
      ]},
      {id:'que-cambia',title:'Qué cambia con Rentia',blocks:[
        'Conectás tus canales una vez y Rentia trae hasta 12 meses de historial. Cargás el costo de cada producto o SKU, configurás envíos e impuestos, y desde ahí cada venta nueva llega con su ganancia calculada. Si corregís un costo, se aplica a todas las órdenes de ese producto sin rehacer nada.',
        {tip:'Rentia no reemplaza a tu contador ni presenta impuestos: es una herramienta para entender la operación y tomar decisiones.'},
      ]},
    ],
    faqs:[
      ['¿Puedo seguir usando mi planilla?','Sí. Muchas tiendas usan Rentia para el día a día y su planilla para cálculos propios o para su contador.'],
      ['¿Tengo que cargar el costo de todos los productos?','Para que la ganancia sea completa, sí. Podés cargarlo por producto o por SKU, y Rentia te muestra cuáles faltan.'],
    ],
  },
  {
    slug:'apps-de-estadisticas',label:'Apps de estadísticas',otherName:'App de estadísticas',chooseOtherTitle:'Te conviene una app de estadísticas si…',
    title:'Rentia vs una app de estadísticas de tu tienda',
    description:'Las apps de estadísticas te muestran cuánto vendés. Rentia te muestra cuánto ganás. Cuándo te sirve cada una.',
    intro:'Las apps de estadísticas suman una capa de lectura sobre el panel de tu tienda: ventas, pedidos, productos más vendidos y evolución entre períodos. Son útiles para entender qué pasa con las ventas. Rentia mira otra cosa: qué queda de esas ventas después de los costos y la publicidad.',
    rows:[
      ['Ventas, pedidos y comparación de períodos','Sí','Sí'],
      ['Visitas y conversión de la tienda','Muchas lo muestran','No, por ahora'],
      ['Costo de producto, envío y comisiones','Por lo general, no','Sí, con los cargos reales de cada canal'],
      ['Publicidad (Meta Ads y Product Ads)','Por lo general, no','Sí, por día y por campaña'],
      ['Mercado Libre junto a tu tienda','Suelen mirar un solo canal','Sí, separado por canal y sin duplicar ventas'],
      ['Ganancia y margen por orden y producto','No','Sí'],
      ['Punto de equilibrio y cashflow','No','Sí, con la plata por cobrar de cada canal'],
      ['Alertas de margen y de publicidad','No','Sí'],
    ],
    chooseOther:[
      'Lo que más te importa es el tráfico y la conversión de tu tienda.',
      'Vendés por un solo canal y no invertís en publicidad.',
      'Tus márgenes son estables y ya los conocés bien.',
    ],
    chooseRentia:[
      'Querés saber cuánto ganás, no solo cuánto vendés.',
      'Invertís en Meta Ads o en Product Ads y querés saber si te deja plata.',
      'Vendés en Tiendanube y en Mercado Libre y querés verlos juntos.',
      'Necesitás planificar la caja del mes: gastos fijos, punto de equilibrio y cobros.',
    ],
    sections:[
      {id:'pregunta',title:'Depende de la pregunta que tengas',blocks:[
        '"¿Cuánto vendí este mes?" y "¿Cuánto gané este mes?" parecen la misma pregunta, pero necesitan datos distintos. Para la primera alcanza con las ventas. Para la segunda hacen falta el costo de cada producto, los envíos, las comisiones, los impuestos y la publicidad.',
        'Si tu duda es por qué entra poca gente a la tienda, una app de estadísticas te va a servir más. Si tu duda es por qué vendés más y no te queda más plata, eso es lo que resuelve Rentia.',
      ]},
      {id:'juntas',title:'¿Se pueden usar las dos?',blocks:[
        'Sí. No se pisan: una mira el comportamiento de la tienda y la otra, la rentabilidad. Lo importante es no tomar decisiones de precio o de publicidad mirando solo las ventas.',
      ]},
    ],
    faqs:[
      ['¿Rentia muestra las visitas de mi tienda?','Hoy no. Rentia se enfoca en ventas, costos, publicidad y ganancia.'],
      ['¿Necesito Mercado Libre para usar Rentia?','No. Podés conectar solo Tiendanube, solo Mercado Libre o los dos, y sumar Meta Ads.'],
    ],
  },
  {
    slug:'roas-de-meta',label:'Mirar solo el ROAS de Meta',otherName:'Solo el ROAS de Meta',chooseOtherTitle:'Te alcanza con el ROAS de Meta…',
    title:'Rentia vs mirar solo el ROAS de Meta',
    description:'El ROAS de Meta compara ventas atribuidas con inversión, pero no conoce tus costos. Qué te falta para saber si tus anuncios dejan ganancia.',
    intro:'El administrador de anuncios de Meta es la mejor herramienta para comparar tus anuncios entre sí. Pero el ROAS que muestra no sabe cuánto te cuesta cada producto, el envío ni las comisiones. Un ROAS de 3 puede ser excelente o puede estar haciéndote perder plata.',
    rows:[
      ['Qué mide','Ventas atribuidas ÷ inversión','Ganancia después de costos y publicidad'],
      ['Ventas que cuenta','Las que Meta se atribuye según su ventana','Todas las ventas reales de tu tienda, por canal'],
      ['Costo de productos, envíos y comisiones','No los conoce','Sí'],
      ['ROAS mínimo para no perder plata','No te lo dice','Equilibrio calculado con tu margen real'],
      ['Ganancia por campaña','No','Estimada: ventas atribuidas × tu margen − inversión'],
      ['Publicidad de Mercado Libre','No','Sí, Product Ads con su inversión'],
    ],
    chooseOther:[
      'Para comparar anuncios, públicos y creatividades entre sí en el día a día.',
      'Para optimizar una campaña puntual dentro de la plataforma.',
    ],
    chooseRentia:[
      'Para decidir si escalar, mantener o pausar una campaña según la ganancia.',
      'Para saber si la publicidad total del mes se pagó sola.',
      'Para comparar lo que invertís en Meta con lo que invertís en Mercado Libre.',
    ],
    sections:[
      {id:'atribucion',title:'Las ventas atribuidas no son tus ventas',blocks:[
        'Meta cuenta una venta como propia si la persona vio o tocó un anuncio dentro de su ventana de atribución. Esa venta también la puede contar otra plataforma, o la habría hecho igual. Por eso la suma de lo que se atribuye cada una suele dar más que lo que vendiste.',
        'Rentia separa las dos cosas: muestra lo que la plataforma se atribuye y, aparte, la facturación real de tu tienda. Ninguna de las dos relaciones, por sí sola, es ganancia.',
      ]},
      {id:'equilibrio',title:'El número que te falta: el ROAS de equilibrio',blocks:[
        {formula:'ROAS de equilibrio = 1 ÷ margen antes de publicidad'},
        'Con un margen del 40%, necesitás un ROAS de 2,5 solo para no perder. Rentia lo calcula con tu margen real y te dice, campaña por campaña, si deja ganancia, está en equilibrio o pierde plata.',
      ]},
    ],
    faqs:[
      ['¿Rentia cambia algo en mi cuenta de Meta?','No. La conexión es de solo lectura: Rentia lee la inversión y los resultados de tus campañas.'],
      ['¿La ganancia por campaña es exacta?','Es una estimación: usa las ventas que Meta atribuye a cada campaña y tu margen real del canal. Así se indica en el panel.'],
    ],
  },
];

export const findGuide=(slug:string)=>guides.find(guide=>guide.slug===slug);
export const findComparison=(slug:string)=>comparisons.find(item=>item.slug===slug);

export function formatGuideDate(iso:string) {
  return new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T12:00:00Z`));
}
