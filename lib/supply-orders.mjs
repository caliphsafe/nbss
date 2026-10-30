import {randomBytes} from 'node:crypto';

export const ORDER_STATUSES = Object.freeze([
  'New',
  'Need more information',
  'Quoted',
  'Ready for pickup',
  'Fulfilled',
  'Closed'
]);

export const ORDER_HEADERS = Object.freeze([
  'Created at', 'Request number', 'Status', 'Customer name', 'Email',
  'Vessel / company', 'Needed by', 'Preferred handoff', 'Supply list',
  'Supply items JSON', 'Customer notes', 'Staff notes', 'Updated at',
  'Staff alert status', 'Customer confirmation status', 'Submission key'
]);

const HANDOFFS = new Set(['Counter pickup', 'Ask about dock delivery']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validDate = value => {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};

export function validateSupplyOrder(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Enter a valid supply request.'};
  if (clean(input.website, 200)) return {spam:true};

  const name=clean(input.name,100), email=clean(input.email,254), company=clean(input.company,150);
  const neededBy=clean(input.neededBy,10), handoff=clean(input.handoff,50), message=clean(input.message,4000);
  if(name.length<2) return {error:'Enter your name so the supply desk knows who to contact.'};
  if(!EMAIL_RE.test(email)) return {error:'Enter a valid email address.'};
  if(neededBy && !validDate(neededBy)) return {error:'Choose a valid needed-by date.'};
  if(!HANDOFFS.has(handoff)) return {error:'Choose a preferred handoff.'};
  if(!Array.isArray(input.items) || input.items.length>50) return {error:'Your supply list needs to contain 1–50 items.'};
  const items=input.items.map(item=>({
    item:clean(item?.item,200),
    qty:clean(item?.qty,100)
  })).filter(line=>line.item);
  if(items.length===0 && !message) return {error:'Add at least one supply item or a note for the counter.'};
  const submissionKey=clean(input.submissionKey,80);
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(submissionKey)) return {error:'Refresh the page and try submitting your request again.'};

  return {order:{name,email,company,neededBy,handoff,message,items,submissionKey}};
}

export function createOrderNumber(now=new Date()) {
  const day=now.toISOString().slice(0,10).replaceAll('-','');
  return `NB-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function supplySummary(items=[]) {
  return items.map(({item,qty})=>`• ${item}${qty?` — ${qty}`:''}`).join('\n');
}

export function orderToSheetRow(order,{orderNumber,now=new Date(),notificationStatus='Pending'}={}) {
  const timestamp=now.toISOString();
  return [timestamp,orderNumber,'New',order.name,order.email,order.company,order.neededBy,
    order.handoff,supplySummary(order.items),JSON.stringify(order.items),order.message,'',timestamp,
    notificationStatus,notificationStatus,order.submissionKey];
}

export function parseSheetOrder(row=[],sheetRow=0) {
  let items=[];
  try { items=JSON.parse(row[9]||'[]'); } catch {}
  if(!Array.isArray(items)) items=[];
  return {
    sheetRow,createdAt:String(row[0]||''),orderNumber:String(row[1]||''),status:String(row[2]||'New'),
    name:String(row[3]||''),email:String(row[4]||''),company:String(row[5]||''),neededBy:String(row[6]||''),
    handoff:String(row[7]||''),items:items.filter(x=>x&&typeof x==='object').map(x=>({item:String(x.item||''),qty:String(x.qty||'')})),
    itemSummary:String(row[8]||''),message:String(row[10]||''),staffNotes:String(row[11]||''),
    updatedAt:String(row[12]||row[0]||''),staffAlertStatus:String(row[13]||'Unknown'),
    customerConfirmationStatus:String(row[14]||'Unknown')
  };
}

