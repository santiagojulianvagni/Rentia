import test from 'node:test';
import assert from 'node:assert/strict';
import {monthGoal} from '../lib/month-goal.ts';

test('the month goal says if you are ahead, behind or done, and how much to sell per day',()=>{
  // 30 días, día 20: lo ideal es llevar dos tercios de la meta.
  const ahead=monthGoal({custom:null,breakEven:30000000,revenue:21000000,elapsed:20,totalDays:30,projected:31500000});
  assert.equal(ahead.source,'equilibrio');assert.equal(ahead.status,'adelantado');
  assert.equal(ahead.ideal,20000000);assert.equal(ahead.remaining,9000000);assert.equal(ahead.perDay,900000);
  assert.equal(monthGoal({custom:null,breakEven:30000000,revenue:18000000,elapsed:20,totalDays:30,projected:30500000}).status,'llegas');
  assert.equal(monthGoal({custom:null,breakEven:30000000,revenue:15000000,elapsed:20,totalDays:30,projected:22500000}).status,'atrasado');
  const done=monthGoal({custom:null,breakEven:30000000,revenue:31000000,elapsed:25,totalDays:30,projected:37000000});
  assert.equal(done.status,'cumplida');assert.equal(done.perDay,null);assert.equal(done.progress,1);
});

test('your own goal replaces the break-even, and without either there is no goal',()=>{
  const own=monthGoal({custom:50000000,breakEven:30000000,revenue:10000000,elapsed:10,totalDays:30,projected:30000000});
  assert.equal(own.source,'propia');assert.equal(own.target,50000000);assert.equal(own.status,'atrasado');
  assert.equal(monthGoal({custom:null,breakEven:null,revenue:1000,elapsed:3,totalDays:30,projected:10000}),null);
});
