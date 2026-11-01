import {appendOrder,getOrderRows,sheetsConfigured,updateOrderRow} from './_lib/google-sheets.mjs';
import {getAdminEmail,requestOriginAllowed} from './_lib/admin-session.mjs';
import {createOrderNumber,orderToSheetRow,parseSheetOrder,validateAdminOrderUpdate,validateSupplyOrder} from '../lib/supply-orders.mjs';

const noStore=res=>res.setHeader('Cache-Control','no-store, private');
function bodyOf(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{return null;}}
  return null;
}
const idempotentOrder=(rows,key)=>{
  const index=rows.findIndex((row,index)=>index>0&&row[13]===key);
  return index<0?null:parseSheetOrder(rows[index],index+1);
};

export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Method not allowed'});}
  try{
    if(!sheetsConfigured())return res.status(503).json({error:'Order intake is not configured yet. Please call the supply desk at 508-994-2961.'});
    if(req.method==='POST'){
      if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
      const validation=validateSupplyOrder(bodyOf(req));
      if(validation.spam)return res.status(400).json({error:'We could not validate this order. Please try again.'});
      if(validation.error)return res.status(400).json({error:validation.error});
      const {order}=validation,rows=await getOrderRows();
      const duplicate=idempotentOrder(rows,order.submissionKey);
      if(duplicate)return res.status(200).json({orderNumber:duplicate.orderNumber});
      const orderNumber=createOrderNumber(),now=new Date();
      await appendOrder(orderToSheetRow(order,{orderNumber,now}));
      return res.status(201).json({orderNumber});
    }

    if(!getAdminEmail(req))return res.status(401).json({error:'Staff sign-in required.'});
    if(req.method==='GET'){
      const rows=await getOrderRows();
      const orders=rows.slice(1).map((row,index)=>parseSheetOrder(row,index+2)).filter(order=>order.orderNumber).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return res.status(200).json({orders,generatedAt:new Date().toISOString()});
    }

    if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
    const body=bodyOf(req),orderNumber=String(body?.orderNumber||'').trim();
    if(!/^NB-\d{8}-[A-F0-9]{8}$/.test(orderNumber))return res.status(400).json({error:'Choose a valid order.'});
    const rows=await getOrderRows(),index=rows.findIndex((row,index)=>index>0&&row[1]===orderNumber);
    if(index<1)return res.status(404).json({error:'Order not found.'});
    const current=parseSheetOrder(rows[index],index+1);
    const validation=validateAdminOrderUpdate({...current,...body});
    if(validation.error)return res.status(400).json({error:validation.error});
    const updatedAt=new Date().toISOString();
    await updateOrderRow(current.sheetRow,validation.order,updatedAt);
    const fresh=await getOrderRows();
    return res.status(200).json({order:parseSheetOrder(fresh[index],current.sheetRow)});
  }catch(error){
    console.error('Supply order handler failed:',error?.message||'unknown error');
    return res.status(503).json({error:req.method==='POST'?'We could not save your order right now. Please call 508-994-2961.':'The order desk could not reach its Google Sheet. Check the setup and try again.'});
  }
}
