import {appendInventory,getInventoryRows,sheetsConfigured,updateInventoryRow} from './_lib/google-sheets.mjs';
import {getAdminEmail,requestOriginAllowed} from './_lib/admin-session.mjs';
import {inventoryToSheetRow,parseInventoryRow,validateInventoryItem} from '../lib/inventory.mjs';

const noStore=res=>res.setHeader('Cache-Control','no-store, private');
function bodyOf(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{return null;}}
  return null;
}

export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Method not allowed'});}
  try{
    if(!sheetsConfigured())return res.status(503).json({error:'The supply inventory is not connected yet.'});
    const isAdmin=Boolean(getAdminEmail(req));
    if(req.method==='GET'){
      if(!isAdmin){
        const rows=await getInventoryRows();
        const items=rows.slice(1).map(row=>parseInventoryRow(row)).filter(item=>item.active&&item.item).map(({item,category,unit})=>({item,category,unit}));
        return res.status(200).json({items});
      }
      const rows=await getInventoryRows();
      const items=rows.slice(1).map((row,index)=>parseInventoryRow(row,index+2)).filter(item=>item.item);
      return res.status(200).json({items,generatedAt:new Date().toISOString()});
    }

    if(!isAdmin)return res.status(401).json({error:'Staff sign-in required.'});
    if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
    const body=bodyOf(req);
    if(req.method==='POST'){
      const validation=validateInventoryItem(body?.item);
      if(validation.error)return res.status(400).json({error:validation.error});
      const rows=await getInventoryRows(),item=validation,appended=await appendInventory(inventoryToSheetRow(item));
      const range=appended.updates?.updatedRange||'',sheetRow=Number(range.match(/!A(\d+):/)?.[1])||rows.length+1;
      return res.status(201).json({item:{...item,sheetRow}});
    }

    const sheetRow=Number(body?.sheetRow);
    if(!Number.isInteger(sheetRow)||sheetRow<2)return res.status(400).json({error:'Choose a valid inventory row.'});
    const validation=validateInventoryItem(body?.item);
    if(validation.error)return res.status(400).json({error:validation.error});
    const rows=await getInventoryRows();
    if(sheetRow>rows.length)return res.status(404).json({error:'Inventory item not found.'});
    await updateInventoryRow(sheetRow,inventoryToSheetRow(validation));
    return res.status(200).json({item:{...validation,sheetRow}});
  }catch(error){
    console.error('Inventory handler failed:',error?.message||'unknown error');
    return res.status(503).json({error:'The supply desk could not reach its inventory sheet. Check the setup and try again.'});
  }
}
