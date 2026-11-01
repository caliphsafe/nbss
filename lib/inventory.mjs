export const INVENTORY_HEADERS = Object.freeze([
  'Supply item', 'Category', 'Unit', 'On hand', 'Reorder at', 'Location', 'Notes', 'Active'
]);

const clean = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const quantity = value => {
  if (value === '' || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 10000000 ? number : null;
};

export function validateInventoryItem(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {error:'Enter valid inventory details.'};
  const item=clean(input.item,200), category=clean(input.category,100), unit=clean(input.unit,50);
  const onHand=quantity(input.onHand), reorderAt=quantity(input.reorderAt);
  if (!item) return {error:'Supply item is required.'};
  if (onHand === null || reorderAt === null) return {error:'On-hand and reorder quantities must be numbers at or above zero.'};
  if (typeof input.active !== 'boolean') return {error:'Choose whether this supply is active.'};
  return {item,category,unit,onHand,reorderAt,location:clean(input.location,120),notes:clean(input.notes,1000),active:input.active};
}

export function inventoryToSheetRow(item) {
  return [item.item,item.category,item.unit,item.onHand,item.reorderAt,item.location,item.notes,item.active?'TRUE':'FALSE'];
}

export function parseInventoryRow(row=[],sheetRow=0) {
  const onHand=Number(row[3]||0),reorderAt=Number(row[4]||0);
  return {
    sheetRow,item:String(row[0]||''),category:String(row[1]||''),unit:String(row[2]||''),
    onHand:Number.isFinite(onHand)?onHand:0,reorderAt:Number.isFinite(reorderAt)?reorderAt:0,
    location:String(row[5]||''),notes:String(row[6]||''),active:String(row[7]||'TRUE').toUpperCase()!=='FALSE'
  };
}
