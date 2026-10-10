// Every read is tenant-scoped. Batch size bounds memory, not the total history.
// Retired Mercado Libre variations can survive in orders after the publication
// becomes a single-variant item. Inherit only that exact publication's base cost,
// never a different live variation, product, provider, or tenant.
export const ITEM_COST_JOINS=`LEFT JOIN product_variants pv ON pv.user_id=oi.user_id AND pv.provider=oi.provider AND pv.external_variant_id=oi.external_variant_id AND (oi.external_product_id IS NULL OR pv.external_product_id=oi.external_product_id)
  LEFT JOIN product_variants base ON oi.provider='mercadolibre' AND pv.id IS NULL AND base.user_id=oi.user_id AND base.provider=oi.provider AND base.external_product_id=oi.external_product_id AND base.external_variant_id=oi.external_product_id
  LEFT JOIN order_item_cost_overrides oc ON oc.user_id=oi.user_id AND oc.provider=oi.provider AND oc.external_order_id=oi.external_order_id AND oc.external_line_id=oi.external_line_id`;
export const ITEM_UNIT_COST_SQL='COALESCE(oc.unit_cost,pv.manual_cost,NULLIF(pv.cost,0),base.manual_cost,NULLIF(base.cost,0),oi.unit_cost,0)';
export const ITEM_COST_SOURCE_SQL="CASE WHEN oc.unit_cost IS NOT NULL THEN 'orden_manual' WHEN pv.manual_cost IS NOT NULL THEN 'manual' WHEN pv.cost>0 THEN 'tiendanube' WHEN base.manual_cost IS NOT NULL OR base.cost>0 THEN 'publicacion' WHEN oi.unit_cost>0 THEN 'orden' ELSE 'sin_costo' END";
export const ITEM_COST_MISSING_SQL='oc.unit_cost IS NULL AND pv.manual_cost IS NULL AND base.manual_cost IS NULL AND COALESCE(pv.cost,0)<=0 AND COALESCE(base.cost,0)<=0 AND COALESCE(oi.unit_cost,0)<=0';
export const ORDER_ANALYTICS_SELECT=`SELECT o.id AS cursor_id,o.provider,o.external_order_id,o.order_number,o.currency,o.status,o.payment_status,o.payment_method,o.payment_type,o.payment_installments,o.shipping_status,o.source_shipping_cost,o.source_commission_cost,o.manual_commission_cost,o.total,o.subtotal,o.discount,o.source_created_at,o.meli_post_sale_json,o.meli_post_sale_checked_at,o.meli_refund_adjustment_json,
  COALESCE(SUM(oi.quantity*${ITEM_UNIT_COST_SQL}),0) AS product_cost,
  COUNT(oi.id) AS item_count,
  SUM(CASE WHEN oi.id IS NOT NULL AND ${ITEM_COST_MISSING_SQL} THEN 1 ELSE 0 END) AS missing_product_costs
  FROM orders o LEFT JOIN order_items oi ON oi.user_id=o.user_id AND oi.provider=o.provider AND oi.external_order_id=o.external_order_id
  ${ITEM_COST_JOINS}`;
export const ORDER_SCOPE='o.user_id=? AND o.source_created_at>=? AND o.source_created_at<?';
export const ORDER_SEARCH="strpos(lower(COALESCE(o.order_number,'') || ' ' || o.external_order_id || ' ' || COALESCE(o.payment_method,'')),lower(?::text))>0";
export const ORDER_ANALYTICS_BATCH_SQL=`${ORDER_ANALYTICS_SELECT} WHERE ${ORDER_SCOPE} AND ${ORDER_SEARCH} AND (o.source_created_at>? OR (o.source_created_at=? AND o.id>?)) GROUP BY o.id ORDER BY o.source_created_at,o.id LIMIT ?`;
export const ORDER_PAGE_SQL=`${ORDER_ANALYTICS_SELECT} WHERE ${ORDER_SCOPE} AND ${ORDER_SEARCH} GROUP BY o.id ORDER BY o.source_created_at DESC,o.id DESC LIMIT ? OFFSET ?`;
export const ORDER_COUNT_SQL=`SELECT COUNT(*) AS total FROM orders o WHERE ${ORDER_SCOPE} AND ${ORDER_SEARCH}`;
export const PAID_TOTAL_SQL=`SELECT COUNT(*) AS orders,COALESCE(SUM(o.total),0) AS revenue FROM orders o WHERE ${ORDER_SCOPE} AND o.payment_status='paid' AND o.status!='cancelled'`;
export const PRODUCT_SALES_BATCH_SQL=`SELECT o.provider,o.id AS order_cursor,oi.id AS line_cursor,COALESCE(pv.id,base.id) AS variant_id,oi.external_order_id,oi.quantity,oi.unit_price,${ITEM_UNIT_COST_SQL} AS unit_cost,o.total AS order_total,o.currency,o.payment_method,o.payment_type,o.payment_installments,o.source_shipping_cost,o.source_commission_cost,o.manual_commission_cost,o.source_created_at,
  (SELECT COALESCE(SUM(g.quantity*g.unit_price),0) FROM order_items g WHERE g.user_id=oi.user_id AND g.provider=oi.provider AND g.external_order_id=oi.external_order_id) AS order_gross
  FROM orders o JOIN order_items oi ON oi.user_id=o.user_id AND oi.provider=o.provider AND oi.external_order_id=o.external_order_id
  ${ITEM_COST_JOINS}
  WHERE ${ORDER_SCOPE} AND o.payment_status='paid' AND o.status!='cancelled' AND (o.id>? OR (o.id=? AND oi.id>?)) ORDER BY o.id,oi.id LIMIT ?`;
