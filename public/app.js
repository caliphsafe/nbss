import {safeCart,checkoutURL,money,escapeHTML as esc} from './shop-utils.js';
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>[...root.querySelectorAll(s)];
let catalog=[],cart=[],live=false,toastTimer,orderLines=[],inventorySuggestions=[];
try{cart=safeCart(JSON.parse(localStorage.getItem('nbss-bag')||'[]'));}catch{}
try{const saved=JSON.parse(localStorage.getItem('nbss-order-lines')||'[]');if(Array.isArray(saved))orderLines=saved.filter(x=>x&&typeof x==='object').slice(0,50).map((x,i)=>({id:String(x.id||`line-${i}`),item:String(x.item||'').slice(0,200),qty:String(x.qty||'').slice(0,100)}));}catch{}
const dialog=$('.cart-dialog');
function dismissToast(){
 clearTimeout(toastTimer);toastTimer=undefined;
 const notice=$('#toast');if(!notice)return;
 notice.classList.remove('visible');notice.setAttribute('aria-hidden','true');
}
function toast(message){
 const notice=$('#toast');if(!notice)return;
 clearTimeout(toastTimer);notice.textContent=message;notice.setAttribute('aria-hidden','false');notice.classList.add('visible');
 toastTimer=setTimeout(dismissToast,2500);
}
function persist(){try{localStorage.setItem('nbss-bag',JSON.stringify(cart));}catch{toast('Your bag is available for this visit. Browser storage is unavailable.');}updateCounts();}
function updateCounts(){const count=cart.reduce((s,x)=>s+x.quantity,0);$$('.cart-count').forEach(x=>x.textContent=count);$('.cart-trigger').setAttribute('aria-label',`Open shopping bag, ${count} items`);}
updateCounts();
const menu=$('.mobile-toggle');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close menu':'Open menu');$('#mobile-menu').hidden=!open;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menu.click();menu.focus();}});
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
function orderLineId(){return `line-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function saveOrderLines(){try{localStorage.setItem('nbss-order-lines',JSON.stringify(orderLines));}catch{}}
let inventoryLoadPromise;
function setInventoryHelp(message,{retry=false}={}){
 const help=$('#inventory-help');if(!help)return;
 help.textContent=message;
 if(!retry)return;
 const button=document.createElement('button');button.type='button';button.className='inventory-retry';button.textContent='Try again';button.addEventListener('click',()=>loadInventorySuggestions());
 help.append(document.createTextNode(' '),button);
}
async function loadInventorySuggestions(){
 if(inventoryLoadPromise)return inventoryLoadPromise;
 setInventoryHelp('Loading the supply list…');
 inventoryLoadPromise=(async()=>{
  for(let attempt=0;attempt<2;attempt++){
   try{
    const response=await fetch('/api/inventory',{cache:'no-store'}),payload=await response.json().catch(()=>({}));
    if(!response.ok||!Array.isArray(payload.items))throw new Error('The supply list could not be loaded.');
    inventorySuggestions=payload.items.filter(item=>item&&typeof item.item==='string'&&item.item.trim()).map(item=>({item:item.item.trim(),category:String(item.category||''),unit:String(item.unit||'')}));
    setInventoryHelp(inventorySuggestions.length?`${inventorySuggestions.length} supplies available. Search or browse the list, or write in what you need. NBSS will confirm availability.`:'No supplies are listed right now. Write in what you need, and NBSS will check availability.');
    return true;
   }catch{
    if(attempt===0){await new Promise(resolve=>setTimeout(resolve,500));continue;}
   }
  }
  setInventoryHelp("We can't load the supply list right now. You can still write in what you need.",{retry:true});
  return false;
 })().finally(()=>{inventoryLoadPromise=null;});
 return inventoryLoadPromise;
}
function closeSupplySuggestions(field){
 if(!field)return;
 const panel=$('.supply-suggestions',field),input=$('[data-order-field="item"]',field),toggle=$('.supply-picker-toggle',field);
 if(panel){panel.hidden=true;panel.querySelector('[role="listbox"]')?.replaceChildren();panel.dataset.activeIndex='-1';}
 input?.setAttribute('aria-expanded','false');input?.removeAttribute('aria-activedescendant');toggle?.setAttribute('aria-expanded','false');
}
function closeAllSupplySuggestions(){ $$('.order-item-field').forEach(closeSupplySuggestions); }
function selectSupplySuggestion(input,value){
 const field=input.closest('.order-item-field'),line=orderLines.find(item=>item.id===input.dataset.orderId);
 if(!line)return;
 input.value=value;line.item=value;saveOrderLines();closeSupplySuggestions(field);input.focus();
}
function showSupplySuggestions(input,{browse=false}={}){
 const field=input.closest('.order-item-field'),panel=$('.supply-suggestions',field),list=$('[role="listbox"]',panel),toggle=$('.supply-picker-toggle',field);
 const query=browse?'':input.value.trim().toLocaleLowerCase();
 if(!browse&&!query){closeSupplySuggestions(field);return;}
 const matches=inventorySuggestions.filter(item=>!query||`${item.item} ${item.category} ${item.unit}`.toLocaleLowerCase().includes(query));
 list.replaceChildren();panel.hidden=false;panel.dataset.activeIndex='-1';
 const heading=$('.supply-suggestion-heading',panel);
 heading.textContent=matches.length?`${matches.length} ${matches.length===1?'RESULT':'RESULTS'} · AVAILABLE SUPPLIES`:'AVAILABLE SUPPLIES';
 const empty=$('.supply-suggestion-empty',panel);empty.hidden=matches.length>0;
 if(!matches.length)empty.textContent=query?'No matching supplies. Keep typing to request any item.':'No supplies are listed right now. You can still write in any item.';
 matches.forEach((item,index)=>{
  const option=document.createElement('div');option.className='supply-suggestion-option';option.id=`${list.id}-option-${index}`;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.tabIndex=-1;
  const name=document.createElement('strong');name.textContent=item.item;option.append(name);
  const detail=[item.category,item.unit].filter(Boolean).join(' · ');
  if(detail){const meta=document.createElement('span');meta.textContent=detail;option.append(meta);}
  option.addEventListener('click',()=>selectSupplySuggestion(input,item.item));list.append(option);
 });
 input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');toggle.setAttribute('aria-expanded','true');
}
function setActiveSupplySuggestion(input,index){
 const field=input.closest('.order-item-field'),list=$('[role="listbox"]',$('.supply-suggestions',field)),options=$$('[role="option"]',list);
 if(!options.length)return;
 const next=(index+options.length)%options.length;
 options.forEach((option,i)=>option.setAttribute('aria-selected',String(i===next)));
 list.closest('.supply-suggestions').dataset.activeIndex=String(next);input.setAttribute('aria-activedescendant',options[next].id);options[next].scrollIntoView({block:'nearest'});
}
function renderOrderLines(){
 const host=$('#order-lines');if(!host)return;
 host.replaceChildren();
 orderLines.forEach((line,index)=>{
  const row=document.createElement('div');row.className='order-line';
  const itemId=`order-item-${index+1}`,listId=`supply-suggestion-list-${index+1}`;
  const itemField=document.createElement('div');itemField.className='order-item-field';
  const itemLabel=document.createElement('label');itemLabel.htmlFor=itemId;itemLabel.textContent='SUPPLY ITEM';
  const control=document.createElement('div');control.className='supply-picker-control';
  const itemInput=document.createElement('input');itemInput.type='text';itemInput.id=itemId;itemInput.maxLength=200;itemInput.autocomplete='off';itemInput.spellcheck=false;itemInput.dataset.orderField='item';itemInput.dataset.orderId=line.id;itemInput.placeholder='Find a supply or write one in';itemInput.value=line.item;itemInput.setAttribute('role','combobox');itemInput.setAttribute('aria-autocomplete','list');itemInput.setAttribute('aria-haspopup','listbox');itemInput.setAttribute('aria-expanded','false');itemInput.setAttribute('aria-controls',listId);itemInput.setAttribute('aria-label',`Supply item ${index+1}`);
  const toggle=document.createElement('button');toggle.type='button';toggle.className='supply-picker-toggle';toggle.setAttribute('aria-label','Browse available supplies');toggle.setAttribute('aria-controls',listId);toggle.setAttribute('aria-expanded','false');toggle.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg>';
  toggle.addEventListener('click',()=>{if(!$('.supply-suggestions',itemField).hidden){closeSupplySuggestions(itemField);return;}itemInput.focus();showSupplySuggestions(itemInput,{browse:true});});
  itemInput.addEventListener('focus',()=>{if(itemInput.value.trim())showSupplySuggestions(itemInput);});
  itemInput.addEventListener('keydown',event=>{
   const panel=$('.supply-suggestions',itemField),list=$('[role="listbox"]',panel),options=$$('[role="option"]',list),active=Number(panel.dataset.activeIndex??-1);
   if(event.key==='Escape'&&!panel.hidden){event.preventDefault();closeSupplySuggestions(itemField);return;}
   if(event.key==='ArrowDown'||event.key==='ArrowUp'){
    if(panel.hidden)showSupplySuggestions(itemInput,{browse:!itemInput.value.trim()});
    const refreshed=$$('[role="option"]',$('[role="listbox"]',$('.supply-suggestions',itemField)));
    if(refreshed.length){event.preventDefault();const current=Number($('.supply-suggestions',itemField).dataset.activeIndex??-1),step=event.key==='ArrowDown'?1:-1;setActiveSupplySuggestion(itemInput,current<0?(step>0?0:refreshed.length-1):current+step);}
   }else if(event.key==='Enter'&&!panel.hidden&&active>=0&&options[active]){event.preventDefault();options[active].click();}
  });
  const panel=document.createElement('div');panel.className='supply-suggestions';panel.hidden=true;panel.dataset.activeIndex='-1';
  const heading=document.createElement('div');heading.className='supply-suggestion-heading';heading.setAttribute('role','status');heading.setAttribute('aria-live','polite');
  const list=document.createElement('div');list.className='supply-suggestion-results';list.id=listId;list.setAttribute('role','listbox');list.setAttribute('aria-label','Available supplies');
  const empty=document.createElement('p');empty.className='supply-suggestion-empty';empty.setAttribute('role','status');empty.setAttribute('aria-live','polite');empty.hidden=true;
  panel.append(heading,list,empty);
  control.append(itemInput,toggle);itemField.append(itemLabel,control,panel);
  const qtyLabel=document.createElement('label');qtyLabel.innerHTML=`<span>QTY / SIZE / SPEC</span><input type="text" maxlength="100" data-order-field="qty" data-order-id="${esc(line.id)}" placeholder="e.g. 200 ft, 3/4 inch" aria-label="Amount or size for supply line ${index+1}">`;
  qtyLabel.querySelector('input').value=line.qty;
  const remove=document.createElement('button');remove.type='button';remove.className='order-line-remove';remove.dataset.removeOrderLine=line.id;remove.setAttribute('aria-label',`Remove supply line ${index+1}`);remove.textContent='×';
  row.append(itemField,qtyLabel,remove);host.append(row);
 });
 const count=$('#order-line-count');if(count)count.textContent=`${orderLines.length} ${orderLines.length===1?'line':'lines'}`;
 const add=$('#add-order-line');if(add)add.disabled=orderLines.length>=50;
}
function addOrderLine(focus=true){if(orderLines.length>=50)return;orderLines.push({id:orderLineId(),item:'',qty:''});saveOrderLines();renderOrderLines();if(focus)$('#order-lines')?.lastElementChild?.querySelector('[data-order-field="item"]')?.focus();}
if($('#supply-order-form')){
 if(!orderLines.length)orderLines=[{id:orderLineId(),item:'',qty:''}];
 renderOrderLines();
 $('#add-order-line').addEventListener('click',()=>addOrderLine());
 $('#order-lines').addEventListener('input',event=>{
  const input=event.target.closest('[data-order-field]');if(!input)return;
  const line=orderLines.find(item=>item.id===input.dataset.orderId);if(!line)return;
  line[input.dataset.orderField]=input.value.slice(0,input.dataset.orderField==='item'?200:100);saveOrderLines();
  if(input.dataset.orderField==='item')showSupplySuggestions(input);
 });
 $('#order-lines').addEventListener('focusout',event=>{const field=event.target.closest('.order-item-field');if(field&&!field.contains(event.relatedTarget))closeSupplySuggestions(field);});
 document.addEventListener('pointerdown',event=>{if(!event.target.closest('.order-item-field'))closeAllSupplySuggestions();});
 $('#order-lines').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-order-line]');if(!button)return;
  orderLines=orderLines.filter(line=>line.id!==button.dataset.removeOrderLine);
  if(!orderLines.length)orderLines=[{id:orderLineId(),item:'',qty:''}];
  saveOrderLines();renderOrderLines();
 });
 loadInventorySuggestions();
}
function writeRequestMessage(result,{title,detail,warning=''}={}){
 result.replaceChildren();result.hidden=false;
 const heading=document.createElement('strong');heading.textContent=title;result.append(heading);
 const copy=document.createElement('p');copy.textContent=detail;result.append(copy);
 if(warning){const note=document.createElement('p');note.className='request-warning';note.textContent=warning;result.append(note);}
}
$$('[data-inquiry="supply"]').forEach(form=>form.addEventListener('submit',async event=>{
 event.preventDefault();const data=new FormData(form),result=$('.inquiry-result',form),button=$('button[type="submit"]',form),original=button.textContent;
 const items=orderLines.map(line=>({item:line.item.trim(),qty:line.qty.trim()})).filter(line=>line.item);
 if(!items.length){$('#order-lines input[data-order-field="item"]')?.focus();toast('Write in at least one supply item.');return;}
 const submissionKey=form.dataset.submissionKey||(form.dataset.submissionKey=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
 button.disabled=true;button.textContent='Recording order…';result.hidden=true;
 try{
  const response=await fetch('/api/supply-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   name:data.get('name'),phone:data.get('phone'),company:data.get('company'),neededBy:data.get('neededBy'),handoff:data.get('handoff'),
   message:data.get('message'),website:data.get('website'),items,submissionKey
  })});
  const payload=await response.json().catch(()=>({}));if(!response.ok||!payload.orderNumber)throw new Error(payload.error||'We could not record the order.');
  writeRequestMessage(result,{title:`ORDER NUMBER · ${payload.orderNumber}`,detail:'NBSS must confirm availability and pricing.'});
  form.dataset.submissionKey='';form.reset();orderLines=[{id:orderLineId(),item:'',qty:''}];saveOrderLines();renderOrderLines();
 }catch(error){writeRequestMessage(result,{title:'ORDER NOT RECORDED',detail:error.message||'Please try again.',warning:'If the issue continues or your order is time-sensitive, call 508-994-2961.'});}
 finally{button.disabled=false;button.textContent=original;}
}));
window.addEventListener('storage',event=>{if(event.key==='nbss-bag'){try{cart=safeCart(JSON.parse(event.newValue||'[]'));updateCounts();if(dialog.open)renderCart();}catch{}}});
