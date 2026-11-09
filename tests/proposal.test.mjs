import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../public/proposal-model.js';
test('proposal model reconciles revenue, costs and launch cash under each scenario',()=>{
 for(const s of ['conservative','base','growth']){const m=calculate(s);assert.equal(m.fixed,3200);assert.equal(m.months.length,12);for(const x of m.months){assert.equal(x.sales,x.orders*75);assert.equal(x.overage,Math.max(0,x.orders-75)*4);assert(Math.abs(x.cost-(x.garments+x.payments+x.shipping+x.packaging+x.returns+x.fixed+x.overage))<.001);assert.equal(x.result,x.sales-x.cost);}assert.equal(m.afterLaunch,m.annual.result-4600);assert.equal(m.annual.orders,m.months.reduce((n,x)=>n+x.orders,0));}
});
test('break-even is the first whole-order volume covering all modeled costs',()=>{
 for(const aov of [50,75,110])for(const margin of [40,55,70])for(const ads of [500,750,3000]){const m=calculate('base',aov,margin,ads),net=n=>n*aov*(margin/100-.165)-m.fixed-Math.max(0,n-75)*4;assert(net(m.breakEvenOrders)>=-1e-8);assert(net(m.breakEvenOrders-1)<0);}
});
test('advertising changes cost without inventing additional demand',()=>{const a=calculate('base',75,55,750),b=calculate('base',75,55,1000);assert.equal(a.annual.sales,b.annual.sales);assert.equal(b.annual.cost-a.annual.cost,3000);assert.throws(()=>calculate('invalid'));});
