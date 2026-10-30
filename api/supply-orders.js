import {appendOrder,getOrderRows,sheetsConfigured,updateOrderCells} from './_lib/google-sheets.mjs';
import {orderEmailConfigured,sendOrderEmails} from './_lib/order-email.mjs';
import {getAdminEmail,requestOriginAllowed} from './_lib/admin-session.mjs';
import {ORDER_STATUSES,createOrderNumber,orderToSheetRow,parseSheetOrder,validateSupplyOrder} from '../lib/supply-orders.mjs';

const noStore=res=>res.setHeader('Cache-Control','no-store, private');
function bodyOf(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{return null;}}
  return null;
}
function deliveryStatus(sent,configured){return sent?'Sent':configured?'Failed':'Not configured';}
const idempotentRow=(rows,key)=>{
  const index=rows.findIndex((row,index)=>index>0&&row[15]===key);
  return index<0?null:parseSheetOrder(rows[index],index+1);
};
async function notifyAndRecord(order,existing=null){
  const notifications=await sendOrderEmails(order,order.orderNumber||existing?.orderNumber||'',{
    sendStaff:existing?.staffAlertStatus!=='Sent',sendCustomer:existing?.customerConfirmationStatus!=='Sent'
  });
  const staffAlertStatus=existing?.staffAlertStatus==='Sent'?'Sent':deliveryStatus(notifications.staff,notifications.configured);
  const customerConfirmationStatus=existing?.customerConfirmationStatus==='Sent'?'Sent':deliveryStatus(notifications.customer,notifications.configured);
  const sheetRow=existing?.sheetRow||order.sheetRow;
  if(sheetRow)await updateOrderCells(sheetRow,{staffAlertStatus,customerConfirmationStatus,updatedAt:new Date().toISOString()}).catch(()=>{});
  return {notifications,staffAlertStatus,customerConfirmationStatus};
}

export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Method not allowed'});}
  try{
    if(!sheetsConfigured())return res.status(503).json({error:'Supply request intake is not configured yet. Please call the supply desk at 508-994-2961.'});
    if(req.method==='POST'){
      if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
      const validation=validateSupplyOrder(bodyOf(req));
      if(validation.spam)return res.status(400).json({error:'We could not validate this request. Please try again.'});
      if(validation.error)return res.status(400).json({error:validation.error});
      const {order}=validation;
      const rows=await getOrderRows();
      const duplicate=idempotentRow(rows,order.submissionKey);
      if(duplicate){
        const outcome=await notifyAndRecord({...duplicate,orderNumber:duplicate.orderNumber,sheetRow:duplicate.sheetRow},duplicate);
        return res.status(200).json({accepted:true,duplicate:true,orderNumber:duplicate.orderNumber,staffAlertSent:outcome.staffAlertStatus==='Sent',customerConfirmationSent:outcome.customerConfirmationStatus==='Sent',notificationsConfigured:outcome.notifications.configured});
      }
      const orderNumber=createOrderNumber(),now=new Date();
      const appended=await appendOrder(orderToSheetRow(order,{orderNumber,now}));
      const range=appended.updates?.updatedRange||'';
      let sheetRow=Number(range.match(/![A-Z]+(\d+):/)?.[1]);
      if(!sheetRow){const fresh=await getOrderRows();sheetRow=(fresh.findIndex(row=>row[1]===orderNumber)+1)||0;}
      const outcome=await notifyAndRecord({...order,orderNumber,sheetRow});
      return res.status(201).json({accepted:true,orderNumber,notificationsConfigured:outcome.notifications.configured,staffAlertSent:outcome.staffAlertStatus==='Sent',customerConfirmationSent:outcome.customerConfirmationStatus==='Sent'});
    }

    if(!getAdminEmail(req))return res.status(401).json({error:'Staff sign-in required.'});
    if(req.method==='GET'){
      const rows=await getOrderRows();
      const orders=rows.slice(1).map((row,index)=>parseSheetOrder(row,index+2)).filter(order=>order.orderNumber).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return res.status(200).json({orders,emailConfigured:orderEmailConfigured(),generatedAt:new Date().toISOString()});
    }

    if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
    const body=bodyOf(req),orderNumber=String(body?.orderNumber||'').trim();
    if(!/^NB-\d{8}-[A-F0-9]{8}$/.test(orderNumber))return res.status(400).json({error:'Choose a valid request.'});
    if(body.status!==undefined&&!ORDER_STATUSES.includes(body.status))return res.status(400).json({error:'Choose a valid request status.'});
    if(body.staffNotes!==undefined&&(typeof body.staffNotes!=='string'||body.staffNotes.length>4000))return res.status(400).json({error:'Staff notes must be 4,000 characters or fewer.'});
    const rows=await getOrderRows();
    const index=rows.findIndex((row,index)=>index>0&&row[1]===orderNumber);
    if(index<1)return res.status(404).json({error:'Request not found.'});
    const sheetRow=index+1,updatedAt=new Date().toISOString();
    await updateOrderCells(sheetRow,{status:body.status,staffNotes:body.staffNotes,updatedAt});
    const fresh=await getOrderRows();
    return res.status(200).json({order:parseSheetOrder(fresh[index],sheetRow)});
  }catch(error){
    console.error('Supply order handler failed:',error?.message||'unknown error');
    return res.status(503).json({error:req.method==='POST'?'We could not save your request right now. Please call 508-994-2961.':'The order desk could not reach its request sheet. Check the setup and try again.'});
  }
}

