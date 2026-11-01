const $=(selector,root=document)=>root.querySelector(selector);
const INVOICE_STATUSES=['Draft','Issued','Paid','Void'];
const DA_STATUSES=['Draft','Issued','Settled','Void'];
const DA_CATEGORIES=['Port authority dues','Operational port costs','Third-party disbursements','Agency fees','Other'];
let invoices=[],disbursements=[],orders=[],inventory=[],activeKind='invoice',editingDocument=null,loading=false;
const invoicePicker=$('#invoice-order-picker-dialog'),editor=$('#billing-document-dialog'),preview=$('#document-preview-dialog');

function banner(text,type='info'){
 const el=$('#admin-banner');el.textContent=text;el.className=`admin-banner ${type}`;el.hidden=!text;
}
function today(){
 const date=new Date(),local=new Date(date.getTime()-date.getTimezoneOffset()*60_000);
 return local.toISOString().slice(0,10);
}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function textCell(row,value,className=''){
 const cell=document.createElement('td');if(className)cell.className=className;cell.textContent=value;row.append(cell);return cell;
}
function currency(amount,code='USD'){
 if(amount===null||amount===undefined||!Number.isFinite(Number(amount)))return '—';
 const safe=/^[A-Z]{3}$/.test(code)?code:'USD';
 try{return new Intl.NumberFormat('en-US',{style:'currency',currency:safe}).format(Number(amount));}catch{return `${safe} ${Number(amount).toFixed(2)}`;}
}
function dateLabel(value){
 if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(parsed);
}
function dateTimeLabel(value){
 if(!value)return '—';const parsed=new Date(value);return Number.isNaN(parsed.getTime())?value:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(parsed);
}
function statusClass(status){return `status-${String(status).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;}
function actionButton(label,action,doc){
 const button=document.createElement('button');button.type='button';button.className='admin-open-request document-row-action';button.textContent=label;button.addEventListener('click',()=>action(doc));return button;
}
function documentActions(doc,kind){
 const cell=document.createElement('td');cell.className='document-actions-cell';
 const edit=document.createElement('button');edit.type='button';edit.className='admin-open-request document-row-action';edit.textContent='EDIT';edit.addEventListener('click',()=>kind==='invoice'?openInvoice(doc):openDisbursement(doc));
 const print=document.createElement('button');print.type='button';print.className='admin-open-request document-row-action';print.textContent='PRINT / PDF';print.addEventListener('click',()=>showPreview(kind,doc));
 cell.append(edit,print);return cell;
}
function renderInvoices(){
 const body=$('#invoice-list');body.replaceChildren();$('#invoice-empty').hidden=invoices.length>0;$('.admin-doc-table', $('#invoice-documents-panel')).hidden=invoices.length===0;
 for(const invoice of invoices){
  const row=document.createElement('tr');textCell(row,invoice.invoiceNumber,'admin-ticket-cell');
  const party=document.createElement('td');party.className='admin-contact-cell';const vessel=document.createElement('strong');vessel.textContent=invoice.vessel||'Vessel not entered';const customer=document.createElement('small');customer.textContent=invoice.customerName;party.append(vessel,customer);row.append(party);
  textCell(row,dateLabel(invoice.issuedDate),'admin-date-cell');const status=document.createElement('td'),pill=document.createElement('span');pill.className=`admin-status-pill ${statusClass(invoice.status)}`;pill.textContent=invoice.status;status.append(pill);row.append(status);
  textCell(row,invoice.totalDue===null?'Incomplete draft':currency(invoice.totalDue,invoice.currency),'document-money-cell');row.append(documentActions(invoice,'invoice'));body.append(row);
 }
}
function balanceSummary(account){
 if(account.balance===null||account.balance===undefined)return 'Enter advance';
 if(Math.abs(account.balance)<0.005)return 'Fully funded';
 return account.balance>0?`Due to NBSS ${currency(account.balance,account.currency)}`:`Credit ${currency(Math.abs(account.balance),account.currency)}`;
}
function renderDisbursements(){
 const body=$('#disbursement-list');body.replaceChildren();$('#disbursement-empty').hidden=disbursements.length>0;$('.admin-doc-table',$('#disbursement-documents-panel')).hidden=disbursements.length===0;
 for(const account of disbursements){
  const row=document.createElement('tr');textCell(row,account.daNumber,'admin-ticket-cell');
  const party=document.createElement('td');party.className='admin-contact-cell';const vessel=document.createElement('strong');vessel.textContent=account.vessel||'Vessel not entered';const principal=document.createElement('small');principal.textContent=account.principal;party.append(vessel,principal);row.append(party);
  textCell(row,[account.portOfCall,account.berth].filter(Boolean).join(' · ')||'—','admin-date-cell');const status=document.createElement('td'),pill=document.createElement('span');pill.className=`admin-status-pill ${statusClass(account.status)}`;pill.textContent=account.status;status.append(pill);row.append(status);
  textCell(row,balanceSummary(account),'document-money-cell');row.append(documentActions(account,'disbursement'));body.append(row);
 }
}
async function refreshDocuments(){
 if(loading||$('#documents-view').hidden)return;loading=true;$('#admin-refresh').disabled=true;
 try{
  const response=await fetch('/api/billing-documents',{cache:'no-store',credentials:'same-origin'}),payload=await response.json().catch(()=>({}));
  if(response.status===401){banner('Your staff session has expired. Sign in again to view billing documents.','warning');return;}
  if(!response.ok)throw new Error(payload.error||'Billing documents could not be loaded.');
  invoices=Array.isArray(payload.invoices)?payload.invoices:[];disbursements=Array.isArray(payload.disbursements)?payload.disbursements:[];renderInvoices();renderDisbursements();
 }catch(error){banner(`${error.message||'The document registers could not be loaded.'} Check the Invoices and Disbursements tabs and their exact headers.`,'warning');}
 finally{loading=false;$('#admin-refresh').disabled=false;}
}
window.addEventListener('nbss:refresh-documents',refreshDocuments);
$('#documents-invoice-tab').addEventListener('click',()=>setDocumentPanel('invoice'));
$('#documents-da-tab').addEventListener('click',()=>setDocumentPanel('disbursement'));
function setDocumentPanel(kind){
 activeKind=kind;const invoice=kind==='invoice';$('#documents-invoice-tab').setAttribute('aria-selected',String(invoice));$('#documents-da-tab').setAttribute('aria-selected',String(!invoice));$('#invoice-documents-panel').hidden=!invoice;$('#disbursement-documents-panel').hidden=invoice;
}

async function fetchOrderSources(){
 const [orderResponse,inventoryResponse]=await Promise.all([
  fetch('/api/supply-orders',{cache:'no-store',credentials:'same-origin'}),
  fetch('/api/inventory',{cache:'no-store',credentials:'same-origin'})
 ]);
 const [orderData,inventoryData]=await Promise.all([orderResponse.json().catch(()=>({})),inventoryResponse.json().catch(()=>({}))]);
 if(!orderResponse.ok)throw new Error(orderData.error||'Orders could not be loaded.');
 if(!inventoryResponse.ok)throw new Error(inventoryData.error||'Inventory pricing could not be loaded.');
 orders=Array.isArray(orderData.orders)?orderData.orders:[];inventory=Array.isArray(inventoryData.items)?inventoryData.items:[];
}
function renderOrderPicker(query=''){
 const host=$('#invoice-order-picker');host.replaceChildren();const normalized=query.trim().toLowerCase();
 const matches=orders.filter(order=>[order.orderNumber,order.company,order.name,order.phone,...(order.items||[]).map(line=>line.item)].join(' ').toLowerCase().includes(normalized));
 if(!matches.length){const empty=document.createElement('p');empty.className='admin-empty-state';empty.textContent=orders.length?'No orders match that search.':'No supply orders are available yet.';host.append(empty);return;}
 for(const order of matches){
  const card=document.createElement('article');card.className='document-order-card';const info=document.createElement('div');const number=document.createElement('strong');number.textContent=order.orderNumber;const vessel=document.createElement('span');vessel.textContent=order.company||order.name;const lines=document.createElement('small');lines.textContent=(order.items||[]).map(line=>`${line.item}${line.qty?` · requested ${line.qty}`:''}`).join('  /  ');info.append(number,vessel,lines);
  const button=document.createElement('button');button.type='button';button.className='button';button.textContent='Start invoice →';button.addEventListener('click',()=>{invoicePicker.close();openFromOrder(order);});card.append(info,button);host.append(card);
 }
}
$('#invoice-order-search').addEventListener('input',event=>renderOrderPicker(event.target.value));
$('#invoice-from-order').addEventListener('click',async()=>{
 try{await fetchOrderSources();$('#invoice-order-search').value='';renderOrderPicker();invoicePicker.showModal();}
 catch(error){banner(error.message||'Order details could not be loaded.','warning');}
});
$('#invoice-new').addEventListener('click',()=>openInvoice());
$('#disbursement-new').addEventListener('click',()=>openDisbursement());

function defaultInvoice(order=null){
 let notes='';const lines=(order?.items||[]).map(line=>{
  const stock=inventory.find(item=>item.item.toLowerCase()===line.item.toLowerCase());
  return {description:line.item,qty:'',unit:stock?.unit||'',unitPrice:stock?.unitPrice??''};
 });
 if(order)notes=`Source order ${order.orderNumber}. Customer requested: ${(order.items||[]).map(line=>`${line.item}${line.qty?` — ${line.qty}`:''}`).join('; ')}. Confirm actual goods delivered before issuing.`;
 return {invoiceNumber:'Assigned on save',status:'Draft',issuedDate:today(),dueDate:'',customerName:order?.name||'',billingAddress:'',vessel:order?.company||'',imoNumber:'',deliveryDate:'',deliveryLocation:'',poReference:'',paymentTerms:'',currency:'USD',orderNumber:order?.orderNumber||'',lineItems:lines.length?lines:[{description:'',qty:'',unit:'',unitPrice:''}],taxRate:'',paymentInstructions:'',staffNotes:notes};
}
function fillInvoiceForm(invoice){
 const set=(id,value)=>{const input=$(`#${id}`);input.value=value??'';};
 set('invoice-number',invoice.invoiceNumber);set('invoice-status',invoice.status);set('invoice-issued-date',invoice.issuedDate);set('invoice-due-date',invoice.dueDate);set('invoice-customer',invoice.customerName);set('invoice-billing-address',invoice.billingAddress);set('invoice-vessel',invoice.vessel);set('invoice-imo',invoice.imoNumber);set('invoice-delivery-date',invoice.deliveryDate);set('invoice-delivery-location',invoice.deliveryLocation);set('invoice-po-reference',invoice.poReference);set('invoice-payment-terms',invoice.paymentTerms);set('invoice-currency',invoice.currency||'USD');set('invoice-order-number',invoice.orderNumber);set('invoice-tax-rate',invoice.taxRate);set('invoice-payment-instructions',invoice.paymentInstructions);set('invoice-staff-notes',invoice.staffNotes);
 renderInvoiceLines(invoice.lineItems||[{description:'',qty:'',unit:'',unitPrice:''}]);updateInvoiceTotals();
}
function openInvoice(invoice=null){
 activeKind='invoice';editingDocument=invoice?.sheetRow?invoice:null;const value=invoice||defaultInvoice();$('#billing-document-title').textContent=editingDocument?`EDIT ${value.invoiceNumber}`:'NEW VESSEL INVOICE';$('#billing-document-kicker').textContent='SUPPLIER INVOICE / NBSS';$('#invoice-document-form').hidden=false;$('#disbursement-document-form').hidden=true;$('#billing-document-error').hidden=true;$('#document-save-note').textContent=editingDocument?`Sheet row ${value.sheetRow} · Invoice fields are editable here.`:'A new invoice number will be assigned when saved.';fillInvoiceForm(value);updateSaveLabel();editor.showModal();
}
function openFromOrder(order){
 const invoice=defaultInvoice(order);openInvoice(invoice);
}
function invoiceLineValues(){
 return [...$('#invoice-lines').children].map(row=>({description:$('[data-invoice-field="description"]',row).value.trim(),qty:$('[data-invoice-field="qty"]',row).value,unit:$('[data-invoice-field="unit"]',row).value.trim(),unitPrice:$('[data-invoice-field="unitPrice"]',row).value})).filter(line=>line.description);
}
function renderInvoiceLines(lines){
 const host=$('#invoice-lines');host.replaceChildren();
 lines.forEach((line,index)=>{
  const row=document.createElement('div');row.className='billing-line invoice-billing-line';
  for(const [field,type,placeholder,value,max] of [
   ['description','text','Item delivered',line.description||'',240],['qty','number','Qty',line.qty??'',null],['unit','text','Unit',line.unit||'',50],['unitPrice','number','Price',line.unitPrice??'',null]
  ]){
   const input=document.createElement('input');input.dataset.invoiceField=field;input.setAttribute('aria-label',`${field==='unitPrice'?'Unit price':field==='qty'?'Quantity':field} for invoice line ${index+1}`);input.type=type;input.placeholder=placeholder;input.value=value;if(max)input.maxLength=max;if(type==='number'){input.min='0';input.step='0.01';}row.append(input);
  }
  const amount=document.createElement('span');amount.className='billing-line-amount';amount.textContent=invoiceLineAmount(line);row.append(amount);
  const remove=document.createElement('button');remove.type='button';remove.className='admin-line-remove';remove.textContent='×';remove.dataset.invoiceRemove=String(index);remove.setAttribute('aria-label',`Remove invoice line ${index+1}`);remove.disabled=lines.length<=1;row.append(remove);host.append(row);
 });
}
function invoiceLineAmount(line){
 const qty=Number(line.qty),price=Number(line.unitPrice);return line.qty!==''&&line.qty!==null&&line.unitPrice!==''&&line.unitPrice!==null&&Number.isFinite(qty)&&Number.isFinite(price)?currency(qty*price):'—';
}
$('#invoice-add-line').addEventListener('click',()=>{const lines=invoiceLineValues();lines.push({description:'',qty:'',unit:'',unitPrice:''});renderInvoiceLines(lines);updateInvoiceTotals();});
$('#invoice-lines').addEventListener('click',event=>{
 const button=event.target.closest('[data-invoice-remove]');if(!button)return;const lines=[...$('#invoice-lines').children].map(row=>({description:$('[data-invoice-field="description"]',row).value,qty:$('[data-invoice-field="qty"]',row).value,unit:$('[data-invoice-field="unit"]',row).value,unitPrice:$('[data-invoice-field="unitPrice"]',row).value}));lines.splice(Number(button.dataset.invoiceRemove),1);renderInvoiceLines(lines.length?lines:[{description:'',qty:'',unit:'',unitPrice:''}]);updateInvoiceTotals();
});
$('#invoice-lines').addEventListener('input',updateInvoiceTotals);$('#invoice-tax-rate').addEventListener('input',updateInvoiceTotals);$('#invoice-status').addEventListener('change',updateSaveLabel);
function invoicePayload(){
 return {status:$('#invoice-status').value,issuedDate:$('#invoice-issued-date').value,dueDate:$('#invoice-due-date').value,customerName:$('#invoice-customer').value,billingAddress:$('#invoice-billing-address').value,vessel:$('#invoice-vessel').value,imoNumber:$('#invoice-imo').value,deliveryDate:$('#invoice-delivery-date').value,deliveryLocation:$('#invoice-delivery-location').value,poReference:$('#invoice-po-reference').value,paymentTerms:$('#invoice-payment-terms').value,currency:$('#invoice-currency').value,orderNumber:$('#invoice-order-number').value,lineItems:[...$('#invoice-lines').children].map(row=>({description:$('[data-invoice-field="description"]',row).value,qty:$('[data-invoice-field="qty"]',row).value,unit:$('[data-invoice-field="unit"]',row).value,unitPrice:$('[data-invoice-field="unitPrice"]',row).value})).filter(line=>line.description.trim()),taxRate:$('#invoice-tax-rate').value,paymentInstructions:$('#invoice-payment-instructions').value,staffNotes:$('#invoice-staff-notes').value};
}
function updateInvoiceTotals(){
 const lines=invoicePayload().lineItems,complete=lines.filter(line=>line.qty!==''&&line.unitPrice!==''&&line.unit&&Number(line.qty)>0&&Number(line.unitPrice)>=0),subtotal=complete.reduce((sum,line)=>sum+Number(line.qty)*Number(line.unitPrice),0),taxInput=$('#invoice-tax-rate').value,tax=taxInput===''?null:subtotal*Number(taxInput)/100;
 $('#invoice-lines').querySelectorAll('.invoice-billing-line').forEach(row=>{const inputLine={qty:$('[data-invoice-field="qty"]',row).value,unitPrice:$('[data-invoice-field="unitPrice"]',row).value};$('.billing-line-amount',row).textContent=invoiceLineAmount(inputLine);});
 const host=$('#invoice-total-preview');host.replaceChildren();
 const incomplete=lines.length-complete.length;const rows=[['Subtotal',currency(subtotal)],['Tax',tax===null?'Set rate before issuing':currency(tax)]];
 for(const [label,value] of rows){const line=document.createElement('div'),key=document.createElement('span'),amount=document.createElement('strong');key.textContent=label;amount.textContent=value;line.append(key,amount);host.append(line);}
 const total=document.createElement('div');total.className='billing-total-final';const label=document.createElement('span'),value=document.createElement('strong');label.textContent='Total due';value.textContent=tax===null?'—':currency(subtotal+tax);total.append(label,value);host.append(total);
 const note=document.createElement('p');note.textContent=incomplete?`${incomplete} line${incomplete===1?' is':'s are'} incomplete. Draft totals exclude incomplete lines.`:'Verify tax treatment and actual delivered quantities before issuing.';host.append(note);
}
function updateSaveLabel(){
 const status=$('#invoice-document-form').hidden?$('#da-status').value:$('#invoice-status').value;
 $('#document-save').textContent=status==='Draft'?'Save draft':status==='Void'?'Save as void':`Save ${status.toLowerCase()}`;
}

