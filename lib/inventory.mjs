export const INVENTORY_HEADERS = Object.freeze([
  'Supply item', 'Category', 'Unit', 'Unit price', 'On hand', 'Reorder at', 'Location', 'Notes', 'Active'
]);

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const quantity = value => {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10000000 ? number : null;
};
const price = value => {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1000000000 ? Math.round((number + Number.EPSILON) * 100) / 100 : undefined;
};

export function validateInventoryItem(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Enter valid inventory details.'};
  const item=clean(input.item,200), category=clean(input.category,100), unit=clean(input.unit,50), unitPrice=price(input.unitPrice);
  const onHand=quantity(input.onHand), reorderAt=quantity(input.reorderAt);
  if (!item) return {error:'Supply item is required.'};
  if (unitPrice === undefined) return {error:'Unit price must be a number at or above zero, or left blank until confirmed.'};
  if (onHand === null || reorderAt === null) return {error:'On-hand and reorder quantities must be numbers at or above zero.'};
  if (typeof input.active !== 'boolean') return {error:'Choose whether this supply is active.'};
  return {item,category,unit,unitPrice,onHand,reorderAt,location:clean(input.location,120),notes:clean(input.notes,1000),active:input.active};
}

export function inventoryToSheetRow(item) {
  return [item.item,item.category,item.unit,item.unitPrice??'',item.onHand,item.reorderAt,item.location,item.notes,item.active?'TRUE':'FALSE'];
}

export function parseInventoryRow(row=[],sheetRow=0) {
  const unitPrice=row[3]===''||row[3]===undefined||row[3]===null?null:Number(row[3]);
  const onHand=Number(row[4]||0),reorderAt=Number(row[5]||0);
  return {
    sheetRow,item:String(row[0]||''),category:String(row[1]||''),unit:String(row[2]||''),
    unitPrice:Number.isFinite(unitPrice)&&unitPrice>=0?unitPrice:null,
    onHand:Number.isFinite(onHand)?onHand:0,reorderAt:Number.isFinite(reorderAt)?reorderAt:0,
    location:String(row[6]||''),notes:String(row[7]||''),active:String(row[8]||'TRUE').toUpperCase()!=='FALSE'
  };
}
