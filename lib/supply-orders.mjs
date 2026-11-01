import {randomBytes} from 'node:crypto';

export const ORDER_STATUSES = Object.freeze([
  'New', 'Checking stock', 'Price confirmed', 'Preparing',
  'Ready for pickup', 'Fulfilled', 'On hold', 'Cancelled'
]);

export const ORDER_HEADERS = Object.freeze([
  'Created at', 'Order number', 'Status', 'Customer name', 'Phone',
  'Vessel / company', 'Needed by', 'Preferred handoff', 'Supply list',
  'Supply items JSON', 'Customer notes', 'Staff notes', 'Updated at', 'Submission key'
]);

const HANDOFFS = new Set(['Counter pickup', 'Ask about dock delivery']);
const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const validDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

function normalizeItems(input) {
  if (!Array.isArray(input) || input.length > 50) return {error:'A supply list can contain up to 50 lines.'};
  const items = input.map(item => ({item:clean(item?.item, 200), qty:clean(item?.qty, 100)})).filter(line => line.item);
  if (items.length !== input.filter(item => clean(item?.item, 200)).length) return {error:'Check the supply item names and try again.'};
  return {items};
}

export function validateSupplyOrder(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Enter a valid supply order.'};
  if (clean(input.website, 200)) return {spam:true};
  const name=clean(input.name,100), phone=clean(input.phone,40), company=clean(input.company,150);
  const neededBy=clean(input.neededBy,10), handoff=clean(input.handoff,50), message=clean(input.message,4000);
  if (name.length < 2) return {error:'Enter the name for this order.'};
  if (neededBy && !validDate(neededBy)) return {error:'Choose a valid needed-by date.'};
  if (!HANDOFFS.has(handoff)) return {error:'Choose a preferred handoff.'};
  const normalized=normalizeItems(input.items);
  if (normalized.error) return normalized;
  if (normalized.items.length === 0) return {error:'Add at least one supply line to the order.'};
  const submissionKey=clean(input.submissionKey,80);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(submissionKey)) return {error:'Refresh the page and try submitting your order again.'};
  return {order:{name,phone,company,neededBy,handoff,message,items:normalized.items,submissionKey}};
}

export function validateAdminOrderUpdate(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Enter valid order details.'};
  if (!ORDER_STATUSES.includes(input.status)) return {error:'Choose a valid order status.'};
  const name=clean(input.name,100), phone=clean(input.phone,40), company=clean(input.company,150);
  const neededBy=clean(input.neededBy,10), handoff=clean(input.handoff,50), message=clean(input.message,4000);
  if (name.length < 2) return {error:'Customer name must contain at least 2 characters.'};
  if (neededBy && !validDate(neededBy)) return {error:'Choose a valid needed-by date.'};
  if (!HANDOFFS.has(handoff)) return {error:'Choose a valid handoff.'};
  if (typeof input.staffNotes !== 'string' || input.staffNotes.length > 4000) return {error:'Staff notes must be 4,000 characters or fewer.'};
  const normalized=normalizeItems(input.items);
  if (normalized.error) return normalized;
  if (normalized.items.length === 0) return {error:'Keep at least one supply line on the order.'};
  return {order:{status:input.status,name,phone,company,neededBy,handoff,message,staffNotes:input.staffNotes.trim(),items:normalized.items}};
}

export function createOrderNumber(now=new Date()) {
  const day=now.toISOString().slice(0,10).replaceAll('-','');
  return `NB-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export function supplySummary(items=[]) {
  return items.map(({item,qty})=>`• ${item}${qty?` — ${qty}`:''}`).join('\n');
}

export function orderToSheetRow(order,{orderNumber,now=new Date()}={}) {
  const timestamp=now.toISOString();
  return [timestamp,orderNumber,'New',order.name,order.phone,order.company,order.neededBy,
    order.handoff,supplySummary(order.items),JSON.stringify(order.items),order.message,'',timestamp,order.submissionKey];
}

export function parseSheetOrder(row=[],sheetRow=0) {
  let items=[];
  try { items=JSON.parse(row[9]||'[]'); } catch {}
  if (!Array.isArray(items)) items=[];
  return {
    sheetRow,createdAt:String(row[0]||''),orderNumber:String(row[1]||''),status:String(row[2]||'New'),
    name:String(row[3]||''),phone:String(row[4]||''),company:String(row[5]||''),neededBy:String(row[6]||''),
    handoff:String(row[7]||''),items:items.filter(x=>x&&typeof x==='object').map(x=>({item:String(x.item||''),qty:String(x.qty||'')})),
    itemSummary:String(row[8]||''),message:String(row[10]||''),staffNotes:String(row[11]||''),
    updatedAt:String(row[12]||row[0]||'')
  };
}