function fillDADialog(account){
 const set=(id,value)=>{const input=$(`#${id}`);input.value=value??'';};
 set('da-number',account.daNumber);set('da-status',account.status);set('da-issued-date',account.issuedDate);set('da-currency',account.currency||'USD');set('da-principal',account.principal);set('da-settlement-office',account.settlementOffice);set('da-billing-address',account.billingAddress);set('da-vessel',account.vessel);set('da-imo',account.imoNumber);set('da-port',account.portOfCall);set('da-berth',account.berth);set('da-arrival',account.arrival);set('da-departure',account.departure);set('da-prefunding',account.preFunding);set('da-notes',account.notes);
 renderDALines(account.lineItems||[{category:'Third-party disbursements',description:'',payee:'',reference:'',amount:''}]);updateDATotals();
}
function openDisbursement(account=null){
 activeKind='disbursement';editingDocument=account?.sheetRow?account:null;const value=account||{daNumber:'Assigned on save',status:'Draft',issuedDate:today(),currency:'USD',principal:'',settlementOffice:'',billingAddress:'',vessel:'',imoNumber:'',portOfCall:'',berth:'',arrival:'',departure:'',preFunding:'',lineItems:[{category:'Third-party disbursements',description:'',payee:'',reference:'',amount:''}],notes:''};$('#billing-document-title').textContent=editingDocument?`EDIT ${value.daNumber}`:'NEW DISBURSEMENT ACCOUNT';$('#billing-document-kicker').textContent='PORT CALL / DISBURSEMENT ACCOUNT';$('#invoice-document-form').hidden=true;$('#disbursement-document-form').hidden=false;$('#billing-document-error').hidden=true;$('#document-save-note').textContent=editingDocument?`Sheet row ${value.sheetRow} · All accounting fields are editable here.`:'A new DA reference will be assigned when saved.';fillDADialog(value);updateSaveLabel();editor.showModal();
}
function daLineValues(){
 return [...$('#da-lines').children].map(row=>({category:$('[data-da-field="category"]',row).value,description:$('[data-da-field="description"]',row).value.trim(),payee:$('[data-da-field="payee"]',row).value.trim(),reference:$('[data-da-field="reference"]',row).value.trim(),amount:$('[data-da-field="amount"]',row).value})).filter(line=>line.description);
}
function renderDALines(lines){
 const host=$('#da-lines');host.replaceChildren();
 lines.forEach((line,index)=>{
  const row=document.createElement('div');row.className='billing-line da-billing-line';
  const category=document.createElement('select');category.dataset.daField='category';category.setAttribute('aria-label',`Cost category for line ${index+1}`);for(const name of DA_CATEGORIES){const option=document.createElement('option');option.textContent=name;option.value=name;category.append(option);}category.value=DA_CATEGORIES.includes(line.category)?line.category:'Other';row.append(category);
  for(const [field,placeholder,value,max] of [['description','Actual cost description',line.description||'',240],['payee','Supplier / payee',line.payee||'',160],['reference','Invoice or voucher ref.',line.reference||'',160]]){const input=document.createElement('input');input.type='text';input.dataset.daField=field;input.placeholder=placeholder;input.value=value;input.maxLength=max;input.setAttribute('aria-label',`${placeholder}, line ${index+1}`);row.append(input);}
  const amount=document.createElement('input');amount.type='number';amount.min='0';amount.max='1000000000';amount.step='0.01';amount.placeholder='0.00';amount.value=line.amount??'';amount.dataset.daField='amount';amount.setAttribute('aria-label',`Amount for disbursement line ${index+1}`);row.append(amount);
  const remove=document.createElement('button');remove.type='button';remove.className='admin-line-remove';remove.textContent='×';remove.dataset.daRemove=String(index);remove.setAttribute('aria-label',`Remove disbursement line ${index+1}`);remove.disabled=lines.length<=1;row.append(remove);host.append(row);
 });
}
$('#da-add-line').addEventListener('click',()=>{const lines=daLineValues();lines.push({category:'Third-party disbursements',description:'',payee:'',reference:'',amount:''});renderDALines(lines);updateDATotals();});
$('#da-lines').addEventListener('click',event=>{const button=event.target.closest('[data-da-remove]');if(!button)return;const lines=[...$('#da-lines').children].map(row=>({category:$('[data-da-field="category"]',row).value,description:$('[data-da-field="description"]',row).value,payee:$('[data-da-field="payee"]',row).value,reference:$('[data-da-field="reference"]',row).value,amount:$('[data-da-field="amount"]',row).value}));lines.splice(Number(button.dataset.daRemove),1);renderDALines(lines.length?lines:[{category:'Other',description:'',payee:'',reference:'',amount:''}]);updateDATotals();});
$('#da-lines').addEventListener('input',updateDATotals);$('#da-prefunding').addEventListener('input',updateDATotals);$('#da-status').addEventListener('change',updateSaveLabel);
$('#da-currency').addEventListener('input',updateDATotals);
function daPayload(){
 return {status:$('#da-status').value,issuedDate:$('#da-issued-date').value,principal:$('#da-principal').value,settlementOffice:$('#da-settlement-office').value,billingAddress:$('#da-billing-address').value,vessel:$('#da-vessel').value,imoNumber:$('#da-imo').value,portOfCall:$('#da-port').value,berth:$('#da-berth').value,arrival:$('#da-arrival').value,departure:$('#da-departure').value,currency:$('#da-currency').value,preFunding:$('#da-prefunding').value,lineItems:[...$('#da-lines').children].map(row=>({category:$('[data-da-field="category"]',row).value,description:$('[data-da-field="description"]',row).value,payee:$('[data-da-field="payee"]',row).value,reference:$('[data-da-field="reference"]',row).value,amount:$('[data-da-field="amount"]',row).value})).filter(line=>line.description.trim()),notes:$('#da-notes').value};
}
function updateDATotals(){
 const lines=daPayload().lineItems,complete=lines.filter(line=>line.amount!==''&&Number(line.amount)>=0),costs=complete.reduce((sum,line)=>sum+Number(line.amount),0),advance=$('#da-prefunding').value===''?null:Number($('#da-prefunding').value),balance=advance===null?null:costs-advance;
 const host=$('#da-total-preview');host.replaceChildren();
 for(const [label,value] of [['Total costs',currency(costs,$('#da-currency').value||'USD')],['Pre-funding',advance===null?'Enter advance received':currency(advance,$('#da-currency').value||'USD')]]){const row=document.createElement('div'),name=document.createElement('span'),amount=document.createElement('strong');name.textContent=label;amount.textContent=value;row.append(name,amount);host.append(row);}
 const row=document.createElement('div');row.className='billing-total-final';const label=document.createElement('span'),value=document.createElement('strong');
 label.textContent=balance===null?'Balance / credit':balance>0?'Balance due to NBSS':balance<0?'Credit due to principal':'Fully funded';value.textContent=balance===null?'—':currency(Math.abs(balance),$('#da-currency').value||'USD');row.append(label,value);host.append(row);
 const note=document.createElement('p');note.textContent=`${lines.length-complete.length} line amount${lines.length-complete.length===1?' is':'s are'} incomplete if present. Keep source invoices and receipts with the port-call records.`;host.append(note);
}

