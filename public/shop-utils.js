export const STORE='https://new-bedford.myshopify.com';
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n));
export function safeCart(value) {
 if(!Array.isArray(value)) return [];
 return value.filter(x=>Number.isSafeInteger(x.id)&&x.id>0&&typeof x.handle==='string').map(x=>({id:x.id,handle:x.handle,quantity:Math.max(1,Math.min(99,Math.floor(Number(x.quantity)||1)))})).slice(0,100);
}
export function checkoutURL(cart){
 const valid=safeCart(cart);
 return valid.length?`${STORE}/cart/${valid.map(x=>`${x.id}:${x.quantity}`).join(',')}`:null;
}
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
