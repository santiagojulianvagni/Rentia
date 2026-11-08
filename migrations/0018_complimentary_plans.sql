-- Plan sin cargo (Enterprise) para las tiendas de los dueños de Rentia: no pasa por Mercado Pago
-- ni vence. Se identifica por la huella del email del dueño (la misma de lib/billing-checkout.ts),
-- no por el email, porque el repositorio es público. Para regalar un plan a otra tienda se usa
-- grantComplimentaryPlan (db/database.ts).
UPDATE subscriptions SET
  provider='complimentary',
  provider_status='complimentary',
  provider_subscription_id=NULL,
  provider_amount=NULL,
  plan_id='enterprise',
  requested_plan_id=NULL,
  status='active',
  cancel_at_period_end=FALSE,
  canceled_at=NULL,
  canceled_by=NULL,
  past_due_since=NULL,
  current_period_end=NULL,
  current_period_start=COALESCE(current_period_start,to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
  updated_at=to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE user_id IN (
  SELECT user_id FROM accounts
  WHERE encode(sha256(convert_to('rentia-tester:'||lower(trim(email)),'UTF8')),'hex') IN (
    'd54d7d22fdd808660cfaa39fcbe81e05c1dd4e3975e98abecb40ed22f59200de',
    '5f30737650ee791d884f4cfd7ec6c0f42e8ccfaac8c661799288c83cb23ac771'
  )
);
