import {safeCart,checkoutURL,money,escapeHTML as esc} from './shop-utils.js';
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
let catalog=[],cart=[],live=false,toastTimer,supplyTrip=[];
try{cart=safeCart(JSON.parse(localStorage.getItem('nbss-bag')||'[]'));}catch{}
try{const savedTrip=JSON.parse(localStorage.getItem('nbss-supply-trip')||'[]');if(Array.isArray(savedTrip))supplyTrip=savedTrip.filter(x=>x&&typeof x==='object').slice(0,100).map((x,i)=>({id:String(x.id||`restored-${i}`),item:String(x.item||'').slice(0,200),qty:String(x.qty||'').slice(0,100)}));}catch{}
const dialog=$('.cart-dialog');
function dismissToast(){
 clearTimeout(toastTimer);toastTimer=undefined;
 const notice=$('#toast');if(!notice)return;
 notice.classList.remove('visible');notice.setAttribute('aria-hidden','true');
}
function toast(message){
 if(document.body.classList.contains('trip-ticket-open')){dismissToast();return;}
 const notice=$('#toast');if(!notice)return;
 clearTimeout(toastTimer);notice.textContent=message;notice.setAttribute('aria-hidden','false');notice.classList.add('visible');
 toastTimer=setTimeout(dismissToast,2500);
}
function persist(){try{localStorage.setItem('nbss-bag',JSON.stringify(cart));}catch{toast('Your bag is available for this visit. Browser storage is unavailable.');}updateCounts();}
function updateCounts(){const count=cart.reduce((s,x)=>s+x.quantity,0);$$('.cart-count').forEach(x=>x.textContent=count);$('.cart-trigger').setAttribute('aria-label',`Open shopping bag, ${count} items`);}
updateCounts();
const menu=$('.mobile-toggle');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');$('#mobile-menu').hidden=!open;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menu.click();menu.focus();}if(event.key==='Escape'&&$('#trip-ticket')?.classList.contains('is-open'))setTripTicketOpen(false,true);});
$$('.cart-trigger').forEach(b=>b.addEventListener('click',async()=>{await catalogReady;renderCart();dialog.showModal();}));
$('.close-cart').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)dialog.close();}});
function renderCart(){
 updateCounts();
 if(!cart.length){$('#cart-items').innerHTML='<div class="empty-state"><h2>ROOM FOR GOOD GEAR.</h2><p>Your bag is empty. Find something with a home port.</p><a class="button" href="/shop">Explore the collection →</a></div>';$('#cart-summary').innerHTML='';return;}
 let total=0,blocked=false;
 $('#cart-items').innerHTML=cart.map(item=>{
  const p=catalog.find(x=>x.handle===item.handle),v=p?.variants.find(x=>x.id===item.id);
  if(!p||!v){blocked=true;return `<div class="cart-item"><div></div><div><h3>Item no longer available</h3><p>Remove this item to continue.</p><button class="cart-remove" data-remove="${item.id}">Remove</button></div></div>`;}
  if(!v.available)blocked=true;
  total+=v.price*item.quantity;
  return `<div class="cart-item"><img src="/images/${esc(p.handle)}.jpg" alt="${esc(p.title)}"><div><a href="/products/${esc(p.handle)}"><h3>${esc(p.title)}</h3></a><p>${v.title==='Default Title'?'One size':esc(v.title)}${!v.available?' · Sold out':''}</p><div class="cart-item-bottom"><div class="cart-quantity"><button data-change="${item.id}" data-delta="-1" aria-label="Decrease quantity of ${esc(p.title)}">−</button><span>${item.quantity}</span><button data-change="${item.id}" data-delta="1" aria-label="Increase quantity of ${esc(p.title)}" ${item.quantity>=99?'disabled':''}>+</button></div><span>${money(v.price*item.quantity)}</span></div><button class="cart-remove" data-remove="${item.id}">Remove</button></div></div>`;
 }).join('');
 $('#cart-summary').innerHTML=`<div class="cart-total"><span>Subtotal</span><strong>${money(total)}</strong></div><p class="small">Shipping and taxes calculated at checkout. Final price and availability confirmed there.</p>${blocked?'<p class="cart-warning">Remove sold-out or unavailable items before checkout.</p>':''}<button class="button checkout-button" ${blocked?'disabled':''}>Continue to checkout <span aria-hidden="true">→</span></button><p class="small" style="margin-top:12px">Secure checkout with New Bedford Ship Supply.</p>`;
 $$('[data-change]',dialog).forEach(b=>b.addEventListener('click',()=>{const item=cart.find(x=>x.id===Number(b.dataset.change));item.quantity+=Number(b.dataset.delta);cart=cart.filter(x=>x.quantity>0);persist();renderCart();}));
 $$('[data-remove]',dialog).forEach(b=>b.addEventListener('click',()=>{cart=cart.filter(x=>x.id!==Number(b.dataset.remove));persist();renderCart();}));
 $('.checkout-button')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;button.textContent='Checking your bag…';
  await refreshCatalog();
  const valid=cart.every(item=>catalog.find(p=>p.handle===item.handle)?.variants.some(v=>v.id===item.id&&v.available));
  if(!valid){renderCart();return;}
  const url=checkoutURL(cart);if(url)window.location.assign(url);
  button.disabled=false;button.textContent='Continue to checkout →';
 });
}
const catalogReady=fetch('/catalog.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{catalog=data.products;initProduct();}).catch(()=>{toast('Product details could not load. Please refresh the page.');const b=$('#add-button');if(b){b.disabled=true;b.textContent='Refresh to load options';}});
async function refreshCatalog(){
 try{const r=await fetch('/api/catalog',{signal:AbortSignal.timeout(14000)});if(!r.ok)throw Error();const data=await r.json();if(!Array.isArray(data.products)||!data.products.length)throw Error();catalog=data.products;live=true;updateCardPrices();return true;}catch{return false;}
}
// The generated catalog keeps browsing available if the upstream store is temporarily unavailable.
catalogReady.then(async()=>{await refreshCatalog();if($('.product-detail'))initProduct(true);if(dialog.open)renderCart();});
function updateCardPrices(){
 $$('[data-handle]').forEach(card=>{
  const p=catalog.find(p=>p.handle===card.dataset.handle);if(!p)return;
  const prices=p.variants.map(v=>v.price),min=Math.min(...prices),max=Math.max(...prices);
  card.dataset.price=min;const label=$('[data-card-price]',card);if(label)label.textContent=(min===max?'':'From ')+money(min);
  if(!p.variants.some(v=>v.available)){const tag=$('.product-tag',card);if(tag)tag.textContent='SOLD OUT';}
 });
}
function sanitizedDescription(html){
 const source=new DOMParser().parseFromString(html,'text/html'),fragment=document.createDocumentFragment();
 const allowed=new Set(['P','UL','OL','LI','STRONG','B','EM','I','BR','H2','H3']);
 function append(node,parent){if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));return;}if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName))return;const target=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):document.createDocumentFragment();[...node.childNodes].forEach(child=>append(child,target));parent.append(target);}
 [...source.body.childNodes].forEach(node=>append(node,fragment));return fragment;
}
let productSelection=[];let productInitialized=false;
function initProduct(refresh=false){
 const root=$('.product-detail');if(!root)return;
 let product=catalog.find(p=>p.handle===root.dataset.product);
 if(!product){$('#availability').textContent='This item is no longer available.';$('#add-button').disabled=true;return;}
 if(!productInitialized){
  const params=new URLSearchParams(location.search),wanted=Number(params.get('variant'));
  const first=product.variants.find(v=>v.id===wanted)||product.variants.find(v=>v.available)||product.variants[0];productSelection=[...first.options];
  $('#product-description').replaceChildren(sanitizedDescription(product.description));
  $$('[data-option]').forEach(field=>$$('[data-value]',field).forEach(b=>b.addEventListener('click',()=>{productSelection[Number(field.dataset.option)]=b.dataset.value;updateProduct(true);})));
  $$('.product-thumbnails button').forEach(b=>b.addEventListener('click',()=>{setImage(b.dataset.image);$$('.product-thumbnails button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
  $('#add-to-cart').addEventListener('submit',e=>{
   e.preventDefault();product=catalog.find(p=>p.handle===root.dataset.product);const variant=product?.variants.find(v=>v.options.every((o,i)=>o===productSelection[i]));
   if(!variant?.available){toast('Please choose an available option.');return;}
   const quantity=Math.max(1,Math.min(99,Math.floor(Number($('#product-quantity').value)||1)));
   const existing=cart.find(x=>x.id===variant.id);if(existing)existing.quantity=Math.min(99,existing.quantity+quantity);else cart.push({id:variant.id,handle:product.handle,quantity});persist();renderCart();dialog.showModal();
  });
  productInitialized=true;
 }
 updateProduct(false);
 if(live)$('#catalog-status').textContent='Availability checked with NBSS. Final totals confirmed at checkout.';
}
function setImage(src){const img=$('#main-product-photo');img.src=src+(src.includes('?')?'&':'?')+'width=1000';}
function updateProduct(changeImage){
 const product=catalog.find(p=>p.handle===$('.product-detail')?.dataset.product);if(!product)return;
 const variant=product.variants.find(v=>v.options.every((o,i)=>o===productSelection[i]));
 $$('[data-option]').forEach(field=>{
  const i=Number(field.dataset.option);$('.selected-option',field).textContent=productSelection[i]||'';
  $$('[data-value]',field).forEach(b=>{
   b.setAttribute('aria-pressed',String(productSelection[i]===b.dataset.value));
   const combination=product.variants.some(v=>v.available&&v.options.every((o,j)=>j===i?o===b.dataset.value:o===productSelection[j]));
   b.classList.toggle('unavailable',!combination);b.title=combination?'':'Unavailable in this combination';
  });
 });
 $('#variant-price').textContent=variant?money(variant.price):'Unavailable combination';
 $('#availability').textContent=variant?.available?'Available':variant?'Sold out in this option':'This combination is not available. Try another size or color.';
 $('#add-button').disabled=!variant?.available;$('#add-button').innerHTML=variant?.available?'Add to bag <span aria-hidden="true">→</span>':'Unavailable';
 if(variant){const url=new URL(location.href);url.searchParams.set('variant',variant.id);history.replaceState(null,'',url);if(changeImage&&variant.image)setImage(variant.image);}
}
if($('#product-grid')){
 const params=new URLSearchParams(location.search),filters=$$('[data-filter]'),input=$('#product-search'),sort=$('#product-sort'),cards=$$('.product-card',$('#product-grid'));
 let active=filters.some(b=>b.dataset.filter===params.get('category'))?params.get('category'):'All';input.value=params.get('q')||'';
 function filter(){
  const query=input.value.trim().toLowerCase();let count=0;
  cards.forEach(card=>{const show=(active==='All'||card.dataset.category===active)&&card.dataset.title.includes(query);card.hidden=!show;if(show)count++;});
  filters.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===active)));
  cards.sort((a,b)=>sort.value==='price-low'?Number(a.dataset.price)-Number(b.dataset.price):sort.value==='price-high'?Number(b.dataset.price)-Number(a.dataset.price):sort.value==='name'?a.dataset.title.localeCompare(b.dataset.title):Number(a.dataset.order)-Number(b.dataset.order)).forEach(c=>$('#product-grid').append(c));
  $('#results-count').textContent=`${count} product${count===1?'':'s'}`;$('#empty-results').hidden=count>0;
  const url=new URL(location.href);active!=='All'?url.searchParams.set('category',active):url.searchParams.delete('category');query?url.searchParams.set('q',query):url.searchParams.delete('q');history.replaceState(null,'',url);
 }
 filters.forEach(b=>b.addEventListener('click',()=>{active=b.dataset.filter;filter();}));input.addEventListener('input',filter);sort.addEventListener('change',filter);$('#shop-search').addEventListener('submit',e=>{e.preventDefault();filter();});$('#reset-filters').addEventListener('click',()=>{active='All';input.value='';sort.value='featured';filter();input.focus();});filter();
 if(params.has('search'))input.focus();
}
function tripCountLabel(count){return `${count} item${count===1?'':'s'}`;}
function updateTripPresentation(){
 const count=supplyTrip.filter(line=>line.item.trim()).length;
 ['#trip-count','#trip-count-mobile','#request-trip-count'].forEach(selector=>{const node=$(selector);if(node)node.textContent=tripCountLabel(count);});
 const empty=$('#trip-empty');if(empty)empty.hidden=count>0;
 const summary=$('#request-manifest-summary');if(summary)summary.innerHTML=count?supplyTrip.filter(line=>line.item.trim()).map((line,index)=>`<div class="request-trip-line"><span>${String(index+1).padStart(2,'0')}</span><strong>${esc(line.item)}</strong><small>${esc(line.qty||'Qty / size not specified')}</small></div>`).join(''):'<p class="trip-summary-empty">No supplies added yet. Add items from the catalog above, or describe your request below.</p>';
 const clear=$('#clear-trip-list');if(clear)clear.disabled=count===0;
}
function saveTrip(){try{localStorage.setItem('nbss-supply-trip',JSON.stringify(supplyTrip));}catch{toast('Your list is available for this visit. Browser storage is unavailable.');}updateTripPresentation();}
function renderTrip(){
 const lines=$('#trip-lines');if(!lines)return;
 lines.innerHTML=supplyTrip.map(line=>`<div class="trip-line"><label><span>SUPPLY ITEM</span><input type="text" data-trip-field="item" data-trip-id="${esc(line.id)}" value="${esc(line.item)}" placeholder="Item or department" aria-label="Supply item"></label><label><span>QTY / SIZE</span><input type="text" data-trip-field="qty" data-trip-id="${esc(line.id)}" value="${esc(line.qty)}" placeholder="As needed" aria-label="Quantity or size for ${esc(line.item||'supply item')}"></label><button type="button" data-trip-remove="${esc(line.id)}" aria-label="Remove ${esc(line.item||'supply item')}">×</button></div>`).join('');
 updateTripPresentation();
}
function addTripLine(item=''){
 const id=`trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
 supplyTrip.push({id,item,qty:''});saveTrip();renderTrip();
 if(!item)$('#trip-lines')?.lastElementChild?.querySelector('[data-trip-field="item"]')?.focus();
}
function setTripTicketOpen(open,restoreFocus=false){
 const ticket=$('#trip-ticket'),toggle=$('#trip-ticket-toggle');if(!ticket||!toggle)return;
 ticket.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));document.body.classList.toggle('trip-ticket-open',open);
 if(open){dismissToast();$('#trip-ticket-close')?.focus();}else if(restoreFocus)toggle.focus();
}
if($('#trip-ticket')){
 renderTrip();
 $('#trip-ticket-toggle').addEventListener('click',()=>setTripTicketOpen(true));
 $('#trip-ticket-close').addEventListener('click',()=>setTripTicketOpen(false,true));
 $('#trip-ticket-backdrop').addEventListener('click',()=>setTripTicketOpen(false,true));
 $('#add-custom-item').addEventListener('click',()=>addTripLine());
 $('#clear-trip-list').addEventListener('click',()=>{supplyTrip=[];saveTrip();renderTrip();toast('Trip list cleared.');});
 $('#trip-lines').addEventListener('input',event=>{
  const input=event.target.closest('[data-trip-field]');if(!input)return;
  const line=supplyTrip.find(x=>x.id===input.dataset.tripId);if(!line)return;
  line[input.dataset.tripField]=input.value.slice(0,input.dataset.tripField==='item'?200:100);
  saveTrip();
 });
 $('#trip-lines').addEventListener('click',event=>{
  const button=event.target.closest('[data-trip-remove]');if(!button)return;
  supplyTrip=supplyTrip.filter(line=>line.id!==button.dataset.tripRemove);saveTrip();renderTrip();
 });
 $$('[data-add-supply]').forEach(button=>button.addEventListener('click',()=>{
  addTripLine(button.dataset.addSupply);toast(`${button.dataset.addSupply} added to your trip list.`);
 }));
 $('#review-trip-list').addEventListener('click',()=>{
  setTripTicketOpen(false);document.body.classList.add('trip-review-mode');$('#supply-request').scrollIntoView({behavior:'smooth',block:'start'});
  window.setTimeout(()=>$('#supply-request input[name="name"]')?.focus({preventScroll:true}),450);
 });
 $('#edit-trip-list').addEventListener('click',()=>{document.body.classList.remove('trip-review-mode');$('#supply-catalog').scrollIntoView({behavior:'smooth',block:'start'});});
 const requestSection=$('#supply-request');
 if(requestSection&&'IntersectionObserver'in window)new IntersectionObserver(entries=>document.body.classList.toggle('trip-review-visible',entries[0].isIntersecting),{threshold:.12}).observe(requestSection);
 const search=$('#supply-search'),cards=$$('.supply-card');
 search.addEventListener('input',()=>{
  const query=search.value.trim().toLowerCase();let visible=0;
  cards.forEach(card=>{const match=card.dataset.supplySearch.includes(query);card.hidden=!match;if(match)visible++;});
  $('#supply-no-results').hidden=visible>0;
 });
}
function writeRequestMessage(result,{title,detail,warning=''}={}){
 result.replaceChildren();result.hidden=false;
 const heading=document.createElement('strong');heading.textContent=title;result.append(heading);
 const copy=document.createElement('p');copy.textContent=detail;result.append(copy);
 if(warning){const note=document.createElement('p');note.className='request-warning';note.textContent=warning;result.append(note);}
}
$$('[data-inquiry]').forEach(form=>form.addEventListener('submit',async e=>{
 e.preventDefault();const data=new FormData(form),supply=form.dataset.inquiry==='supply';
 if(supply){
  const lines=supplyTrip.map(line=>({item:line.item.trim(),qty:line.qty.trim()})).filter(line=>line.item);
  const result=$('.inquiry-result',form),button=$('button[type="submit"]',form),original=button.textContent;
  if(!lines.length&&!String(data.get('message')||'').trim()){$('textarea[name="message"]',form).focus();toast('Add at least one supply item or a note for the counter.');return;}
  const submissionKey=form.dataset.submissionKey||(form.dataset.submissionKey=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  button.disabled=true;button.textContent='Sending request…';
  result.hidden=true;
  try{
   const response=await fetch('/api/supply-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:data.get('name'),email:data.get('email'),company:data.get('company'),neededBy:data.get('date'),handoff:data.get('handoff'),
    message:data.get('message'),website:data.get('website'),items:lines,submissionKey
   })});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.accepted)throw new Error(payload.error||'We could not save your request.');
   form.dataset.submissionKey='';
   const warning=!payload.staffAlertSent||!payload.customerConfirmationSent?'Your request is on file, but an automatic email could not be sent to the counter or to you. Save this reference number and call 508-994-2961 if the request is time-sensitive.':'';
   writeRequestMessage(result,{title:`Request received · ${payload.orderNumber}`,detail:'The supply desk has your list. This is a request, not a confirmed order; NBSS will confirm availability, pricing and handoff with you.',warning});
   if(!payload.duplicate){supplyTrip=[];saveTrip();renderTrip();}
  }catch(error){writeRequestMessage(result,{title:'Request not submitted',detail:error.message||'Please try again.',warning:'If the issue continues or your request is time-sensitive, call the supply desk at 508-994-2961.'});}
  finally{button.disabled=false;button.textContent=original;}
  return;
 }
 const subject=`NBSS — ${data.get('topic')||'General question'}`;
 const body=`Name: ${data.get('name')}\nEmail: ${data.get('email')}\nPhone: ${data.get('company')||'Not provided'}\nMessage:\n${data.get('message')||'None provided'}`;
 const url=`mailto:help@nbshipsupply.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
 const result=$('.inquiry-result',form);result.hidden=false;result.innerHTML=`<p>Your draft is ready. Send it from your email app to complete your inquiry.</p><a class="text-link" href="${esc(url)}">Open email draft →</a><details style="margin-top:12px"><summary>Email app didn’t open?</summary><p>Copy the draft below and email it to help@nbshipsupply.com.</p><textarea aria-label="Email draft" readonly rows="6">${esc(subject+'\n\n'+body)}</textarea></details>`;
 window.location.href=url;
}));
window.addEventListener('storage',event=>{if(event.key==='nbss-bag'){try{cart=safeCart(JSON.parse(event.newValue||'[]'));updateCounts();if(dialog.open)renderCart();}catch{}}});
