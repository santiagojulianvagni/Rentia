import test from 'node:test';
import assert from 'node:assert/strict';
import {historyEntitlement,historyStartDate,RENTIA_PLANS} from '../lib/plans.ts';
import {clampToHistory} from '../lib/analytics-range.ts';

// Historial visible según el plan: Gratis y Starter 12 meses, Growth 24, Pro y Scale 36, Enterprise todo.
test('each plan shows its months of history, and only a paid plan widens it',()=>{
  assert.deepEqual(RENTIA_PLANS.map(plan=>[plan.id,plan.historyMonths]),[['free',12],['starter',12],['growth',24],['pro',36],['scale',36],['enterprise',null]]);
  assert.equal(historyEntitlement(null).months,12);
  assert.equal(historyEntitlement({plan_id:'pro',status:'active',trial_ends_at:''}).months,36);
  assert.equal(historyEntitlement({plan_id:'growth',status:'past_due',trial_ends_at:''}).months,24,'the grace days keep the plan');
  assert.equal(historyEntitlement({plan_id:'pro',status:'trialing',trial_ends_at:'2099-01-01'}).months,12,'a chosen plan without paying does not widen it');
  assert.equal(historyEntitlement({plan_id:'enterprise',status:'active',trial_ends_at:''}).months,null);
});

test('the first visible day goes back whole months, also from the end of a month',()=>{
  assert.equal(historyStartDate(12,new Date('2026-11-08T10:00:00Z')),'2025-11-08');
  assert.equal(historyStartDate(24,new Date('2026-11-08T10:00:00Z')),'2024-11-08');
  assert.equal(historyStartDate(12,new Date('2026-03-31T10:00:00Z')),'2025-03-31');
  assert.equal(historyStartDate(1,new Date('2026-03-31T10:00:00Z')),'2026-02-28');
});

test('a custom range is cut where the plan history starts, and quick ranges are untouched',()=>{
  const custom=start=>({days:0,range:{start,end:'2026-11-08'}});
  assert.deepEqual(clampToHistory(custom('2024-01-01'),'2025-11-08'),{days:366,range:{start:'2025-11-08',end:'2026-11-08'},historyFrom:'2025-11-08'});
  assert.deepEqual(clampToHistory(custom('2026-01-01'),'2025-11-08'),custom('2026-01-01'));
  assert.deepEqual(clampToHistory({days:2,range:{start:'2024-01-01',end:'2024-01-02'}},'2025-11-08'),{days:1,range:{start:'2025-11-08',end:'2025-11-08'},historyFrom:'2025-11-08'});
  assert.deepEqual(clampToHistory({days:365,range:undefined},'2025-11-08'),{days:365,range:undefined});
  assert.deepEqual(clampToHistory(custom('2020-01-01'),null),custom('2020-01-01'),'enterprise sees everything');
});
