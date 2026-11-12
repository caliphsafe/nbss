import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateCore,calculatePaidAds,calculateProgram,fees} from '../public/proposal-model.js';

test('MA2K core fees remain separate from paid advertising',()=>{
 const core=calculateCore();
 assert.deepEqual(core,{website:3000,monthly:2500,termMonths:6,management:15000,total:18000});
 assert.equal(fees.adManagementRate,.15);
});

test('paid ads plan preserves the supplied worked examples',()=>{
 assert.deepEqual(calculatePaidAds(3000),{adSpend:3000,managementFee:450,total:3450});
 assert.deepEqual(calculatePaidAds(5000),{adSpend:5000,managementFee:750,total:5750});
 assert.deepEqual(calculatePaidAds(10000),{adSpend:10000,managementFee:1500,total:11500});
});

test('no ad spend level is required',()=>{
 assert.deepEqual(calculatePaidAds(0),{adSpend:0,managementFee:0,total:0});
 assert.throws(()=>calculatePaidAds(-1),RangeError);
 assert.throws(()=>calculateCore(0),RangeError);
});

test('starting program budget reconciles monthly, launch and six-month totals',()=>{
 assert.deepEqual(calculateProgram(),{termMonths:6,recurring:4150,launchMonth:8400,total:29150});
 assert.equal(fees.startingAdSpend,1000);
 assert.equal(fees.content,500);
 assert.equal(fees.initialShoot,1250);
});
