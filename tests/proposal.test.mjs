import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../public/proposal-model.js';
test('proposal counts only management and marketing, with separate launch costs',()=>{
 const expected={conservative:[20250,65625],base:[40125,147000],growth:[57375,226875]};
 for(const [key,[six,year]] of Object.entries(expected)){const m=calculate(key);assert.equal(m.fixed,3050);assert.equal(m.launch,4250);assert.equal(m.sixMonth.sales,six);assert.equal(m.annual.sales,year);assert.equal(m.sixMonth.cost+m.launch,22550);assert.equal(m.annual.cost,36600);assert.equal(m.afterLaunch,year-40850);assert.equal(m.sixMonthAfterLaunch,six-22550);for(const x of m.months){assert.equal(x.cost,3050);assert.equal(x.result,x.sales-3050);assert(!('garments' in x));}}
});
test('coverage is the first whole order covering the listed recurring allocation',()=>{
 for(const aov of [50,75,110])for(const ads of [500,750,3000]){const m=calculate('base',aov,ads);assert(m.coverageOrders*aov>=m.fixed);assert((m.coverageOrders-1)*aov<m.fixed);}assert.equal(calculate().coverageOrders,41);
});
test('advertising changes listed costs without changing assumed sales',()=>{
 const a=calculate('base',75,750),b=calculate('base',75,1000);assert.equal(a.annual.sales,b.annual.sales);assert.equal(b.annual.cost-a.annual.cost,3000);assert.throws(()=>calculate('invalid'));assert.throws(()=>calculate('base',75,-1));
});
