import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBusinessProfile,SUGGESTED_PLAN,GOAL_SECTION} from '../lib/business-profile.ts';

// Preguntas del onboarding: solo se aceptan las opciones fijas.
test('only the fixed onboarding answers are kept',()=>{
  assert.deepEqual(parseBusinessProfile({category:'cosmetica',monthlyOrders:'50-300',taxCondition:'monotributo',goal:'publicidad'}),{category:'cosmetica',monthlyOrders:'50-300',taxCondition:'monotributo',goal:'publicidad'});
  assert.deepEqual(parseBusinessProfile({category:'<script>',monthlyOrders:5,taxCondition:'',goal:undefined}),{category:null,monthlyOrders:null,taxCondition:null,goal:null});
  assert.equal(SUGGESTED_PLAN['300-1000'],'Growth');
  assert.equal(GOAL_SECTION.planificar,'cashflow');
});
