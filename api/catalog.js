import {fetchCatalog,normalize} from '../lib/catalog.mjs';
export default async function handler(req,res) {
  if(req.method!=='GET') {res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  try {
    const data=await fetchCatalog();
    res.setHeader('Cache-Control','public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({products:data.products.map(normalize),updatedAt:new Date().toISOString()});
  } catch {
    return res.status(503).json({error:'Live catalog unavailable. Final pricing and availability are confirmed at checkout.'});
  }
}
