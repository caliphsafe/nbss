export const STORE = 'https://new-bedford.myshopify.com';
export function category(p) {
  if (/hat|beanie/i.test(p.title)) return 'Hats';
  if (/youth|toddler/i.test(p.title)) return 'Kids';
  if (/hoodie|sweatshirt/i.test(p.title)) return 'Layers';
  return 'Apparel';
}
export function normalize(p) {
  return {
    id: p.id, handle: p.handle, title: p.title, category: category(p),
    description: p.body_html || '', images: p.images.map(i => ({id:i.id,src:i.src,alt:i.alt||p.title})),
    options: p.options.map(o=>({name:o.name,values:o.values})),
    variants:p.variants.map(v=>({id:v.id,title:v.title,options:[v.option1,v.option2,v.option3].filter(Boolean),price:Number(v.price),available:v.available,image:v.featured_image?.src||null,sku:v.sku}))
  };
}
export async function fetchCatalog() {
  const response = await fetch(`${STORE}/products.json?limit=250`, {signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  const data=await response.json();
  if (!Array.isArray(data.products) || !data.products.length) throw new Error('Empty catalog');
  return data;
}
