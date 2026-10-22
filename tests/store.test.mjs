import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {checkoutURL,safeCart} from '../public/shop-utils.js';
import {normalize,category} from '../lib/catalog.mjs';
const raw=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
test('real variant selections are preserved in multi-product checkout',()=>{
 const [a,b]=raw.products.map(normalize);const cart=[{id:a.variants[0].id,handle:a.handle,quantity:2},{id:b.variants[0].id,handle:b.handle,quantity:3}];
 assert.equal(checkoutURL(cart),`https://new-bedford.myshopify.com/cart/${a.variants[0].id}:2,${b.variants[0].id}:3`);
 assert.equal(checkoutURL([]),null);
});
test('corrupted persisted cart cannot create malformed checkout quantities',()=>{
 assert.deepEqual(safeCart(null),[]);assert.deepEqual(safeCart([{id:'oops',quantity:3}]),[]);
 assert.equal(safeCart([{id:123,handle:'test',quantity:-4}])[0].quantity,1);
 assert.equal(safeCart([{id:123,handle:'test',quantity:500}])[0].quantity,99);
});
test('catalog has valid product routes, numeric prices and unique variants',()=>{
 const handles=new Set(),ids=new Set();
 for(const rawP of raw.products){const p=normalize(rawP);assert(!handles.has(p.handle));handles.add(p.handle);assert.match(p.handle,/^[a-z0-9-]+$/);assert(p.images.length);for(const v of p.variants){assert(Number.isSafeInteger(v.id));assert(!ids.has(v.id));ids.add(v.id);assert(Number.isFinite(v.price));assert.equal(v.options.length,p.options.length);}}
});
test('all generated internal links, scripts and local images resolve',async()=>{
 const files=['index.html','shop.html','contact.html','marine-supply.html','our-story.html','faq.html',...(await readdir('dist/products')).map(f=>'products/'+f)];
 for(const file of files){const html=await readFile('dist/'+file,'utf8');for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[^\"]*)"/g)){let target=match[1];if(target==='/')target='/index.html';if(!/\.[a-z0-9]+$/.test(target))target+='.html';await assert.doesNotReject(access('dist'+target),`${file}: ${target}`);}}
});
