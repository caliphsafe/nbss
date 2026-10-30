import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,access} from 'node:fs/promises';
import {checkoutURL,safeCart} from '../public/shop-utils.js';
import {normalize,category} from '../lib/catalog.mjs';
import {ORDER_HEADERS,ORDER_STATUSES,createOrderNumber,orderToSheetRow,parseSheetOrder,validateSupplyOrder} from '../lib/supply-orders.mjs';
import {createSessionCookie,getAdminEmail} from '../api/_lib/admin-session.mjs';
import supplyOrders from '../api/supply-orders.js';
const raw=JSON.parse(await readFile(new URL('../data/catalog.json',import.meta.url),'utf8'));
function setEnv(values,t){
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 Object.assign(process.env,values);
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
}
function mockResponse(){return {statusCode:200,headers:{},body:null,setHeader(name,value){this.headers[name]=value;return this;},status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;},end(){return this;}};}
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
test('supply request validation rejects malformed values and accepts an itemized request',()=>{
 const valid={name:'Deck Lead',email:'lead@example.com',company:'F/V North Star',neededBy:'2026-11-15',handoff:'Counter pickup',message:'Need before sailing.',items:[{item:'Rope / line',qty:'600 ft · 3/4 inch'}],submissionKey:'12ab34cd-56ef-78ab-90cd-12ef345678ab'};
 assert.equal(validateSupplyOrder(valid).order.items[0].item,'Rope / line');
 assert.match(validateSupplyOrder({...valid,neededBy:'2026-13-40'}).error,/date/i);
 assert.match(validateSupplyOrder({...valid,email:'bad'}).error,/email/i);
 assert.match(validateSupplyOrder({...valid,items:[],message:''}).error,/item|note/i);
 assert.equal(validateSupplyOrder({...valid,website:'bot field'}).spam,true);
});
test('spreadsheet rows round-trip with stable request numbers and all request fields',()=>{
 const validation=validateSupplyOrder({name:'Deck Lead',email:'lead@example.com',company:'F/V North Star',neededBy:'2026-11-15',handoff:'Ask about dock delivery',message:'Call on arrival.',items:[{item:'Steel wire rope',qty:'200 ft'}],submissionKey:'12ab34cd-56ef-78ab-90cd-12ef345678ab'});
 const now=new Date('2026-10-30T13:45:00.000Z'),orderNumber=createOrderNumber(now),row=orderToSheetRow(validation.order,{orderNumber,now});
 const parsed=parseSheetOrder(row,2);
 assert.equal(row.length,ORDER_HEADERS.length);assert.equal(parsed.orderNumber,orderNumber);assert.equal(parsed.status,ORDER_STATUSES[0]);
 assert.equal(parsed.items[0].qty,'200 ft');assert.equal(parsed.staffNotes,'');assert.equal(row[15],validation.order.submissionKey);assert.equal('submissionKey' in parsed,false);
 assert.match(orderNumber,/^NB-20261030-[A-F0-9]{8}$/);
});
test('admin sessions are signed and only accepted for the configured staff allowlist',t=>{
 const oldSecret=process.env.ADMIN_SESSION_SECRET,oldEmails=process.env.ADMIN_EMAILS;
 process.env.ADMIN_SESSION_SECRET='test-secret-which-is-long-enough-for-session-signing';process.env.ADMIN_EMAILS='desk@example.com';
 t.after(()=>{if(oldSecret===undefined)delete process.env.ADMIN_SESSION_SECRET;else process.env.ADMIN_SESSION_SECRET=oldSecret;if(oldEmails===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=oldEmails;});
 const signed=createSessionCookie('desk@example.com').split(';')[0];
 assert.equal(getAdminEmail({headers:{cookie:signed}}),'desk@example.com');
 const [name,value]=signed.split('=');assert.equal(getAdminEmail({headers:{cookie:`${name}=${value}x`}}),null);
 const outsider=createSessionCookie('stranger@example.com').split(';')[0];assert.equal(getAdminEmail({headers:{cookie:outsider}}),null);
});
test('order API keeps staff data private and validates requests before spreadsheet access',async t=>{
 setEnv({APP_BASE_URL:'https://nbss.test',GOOGLE_SHEETS_SPREADSHEET_ID:'sheet-id',GOOGLE_SERVICE_ACCOUNT_EMAIL:'orders@nbss.test',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'unused',ADMIN_SESSION_SECRET:'test-secret-which-is-long-enough-for-session-signing',ADMIN_EMAILS:'desk@example.com'},t);
 const unauthenticated=mockResponse();await supplyOrders({method:'GET',headers:{}},unauthenticated);assert.equal(unauthenticated.statusCode,401);
 const invalidRequest=mockResponse();await supplyOrders({method:'POST',headers:{origin:'https://nbss.test'},body:{name:'Deck Lead',email:'bad',handoff:'Counter pickup',items:[],submissionKey:'12ab34cd-56ef-78ab-90cd-12ef345678ab'}},invalidRequest);assert.equal(invalidRequest.statusCode,400);
});
test('staff order mutations reject a cross-origin request',async t=>{
 setEnv({APP_BASE_URL:'https://nbss.test',GOOGLE_SHEETS_SPREADSHEET_ID:'sheet-id',GOOGLE_SERVICE_ACCOUNT_EMAIL:'orders@nbss.test',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'unused',ADMIN_SESSION_SECRET:'test-secret-which-is-long-enough-for-session-signing',ADMIN_EMAILS:'desk@example.com'},t);
 const cookie=createSessionCookie('desk@example.com').split(';')[0];
 const response=mockResponse();await supplyOrders({method:'PATCH',headers:{origin:'https://attacker.example',cookie},body:{orderNumber:'NB-20261030-A1B2C3D4',status:'Closed'}},response);assert.equal(response.statusCode,403);
});
test('all generated internal links, scripts and local images resolve',async()=>{
 const files=['index.html','shop.html','contact.html','marine-supply.html','our-story.html','faq.html','admin.html',...(await readdir('dist/products')).map(f=>'products/'+f)];
 for(const file of files){const html=await readFile('dist/'+file,'utf8');for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[^\"]*)"/g)){let target=match[1];if(target.startsWith('/api/'))continue;if(target==='/')target='/index.html';if(!/\.[a-z0-9]+$/.test(target))target+='.html';await assert.doesNotReject(access('dist'+target),`${file}: ${target}`);}}
});
