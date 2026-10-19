import test from 'node:test';
import assert from 'node:assert/strict';
import {clerkMemberCap,clerkMemberLimit} from '../lib/clerk-limits.ts';

// Clerk rechaza crear o actualizar una organización con más miembros de los que permite su
// plan (el gratuito, 5): por eso el registro fallaba al pedir 25.
test('the member limit sent to Clerk never exceeds the Clerk plan',()=>{
  assert.equal(clerkMemberCap({}),5);
  assert.equal(clerkMemberLimit(2,{}),2);
  assert.equal(clerkMemberLimit(10,{}),5);
  assert.equal(clerkMemberLimit(null,{}),5);
  assert.equal(clerkMemberLimit(10,{CLERK_ORG_MEMBER_CAP:'20'}),10);
  assert.equal(clerkMemberCap({CLERK_ORG_MEMBER_CAP:'cero'}),5);
});
