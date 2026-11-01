const $=(selector,root=document)=>root.querySelector(selector);
const ORDER_STATUSES=['New','Checking stock','Price confirmed','Preparing','Ready for pickup','Fulfilled','On hold','Cancelled'];
let orders=[],inventory=[],selectedOrder=null,selectedInventory=null,loadingOrders=false,loadingInventory=false;
const banner=$('#admin-banner'),loginPanel=$('#admin-login'),dashboard=$('#admin-dashboard'),orderDialog=$('#admin-order-dialog'),inventoryDialog=$('#inventory-dialog');

function message(text,type='info'){
 banner.textContent=text;banner.className=`admin-banner ${type}`;banner.hidden=!text;
}
function setSignedOut(note=''){
 dashboard.hidden=true;loginPanel.hidden=false;
 if(note)message(note,'warning');
}
async function loadSession(){
 const response=await fetch('/api/admin-session',{cache:'no-store',credentials:'same-origin'}),data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('The staff access check could not be completed. Refresh and try again.');
 if(!data.authConfigured){setSignedOut('Staff sign-in is not configured yet. Complete the Google and Vercel setup before using this page.');$('#admin-sign-in').hidden=true;return;}
 $('#admin-sign-in').hidden=false;
 if(new URLSearchParams(location.search).get('auth_error')==='denied')message('That account could not be authorized. Sign in with an address approved by NBSS.','warning');
 if(!data.authenticated){setSignedOut(new URLSearchParams(location.search).get('auth_error')==='setup'?'Admin access is not configured yet. Follow the setup steps before signing in.':'');return;}
 loginPanel.hidden=true;dashboard.hidden=false;message('');$('#admin-user').textContent=data.email;
 if(!data.storageConfigured)message('The Google Sheet connection is not configured. Add the spreadsheet credentials in Vercel before loading the desk.','error');
 await Promise.all([refreshOrders(),refreshInventory()]);
}
function formatDate(value,{time=false}={}){
 if(!value)return 'Not specified';const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return value;
 return new Intl.DateTimeFormat(undefined,time?{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',year:'numeric'}).format(parsed);
}
function statusClass(status){return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;}
function visibleOrders(){
 const query=$('#admin-search').value.trim().toLowerCase(),status=$('#admin-status-filter').value;
 return orders.filter(order=>{
  const inStatus=status==='all'||order.status===status;
  const haystack=[order.orderNumber,order.name,order.phone,order.company,order.itemSummary,order.message,...order.items.map(x=>`${x.item} ${x.qty}`)].join(' ').toLowerCase();
  return inStatus&&(!query||haystack.includes(query));
 });
}
function renderStats(){
 const counts=[['Open orders',orders.filter(o=>!['Fulfilled','Cancelled'].includes(o.status)).length,'Work in progress'],['New',orders.filter(o=>o.status==='New').length,'Ready for stock check'],['Checking stock',orders.filter(o=>o.status==='Checking stock').length,'Availability and pricing'],['Ready for pickup',orders.filter(o=>o.status==='Ready for pickup').length,'Awaiting handoff']];
 const container=$('#admin-stats');container.replaceChildren();
 for(const [label,value,note] of counts){const card=document.createElement('article');card.className='admin-stat-card';const name=document.createElement('span');name.textContent=label;const total=document.createElement('strong');total.textContent=String(value);const hint=document.createElement('small');hint.textContent=note;card.append(name,total,hint);container.append(card);}
}
function appendTextCell(row,text,className=''){
 const cell=document.createElement('td');if(className)cell.className=className;cell.textContent=text;row.append(cell);return cell;
}
function renderOrders(){
 const body=$('#admin-order-list');body.replaceChildren();const filtered=visibleOrders();
 $('#admin-result-count').textContent=`${filtered.length} ${filtered.length===1?'order':'orders'}`;$('#admin-empty').hidden=filtered.length>0;$('.admin-order-table').hidden=orders.length===0;
 for(const order of filtered){
  const row=document.createElement('tr');row.className='admin-order-row';row.tabIndex=0;row.setAttribute('aria-label',`Open order ${order.orderNumber}, ${order.status}`);
  const ticket=document.createElement('td');ticket.className='admin-ticket-cell';const number=document.createElement('strong');number.textContent=order.orderNumber;const date=document.createElement('small');date.textContent=formatDate(order.createdAt,{time:true});ticket.append(number,date);row.append(ticket);
  const contact=document.createElement('td');contact.className='admin-contact-cell';const vessel=document.createElement('strong');vessel.textContent=order.company||'Vessel not provided';const person=document.createElement('small');person.textContent=[order.name,order.phone].filter(Boolean).join(' · ');contact.append(vessel,person);row.append(contact);
  const itemNames=order.items.length?order.items.slice(0,2).map(x=>x.item).join(', ')+(order.items.length>2?` +${order.items.length-2} more`:''):'No supply lines';appendTextCell(row,itemNames,'admin-items-cell');appendTextCell(row,formatDate(order.neededBy),'admin-date-cell');
  const statusCell=document.createElement('td'),pill=document.createElement('span');pill.className=`admin-status-pill ${statusClass(order.status)}`;pill.textContent=order.status;statusCell.append(pill);row.append(statusCell);
  const action=document.createElement('td'),open=document.createElement('button');open.type='button';open.className='admin-open-request';open.textContent='OPEN →';open.setAttribute('aria-label',`Open order ${order.orderNumber}`);action.append(open);row.append(action);
  const activate=()=>openOrder(order.orderNumber);row.addEventListener('click',activate);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});open.addEventListener('click',event=>{event.stopPropagation();activate();});body.append(row);
 }
}
async function refreshOrders(){
 if(loadingOrders)return;loadingOrders=true;$('#admin-refresh').disabled=true;
 try{
  const response=await fetch('/api/supply-orders',{cache:'no-store',credentials:'same-origin'}),payload=await response.json().catch(()=>({}));
  if(response.status===401){setSignedOut('Your staff session has expired. Sign in again to view orders.');return;}
  if(!response.ok)throw new Error(payload.error||'The order list could not be loaded.');
  orders=Array.isArray(payload.orders)?payload.orders:[];renderStats();renderOrders();$('#admin-updated-at').textContent=formatDate(payload.generatedAt,{time:true});
 }catch(error){message(error.message||'The order list could not be refreshed.','error');}
 finally{loadingOrders=false;$('#admin-refresh').disabled=false;}
}
function addReadonly(label,value){const item=document.createElement('div'),term=document.createElement('span'),detail=document.createElement('strong');term.textContent=label;detail.textContent=value||'—';item.append(term,detail);$('#detail-readonly').append(item);}
function renderEditableOrderLines(items){
 const container=$('#detail-lines');container.replaceChildren();
 items.forEach((line,index)=>{
  const row=document.createElement('div');row.className='admin-edit-line';
  const item=document.createElement('input');item.type='text';item.maxLength=200;item.value=line.item||'';item.dataset.orderField='item';item.setAttribute('aria-label',`Supply item ${index+1}`);item.placeholder='Supply item';
  const qty=document.createElement('input');qty.type='text';qty.maxLength=100;qty.value=line.qty||'';qty.dataset.orderField='qty';qty.setAttribute('aria-label',`Amount or size for line ${index+1}`);qty.placeholder='Qty / size';
  const remove=document.createElement('button');remove.type='button';remove.className='admin-line-remove';remove.textContent='×';remove.dataset.lineIndex=String(index);remove.setAttribute('aria-label',`Remove supply line ${index+1}`);remove.disabled=items.length<=1;
  row.append(item,qty,remove);container.append(row);
 });
 $('#detail-add-line').disabled=items.length>=50;
}
function openOrder(orderNumber){
 selectedOrder=orders.find(order=>order.orderNumber===orderNumber);if(!selectedOrder)return;
 $('#detail-title').textContent=selectedOrder.orderNumber;const readonly=$('#detail-readonly');readonly.replaceChildren();
 addReadonly('Order number',selectedOrder.orderNumber);addReadonly('Submitted',formatDate(selectedOrder.createdAt,{time:true}));addReadonly('Last updated',formatDate(selectedOrder.updatedAt,{time:true}));
 $('#detail-name').value=selectedOrder.name||'';$('#detail-phone').value=selectedOrder.phone||'';$('#detail-company').value=selectedOrder.company||'';$('#detail-needed-by').value=selectedOrder.neededBy||'';
 $('#detail-handoff').value=selectedOrder.handoff||'Counter pickup';$('#detail-status').value=ORDER_STATUSES.includes(selectedOrder.status)?selectedOrder.status:'New';
 $('#detail-message').value=selectedOrder.message||'';$('#detail-staff-notes').value=selectedOrder.staffNotes||'';$('#detail-updated').textContent='';
 renderEditableOrderLines(selectedOrder.items.length?selectedOrder.items:[{item:'',qty:''}]);orderDialog.showModal();
}
function currentOrderItems(){return [...$('#detail-lines').children].map(row=>({item:$('[data-order-field="item"]',row).value.trim(),qty:$('[data-order-field="qty"]',row).value.trim()})).filter(line=>line.item);}
$('#detail-add-line').addEventListener('click',()=>{const items=currentOrderItems();items.push({item:'',qty:''});renderEditableOrderLines(items);$('#detail-lines')?.lastElementChild?.querySelector('[data-order-field="item"]')?.focus();});
$('#detail-lines').addEventListener('click',event=>{const button=event.target.closest('[data-line-index]');if(!button)return;const items=[...$('#detail-lines').children].map(row=>({item:$('[data-order-field="item"]',row).value.trim(),qty:$('[data-order-field="qty"]',row).value.trim()}));items.splice(Number(button.dataset.lineIndex),1);renderEditableOrderLines(items.length?items:[{item:'',qty:''}]);});
$('#admin-refresh').addEventListener('click',()=>{refreshOrders();refreshInventory();window.dispatchEvent(new CustomEvent('nbss:refresh-documents'));});
$('#admin-search').addEventListener('input',renderOrders);$('#admin-status-filter').addEventListener('change',renderOrders);
$('#admin-detail-close').addEventListener('click',()=>orderDialog.close());orderDialog.addEventListener('click',event=>{if(event.target===orderDialog)orderDialog.close();});
$('#admin-sign-out').addEventListener('click',async()=>{await fetch('/api/admin-logout',{method:'POST',credentials:'same-origin'}).catch(()=>{});location.reload();});
$('#admin-update-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!selectedOrder)return;const save=$('#detail-save'),original=save.innerHTML;save.disabled=true;save.textContent='Saving…';
 const payloadOrder={orderNumber:selectedOrder.orderNumber,name:$('#detail-name').value,phone:$('#detail-phone').value,company:$('#detail-company').value,neededBy:$('#detail-needed-by').value,handoff:$('#detail-handoff').value,status:$('#detail-status').value,items:currentOrderItems(),message:$('#detail-message').value,staffNotes:$('#detail-staff-notes').value};
 try{
  const response=await fetch('/api/supply-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payloadOrder)}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Order updates could not be saved.');
  const index=orders.findIndex(item=>item.orderNumber===payload.order.orderNumber);if(index>=0)orders[index]=payload.order;selectedOrder=payload.order;orderDialog.close();renderStats();renderOrders();message(`${payload.order.orderNumber} was updated.`,'success');
 }catch(error){$('#detail-updated').textContent=error.message||'Order updates could not be saved.';}
 finally{save.disabled=false;save.innerHTML=original;}
});
function visibleInventory(){
 const query=$('#inventory-search').value.trim().toLowerCase(),mode=$('#inventory-active-filter').value;
 return inventory.filter(item=>{
  const low=item.active&&item.reorderAt>0&&item.onHand<=item.reorderAt,active=mode==='all'||(mode==='active'&&item.active)||(mode==='inactive'&&!item.active)||(mode==='low'&&low);
  const haystack=[item.item,item.category,item.unit,item.location,item.notes,item.unitPrice].join(' ').toLowerCase();return active&&(!query||haystack.includes(query));
 });
}
function renderInventoryStats(){
 const active=inventory.filter(item=>item.active),low=active.filter(item=>item.reorderAt>0&&item.onHand<=item.reorderAt).length;
 const stats=[['Active supplies',active.length,'Shown on order form'],['Low stock',low,'At or below reorder level'],['Archived',inventory.length-active.length,'Not shown to customers'],['Inventory rows',inventory.length,'Managed here or in the sheet']];
 const host=$('#inventory-stats');host.replaceChildren();for(const [label,value,note] of stats){const card=document.createElement('article');card.className='admin-stat-card';const title=document.createElement('span');title.textContent=label;const count=document.createElement('strong');count.textContent=String(value);const hint=document.createElement('small');hint.textContent=note;card.append(title,count,hint);host.append(card);}
}
function renderInventory(){
 const body=$('#inventory-list');body.replaceChildren();const filtered=visibleInventory();$('#inventory-result-count').textContent=`${filtered.length} ${filtered.length===1?'item':'items'}`;$('#inventory-empty').hidden=filtered.length>0;
 $('.admin-inventory-table').hidden=filtered.length===0;
 $('#inventory-empty h3').textContent=inventory.length?'NO MATCHING SUPPLIES.':'THE STOCK LIST IS EMPTY.';
 $('#inventory-empty p').textContent=inventory.length?'Adjust the search or display filter to see more items.':'Add your current supplies here. No stock quantities are prefilled.';
 for(const item of filtered){
  const row=document.createElement('tr');row.className='admin-inventory-row';const name=document.createElement('td');name.className='admin-inventory-name';const strong=document.createElement('strong');strong.textContent=item.item;const notes=document.createElement('small');notes.textContent=item.notes;name.append(strong,notes);row.append(name);
  appendTextCell(row,[item.category,item.unit].filter(Boolean).join(' · ')||'—');appendTextCell(row,item.unitPrice===null||item.unitPrice===undefined?'Not set':`${new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(item.unitPrice)}${item.unit?` / ${item.unit}`:''}`);appendTextCell(row,`${item.onHand}${item.unit?` ${item.unit}`:''}`,item.active&&item.reorderAt>0&&item.onHand<=item.reorderAt?'inventory-low':'');appendTextCell(row,`${item.reorderAt}${item.unit?` ${item.unit}`:''}`);appendTextCell(row,item.location||'—');
  const statusCell=document.createElement('td'),status=document.createElement('span');status.className=`admin-status-pill ${item.active?'inventory-active':'inventory-archived'}`;status.textContent=item.active?'Active':'Archived';statusCell.append(status);row.append(statusCell);
  const action=document.createElement('td'),button=document.createElement('button');button.type='button';button.className='admin-open-request';button.textContent='EDIT →';button.addEventListener('click',()=>openInventory(item));action.append(button);row.append(action);body.append(row);
 }
}
async function refreshInventory(){
 if(loadingInventory)return;loadingInventory=true;
 try{
  const response=await fetch('/api/inventory',{cache:'no-store',credentials:'same-origin'}),payload=await response.json().catch(()=>({}));
  if(response.status===401){setSignedOut('Your staff session has expired. Sign in again to manage inventory.');return;}
  if(!response.ok)throw new Error(payload.error||'The inventory list could not be loaded.');inventory=Array.isArray(payload.items)?payload.items:[];renderInventoryStats();renderInventory();
 }catch(error){if(!inventory.length)$('#inventory-empty').hidden=true;message(`${error.message||'Inventory could not be refreshed.'} Check that the Inventory tab and its header row are in the Google Sheet.`,'warning');}
 finally{loadingInventory=false;}
}
function setActiveTab(name){
 const active=name==='inventory'?'inventory':name==='documents'?'documents':'orders';
 for(const [tab,view,key] of [['tab-orders','orders-view','orders'],['tab-inventory','inventory-view','inventory'],['tab-documents','documents-view','documents']]){
  $(`#${tab}`).setAttribute('aria-selected',String(active===key));$(`#${view}`).hidden=active!==key;
 }
 if(active==='inventory')refreshInventory();
 if(active==='documents')window.dispatchEvent(new CustomEvent('nbss:refresh-documents'));
}
$('#tab-orders').addEventListener('click',()=>setActiveTab('orders'));$('#tab-inventory').addEventListener('click',()=>setActiveTab('inventory'));$('#tab-documents').addEventListener('click',()=>setActiveTab('documents'));
$('#inventory-search').addEventListener('input',renderInventory);$('#inventory-active-filter').addEventListener('change',renderInventory);
function openInventory(item=null){
 selectedInventory=item;$('#inventory-dialog-title').textContent=item?'EDIT INVENTORY ITEM':'ADD INVENTORY ITEM';
 $('#inventory-item').value=item?.item||'';$('#inventory-category').value=item?.category||'';$('#inventory-unit').value=item?.unit||'';$('#inventory-unit-price').value=item?.unitPrice??'';$('#inventory-on-hand').value=String(item?.onHand??0);$('#inventory-reorder-at').value=String(item?.reorderAt??0);$('#inventory-location').value=item?.location||'';$('#inventory-notes').value=item?.notes||'';$('#inventory-active').checked=item?.active??true;$('#inventory-row-note').textContent=item?`Sheet row ${item.sheetRow} · Every inventory column is editable here.`:'A new row will be added to the Inventory tab.';inventoryDialog.showModal();
}
$('#inventory-add').addEventListener('click',()=>openInventory());$('#inventory-empty-add').addEventListener('click',()=>openInventory());$('#inventory-close').addEventListener('click',()=>inventoryDialog.close());inventoryDialog.addEventListener('click',event=>{if(event.target===inventoryDialog)inventoryDialog.close();});
$('#inventory-form').addEventListener('submit',async event=>{
 event.preventDefault();const save=$('#inventory-save'),original=save.innerHTML;save.disabled=true;save.textContent='Saving…';
 const item={item:$('#inventory-item').value,category:$('#inventory-category').value,unit:$('#inventory-unit').value,unitPrice:$('#inventory-unit-price').value,onHand:$('#inventory-on-hand').value,reorderAt:$('#inventory-reorder-at').value,location:$('#inventory-location').value,notes:$('#inventory-notes').value,active:$('#inventory-active').checked};
 try{
  const editing=Boolean(selectedInventory),response=await fetch('/api/inventory',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(editing?{sheetRow:selectedInventory.sheetRow,item}:{item})}),payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Inventory could not be saved.');
  if(editing){const index=inventory.findIndex(row=>row.sheetRow===selectedInventory.sheetRow);if(index>=0)inventory[index]=payload.item;}else inventory.push(payload.item);
  inventoryDialog.close();renderInventoryStats();renderInventory();message(`${payload.item.item} was saved to inventory.`,'success');
 }catch(error){$('#inventory-row-note').textContent=error.message||'Inventory could not be saved.';}
 finally{save.disabled=false;save.innerHTML=original;}
});
function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}
$('#admin-export').addEventListener('click',()=>{
 const columns=['Order number','Created at','Status','Customer name','Phone','Vessel / company','Needed by','Preferred handoff','Supply list','Customer notes','Staff notes','Updated at'];
 const lines=[columns,...visibleOrders().map(order=>[order.orderNumber,order.createdAt,order.status,order.name,order.phone,order.company,order.neededBy,order.handoff,order.itemSummary||order.items.map(x=>`${x.item}${x.qty?` — ${x.qty}`:''}`).join('; '),order.message,order.staffNotes,order.updatedAt])];
 const blob=new Blob(['\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`nbss-orders-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);
});

loadSession().catch(error=>setSignedOut(error.message));
window.setInterval(()=>{if(document.hidden||dashboard.hidden)return;if(!$('#orders-view').hidden)refreshOrders();else if(!$('#inventory-view').hidden)refreshInventory();else window.dispatchEvent(new CustomEvent('nbss:refresh-documents'));},60_000);
