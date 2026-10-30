const $=(selector,root=document)=>root.querySelector(selector);
const STATUSES=['New','Need more information','Quoted','Ready for pickup','Fulfilled','Closed'];
let orders=[],selectedOrder=null,loading=false;
const banner=$('#admin-banner'),loginPanel=$('#admin-login'),dashboard=$('#admin-dashboard'),dialog=$('#admin-order-dialog');

function message(text,type='info'){
 banner.textContent=text;banner.className=`admin-banner ${type}`;banner.hidden=!text;
}
function setSignedOut(note=''){
 dashboard.hidden=true;loginPanel.hidden=false;
 if(note)message(note,'warning');
}
async function loadSession(){
 const response=await fetch('/api/admin-session',{cache:'no-store',credentials:'same-origin'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('The staff access check could not be completed. Refresh and try again.');
 if(!data.authConfigured){setSignedOut('Staff sign-in is not configured yet. Complete the Google and Vercel steps in the setup guide before using this page.');$('#admin-sign-in').hidden=true;return;}
 $('#admin-sign-in').hidden=false;
 if(new URLSearchParams(location.search).get('auth_error')==='denied')message('That account could not be authorized. Sign in with an email address approved by NBSS.','warning');
 if(!data.authenticated){setSignedOut(new URLSearchParams(location.search).get('auth_error')==='setup'?'Admin access is not configured yet. Follow the setup guide before signing in.':'');return;}
 loginPanel.hidden=true;dashboard.hidden=false;message('');
 $('#admin-user').textContent=data.email;
 if(!data.storageConfigured)message('The order sheet connection is not configured. Requests cannot be loaded until the Google Sheet and Vercel credentials are set up.','error');
 else if(!data.emailConfigured)message('Automatic email alerts are not configured. Requests will still be saved here; add the email settings in Vercel so the counter receives a new-request alert.','warning');
 await refreshOrders();
}

function formatDate(value,{time=false}={}){
 if(!value)return 'Not specified';
 const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))return value;
 return new Intl.DateTimeFormat(undefined,time?{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}:{month:'short',day:'numeric',year:'numeric'}).format(parsed);
}
function statusClass(status){return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;}
function visibleOrders(){
 const query=$('#admin-search').value.trim().toLowerCase(),status=$('#admin-status-filter').value;
 return orders.filter(order=>{
  const inStatus=status==='all'||order.status===status;
  const haystack=[order.orderNumber,order.name,order.email,order.company,order.itemSummary,order.message,...order.items.map(x=>`${x.item} ${x.qty}`)].join(' ').toLowerCase();
  return inStatus&&(!query||haystack.includes(query));
 });
}
function renderStats(){
 const counts=[['Open requests',orders.filter(o=>!['Fulfilled','Closed'].includes(o.status)).length,'All active work'],['New',orders.filter(o=>o.status==='New').length,'Awaiting first review'],['Need follow-up',orders.filter(o=>o.status==='Need more information').length,'Customer details needed'],['Ready for pickup',orders.filter(o=>o.status==='Ready for pickup').length,'Handoff to arrange']];
 const container=$('#admin-stats');container.replaceChildren();
 for(const [label,value,note] of counts){const card=document.createElement('article');card.className='admin-stat-card';const name=document.createElement('span');name.textContent=label;const total=document.createElement('strong');total.textContent=String(value);const hint=document.createElement('small');hint.textContent=note;card.append(name,total,hint);container.append(card);}
}
function appendTextCell(row,text,className=''){
 const cell=document.createElement('td');if(className)cell.className=className;cell.textContent=text;row.append(cell);return cell;
}
function renderOrders(){
 const body=$('#admin-order-list');body.replaceChildren();
 const filtered=visibleOrders();$('#admin-result-count').textContent=`${filtered.length} ${filtered.length===1?'request':'requests'}`;
 $('#admin-empty').hidden=filtered.length>0;
 $('.admin-order-table').hidden=orders.length===0;
 for(const order of filtered){
  const row=document.createElement('tr');row.className='admin-order-row';row.tabIndex=0;row.setAttribute('aria-label',`Open ${order.orderNumber}, ${order.status}`);
  const ticket=document.createElement('td');ticket.className='admin-ticket-cell';const number=document.createElement('strong');number.textContent=order.orderNumber;const date=document.createElement('small');date.textContent=formatDate(order.createdAt,{time:true});ticket.append(number,date);row.append(ticket);
  const contact=document.createElement('td');contact.className='admin-contact-cell';const vessel=document.createElement('strong');vessel.textContent=order.company||'Vessel not provided';const person=document.createElement('small');person.textContent=`${order.name} · ${order.email}`;contact.append(vessel,person);row.append(contact);
  const itemNames=order.items.length?order.items.slice(0,2).map(x=>x.item).join(', ')+(order.items.length>2?` +${order.items.length-2} more`: ''):'Notes only';appendTextCell(row,itemNames,'admin-items-cell');
  appendTextCell(row,formatDate(order.neededBy),'admin-date-cell');
  const statusCell=document.createElement('td');const pill=document.createElement('span');pill.className=`admin-status-pill ${statusClass(order.status)}`;pill.textContent=order.status;statusCell.append(pill);row.append(statusCell);
  const action=document.createElement('td');const open=document.createElement('button');open.type='button';open.className='admin-open-request';open.textContent='OPEN →';open.setAttribute('aria-label',`Open request ${order.orderNumber}`);action.append(open);row.append(action);
  const activate=()=>openOrder(order.orderNumber);row.addEventListener('click',activate);row.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}});open.addEventListener('click',event=>{event.stopPropagation();activate();});body.append(row);
 }
}
async function refreshOrders(){
 if(loading)return;loading=true;$('#admin-refresh').disabled=true;
 try{
  const response=await fetch('/api/supply-orders',{cache:'no-store',credentials:'same-origin'}),payload=await response.json().catch(()=>({}));
  if(response.status===401){setSignedOut('Your staff session has expired. Sign in again to view supply requests.');return;}
  if(!response.ok)throw new Error(payload.error||'The supply request list could not be loaded.');
  orders=Array.isArray(payload.orders)?payload.orders:[];
  if(!payload.emailConfigured)message('Automatic email alerts are not configured. Requests are saved, but staff will not receive a new-request email.','warning');else message('');
  renderStats();renderOrders();$('#admin-updated-at').textContent=formatDate(payload.generatedAt,{time:true});
 }catch(error){message(error.message||'The order list could not be refreshed.','error');}
 finally{loading=false;$('#admin-refresh').disabled=false;}
}
function addMeta(label,value,link){
 const block=document.createElement('div');const term=document.createElement('span');term.textContent=label;const detail=document.createElement('strong');
 if(link){const anchor=document.createElement('a');anchor.href=link;anchor.textContent=value||'Not provided';detail.append(anchor);}else detail.textContent=value||'Not provided';
 block.append(term,detail);$('#detail-meta').append(block);
}
function openOrder(orderNumber){
 selectedOrder=orders.find(order=>order.orderNumber===orderNumber);if(!selectedOrder)return;
 $('#detail-title').textContent=selectedOrder.orderNumber;
 const customer=$('#detail-customer');customer.replaceChildren();const name=document.createElement('strong');name.textContent=selectedOrder.name;const email=document.createElement('a');email.href=`mailto:${selectedOrder.email}`;email.textContent=selectedOrder.email;customer.append(name,email);
 const meta=$('#detail-meta');meta.replaceChildren();addMeta('Vessel / company',selectedOrder.company);addMeta('Needed by',formatDate(selectedOrder.neededBy));addMeta('Preferred handoff',selectedOrder.handoff);addMeta('Submitted',formatDate(selectedOrder.createdAt,{time:true}));
 const list=$('#detail-items');list.replaceChildren();if(selectedOrder.items.length){for(const item of selectedOrder.items){const li=document.createElement('li'),title=document.createElement('strong'),qty=document.createElement('span');title.textContent=item.item;qty.textContent=item.qty||'As needed';li.append(title,qty);list.append(li);}}else{const li=document.createElement('li');li.textContent='No listed supply items';list.append(li);}
 $('#detail-message').textContent=selectedOrder.message||'No additional customer notes.';
 $('#detail-status').value=STATUSES.includes(selectedOrder.status)?selectedOrder.status:'New';$('#detail-staff-notes').value=selectedOrder.staffNotes||'';
 $('#detail-updated').textContent=`Last updated ${formatDate(selectedOrder.updatedAt,{time:true})} · Staff alert: ${selectedOrder.staffAlertStatus} · Customer receipt: ${selectedOrder.customerConfirmationStatus}`;
 dialog.showModal();
}
$('#admin-refresh').addEventListener('click',refreshOrders);
$('#admin-search').addEventListener('input',renderOrders);
$('#admin-status-filter').addEventListener('change',renderOrders);
$('#admin-detail-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
$('#admin-sign-out').addEventListener('click',async()=>{await fetch('/api/admin-logout',{method:'POST',credentials:'same-origin'}).catch(()=>{});location.reload();});
$('#admin-update-form').addEventListener('submit',async event=>{
 event.preventDefault();if(!selectedOrder)return;
 const save=$('#detail-save'),original=save.innerHTML;save.disabled=true;save.textContent='Saving…';
 try{
  const response=await fetch('/api/supply-orders',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({orderNumber:selectedOrder.orderNumber,status:$('#detail-status').value,staffNotes:$('#detail-staff-notes').value})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'Updates could not be saved.');
  const index=orders.findIndex(item=>item.orderNumber===payload.order.orderNumber);if(index>=0)orders[index]=payload.order;
  dialog.close();renderStats();renderOrders();message(`${payload.order.orderNumber} was updated.`,'success');
 }catch(error){$('#detail-updated').textContent=error.message||'Updates could not be saved.';}
 finally{save.disabled=false;save.innerHTML=original;}
});
function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}
$('#admin-export').addEventListener('click',()=>{
 const columns=['Request number','Created at','Status','Customer name','Email','Vessel / company','Needed by','Preferred handoff','Supply list','Customer notes','Staff notes','Staff alert status','Customer confirmation status'];
 const lines=[columns,...visibleOrders().map(o=>[o.orderNumber,o.createdAt,o.status,o.name,o.email,o.company,o.neededBy,o.handoff,o.itemSummary||o.items.map(x=>`${x.item}${x.qty?` — ${x.qty}`:''}`).join('; '),o.message,o.staffNotes,o.staffAlertStatus,o.customerConfirmationStatus])];
 const blob=new Blob(['\uFEFF'+lines.map(line=>line.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=`nbss-supply-requests-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();URL.revokeObjectURL(url);
});

loadSession().catch(error=>setSignedOut(error.message));
window.setInterval(()=>{if(!document.hidden&&!dashboard.hidden)refreshOrders();},60_000);