$('#invoice-document-form').addEventListener('input',updateInvoiceTotals);
$('#document-save').addEventListener('click',()=>{
 const form=activeKind==='invoice'?$('#invoice-document-form'):$('#disbursement-document-form');if(!form.reportValidity())return;form.requestSubmit();
});
$('#invoice-document-form').addEventListener('submit',event=>saveDocument(event,'invoice'));
$('#disbursement-document-form').addEventListener('submit',event=>saveDocument(event,'disbursement'));
async function saveDocument(event,kind){
 event.preventDefault();const save=$('#document-save'),error=$('#billing-document-error');save.disabled=true;error.hidden=true;save.textContent='Saving…';
 try{
  const response=await fetch('/api/billing-documents',{method:editingDocument?'PATCH':'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({kind,documentNumber:kind==='invoice'?editingDocument?.invoiceNumber:editingDocument?.daNumber,document:kind==='invoice'?invoicePayload():daPayload()})});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||'The document could not be saved.');
  const doc=payload.document;if(kind==='invoice'){const index=invoices.findIndex(item=>item.invoiceNumber===doc.invoiceNumber);if(index<0)invoices.unshift(doc);else invoices[index]=doc;renderInvoices();}else{const index=disbursements.findIndex(item=>item.daNumber===doc.daNumber);if(index<0)disbursements.unshift(doc);else disbursements[index]=doc;renderDisbursements();}
  editor.close();banner(`${kind==='invoice'?doc.invoiceNumber:doc.daNumber} was saved.`,'success');
 }catch(problem){error.textContent=problem.message||'The document could not be saved.';error.hidden=false;}
 finally{save.disabled=false;updateSaveLabel();}
}

function documentField(label,value){return `<div><span>${esc(label)}</span><strong>${esc(value||'—')}</strong></div>`;}
function printHead(title,number,status){
 return `<header class="print-document-head"><img src="/images/nbss-logo.png" alt="NBSS ship's wheel logo"><div><p>NEW BEDFORD SHIP SUPPLY CO., INC.</p><h1>${esc(title)}</h1><span class="print-document-status">${esc(status)}</span></div><div class="print-document-number"><small>DOCUMENT NUMBER</small><strong>${esc(number)}</strong></div></header>`;
}
function printFooter(){return `<footer class="print-document-footer"><span>New Bedford Ship Supply Co., Inc.</span><span>108 Front Street · Pier 3 · New Bedford, Massachusetts</span><span>508-994-2961 · nbshipsupply.com</span></footer>`;}
function invoiceMarkup(doc){
 const lines=(doc.lineItems||[]).map((line,index)=>`<tr><td>${String(index+1).padStart(2,'0')}</td><td>${esc(line.description)}</td><td class="number-cell">${line.qty===null?'—':esc(line.qty)}</td><td>${esc(line.unit||'—')}</td><td class="number-cell">${line.unitPrice===null?'—':currency(line.unitPrice,doc.currency)}</td><td class="number-cell">${line.amount===null?'—':currency(line.amount,doc.currency)}</td></tr>`).join('');
 const taxLine=doc.taxRate===null?`<div><span>Tax rate</span><strong>Not entered</strong></div>`:`<div><span>Tax (${esc(doc.taxRate)}%)</span><strong>${currency(doc.taxAmount,doc.currency)}</strong></div>`;
 return `<article class="print-document">${printHead('VESSEL SUPPLY INVOICE',doc.invoiceNumber,doc.status)}<div class="print-document-fields">${documentField('Issue date',dateLabel(doc.issuedDate))}${documentField('Due date',dateLabel(doc.dueDate))}${documentField('Order reference',doc.orderNumber)}${documentField('Purchase order',doc.poReference)}${documentField('Payment terms',doc.paymentTerms)}${documentField('Delivery date',dateLabel(doc.deliveryDate))}</div><div class="print-parties"><section><h2>INVOICE TO</h2><strong>${esc(doc.customerName)}</strong><p>${esc(doc.billingAddress||'')}</p></section><section><h2>VESSEL / DELIVERY</h2><strong>${esc(doc.vessel||'Not specified')}</strong><p>${esc(doc.imoNumber?`IMO ${doc.imoNumber}`:'IMO not provided')}</p><p>${esc([doc.deliveryLocation].filter(Boolean).join(' · ')||'Delivery location not specified')}</p></section></div><table class="print-line-table"><thead><tr><th>#</th><th>ITEM DELIVERED</th><th class="number-cell">QTY</th><th>UNIT</th><th class="number-cell">UNIT PRICE</th><th class="number-cell">LINE TOTAL</th></tr></thead><tbody>${lines}</tbody></table><div class="print-document-totals"><div><span>Subtotal</span><strong>${currency(doc.subtotal,doc.currency)}</strong></div>${taxLine}<div class="print-grand-total"><span>TOTAL DUE · ${esc(doc.currency)}</span><strong>${doc.totalDue===null?'Not final':currency(doc.totalDue,doc.currency)}</strong></div></div><div class="print-document-notes"><h2>PAYMENT</h2><p>${esc(doc.paymentInstructions||'')}</p></div>${doc.status==='Draft'?'<div class="print-draft-mark">DRAFT · NOT ISSUED</div>':''}${printFooter()}</article>`;
}
function disbursementMarkup(doc){
 const lines=(doc.lineItems||[]).map((line,index)=>`<tr><td>${String(index+1).padStart(2,'0')}</td><td>${esc(line.category)}</td><td>${esc(line.description)}</td><td>${esc(line.payee||'—')}</td><td>${esc(line.reference||'—')}</td><td class="number-cell">${line.amount===null?'—':currency(line.amount,doc.currency)}</td></tr>`).join('');
 let balanceLabel='Balance not finalized',balanceValue='Enter the advance received';
 if(doc.balance!==null&&doc.balance!==undefined){if(Math.abs(doc.balance)<0.005){balanceLabel='Balance';balanceValue='Fully funded';}else if(doc.balance>0){balanceLabel='Balance due to agent';balanceValue=currency(doc.balance,doc.currency);}else{balanceLabel='Credit due to principal';balanceValue=currency(Math.abs(doc.balance),doc.currency);}}
 return `<article class="print-document">${printHead('PORT-CALL DISBURSEMENT ACCOUNT',doc.daNumber,doc.status)}<div class="print-document-fields">${documentField('Date issued',dateLabel(doc.issuedDate))}${documentField('Port of call',doc.portOfCall)}${documentField('Berth',doc.berth)}${documentField('Arrival (ATA)',dateTimeLabel(doc.arrival))}${documentField('Departure (ATD)',dateTimeLabel(doc.departure))}${documentField('Currency',doc.currency)}</div><div class="print-parties"><section><h2>PRINCIPAL / SETTLEMENT</h2><strong>${esc(doc.principal)}</strong><p>${esc(doc.settlementOffice||'')}</p><p>${esc(doc.billingAddress||'')}</p></section><section><h2>VESSEL</h2><strong>${esc(doc.vessel)}</strong><p>${esc(doc.imoNumber?`IMO ${doc.imoNumber}`:'IMO not provided')}</p></section></div><table class="print-line-table"><thead><tr><th>#</th><th>CATEGORY</th><th>PORT-CALL COST</th><th>PAYEE</th><th>VOUCHER / INVOICE REF.</th><th class="number-cell">AMOUNT</th></tr></thead><tbody>${lines}</tbody></table><div class="print-document-totals"><div><span>Total costs</span><strong>${currency(doc.totalCosts,doc.currency)}</strong></div><div><span>Pre-funding received</span><strong>${doc.preFunding===null?'Not entered':currency(doc.preFunding,doc.currency)}</strong></div><div class="print-grand-total"><span>${esc(balanceLabel)}</span><strong>${esc(balanceValue)}</strong></div></div>${doc.notes?`<div class="print-document-notes"><h2>ACCOUNT NOTES</h2><p>${esc(doc.notes)}</p></div>`:''}<p class="print-support-note">Supporting supplier invoices, authority bills, and receipts should be retained with the port-call accounting records.</p>${doc.status==='Draft'?'<div class="print-draft-mark">DRAFT · NOT ISSUED</div>':''}${printFooter()}</article>`;
}
function showPreview(kind,doc){
 $('#document-preview-title').textContent=kind==='invoice'?`INVOICE ${doc.invoiceNumber}`:`ACCOUNT ${doc.daNumber}`;
 $('#document-print-content').innerHTML=kind==='invoice'?invoiceMarkup(doc):disbursementMarkup(doc);preview.showModal();
}
$('#document-print-button').addEventListener('click',()=>window.print());
for(const button of document.querySelectorAll('[data-close-dialog]'))button.addEventListener('click',()=>document.getElementById(button.dataset.closeDialog).close());
for(const dialog of [invoicePicker,editor,preview])dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});

for(const id of ['invoice-order-picker-dialog','billing-document-dialog','document-preview-dialog']){
 const dialog=document.getElementById(id);dialog.addEventListener('cancel',()=>{if(id==='billing-document-dialog')editingDocument=null;});
}
