import {
  appendDisbursement,appendInvoice,getDisbursementRows,getInvoiceRows,sheetsConfigured,
  updateDisbursementRow,updateInvoiceRow
} from './_lib/google-sheets.mjs';
import {getAdminEmail,requestOriginAllowed} from './_lib/admin-session.mjs';
import {
  createDocumentNumber,disbursementToSheetRow,invoiceToSheetRow,parseDisbursementRow,parseInvoiceRow,
  validateDisbursement,validateInvoice
} from '../lib/billing-documents.mjs';

const noStore=res=>res.setHeader('Cache-Control','no-store, private');
function bodyOf(req){
  if(req.body&&typeof req.body==='object')return req.body;
  if(typeof req.body==='string'){try{return JSON.parse(req.body);}catch{return null;}}
  return null;
}
function createdRow(response,fallback){
  const range=response?.updates?.updatedRange||'';
  return Number(range.match(/!A(\d+):/)?.[1])||fallback;
}

export default async function handler(req,res){
  noStore(res);
  if(!['GET','POST','PATCH'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH');return res.status(405).json({error:'Method not allowed'});}
  if(!getAdminEmail(req))return res.status(401).json({error:'Staff sign-in required.'});
  if(req.method!=='GET'&&!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
  try{
    if(!sheetsConfigured())return res.status(503).json({error:'Billing documents are not connected to the staff spreadsheet.'});
    if(req.method==='GET'){
      const [invoiceRows,disbursementRows]=await Promise.all([getInvoiceRows(),getDisbursementRows()]);
      const invoices=invoiceRows.slice(1).map((row,index)=>parseInvoiceRow(row,index+2)).filter(doc=>doc.invoiceNumber).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      const disbursements=disbursementRows.slice(1).map((row,index)=>parseDisbursementRow(row,index+2)).filter(doc=>doc.daNumber).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      return res.status(200).json({invoices,disbursements,generatedAt:new Date().toISOString()});
    }

    const body=bodyOf(req),kind=body?.kind,document=body?.document;
    if(!['invoice','disbursement'].includes(kind))return res.status(400).json({error:'Choose an invoice or disbursement account.'});
    const now=new Date().toISOString();
    if(req.method==='POST'){
      const number=createDocumentNumber(kind),metadata={createdAt:now,updatedAt:now};
      if(kind==='invoice'){
        const validation=validateInvoice(document,{...metadata,invoiceNumber:number});
        if(validation.error)return res.status(400).json({error:validation.error});
        const rows=await getInvoiceRows(),result=await appendInvoice(invoiceToSheetRow(validation.invoice));
        return res.status(201).json({document:parseInvoiceRow(invoiceToSheetRow(validation.invoice),createdRow(result,rows.length+1))});
      }
      const validation=validateDisbursement(document,{...metadata,daNumber:number});
      if(validation.error)return res.status(400).json({error:validation.error});
      const rows=await getDisbursementRows(),result=await appendDisbursement(disbursementToSheetRow(validation.account));
      return res.status(201).json({document:parseDisbursementRow(disbursementToSheetRow(validation.account),createdRow(result,rows.length+1))});
    }

    const number=String(body?.documentNumber||'').trim();
    if(kind==='invoice'){
      const rows=await getInvoiceRows(),index=rows.findIndex((row,rowIndex)=>rowIndex>0&&row[0]===number);
      if(index<1)return res.status(404).json({error:'Invoice not found.'});
      const current=parseInvoiceRow(rows[index],index+1),validation=validateInvoice(document,{invoiceNumber:current.invoiceNumber,createdAt:current.createdAt,updatedAt:now});
      if(validation.error)return res.status(400).json({error:validation.error});
      await updateInvoiceRow(current.sheetRow,invoiceToSheetRow(validation.invoice));
      return res.status(200).json({document:parseInvoiceRow(invoiceToSheetRow(validation.invoice),current.sheetRow)});
    }
    const rows=await getDisbursementRows(),index=rows.findIndex((row,rowIndex)=>rowIndex>0&&row[0]===number);
    if(index<1)return res.status(404).json({error:'Disbursement account not found.'});
    const current=parseDisbursementRow(rows[index],index+1),validation=validateDisbursement(document,{daNumber:current.daNumber,createdAt:current.createdAt,updatedAt:now});
    if(validation.error)return res.status(400).json({error:validation.error});
    await updateDisbursementRow(current.sheetRow,disbursementToSheetRow(validation.account));
    return res.status(200).json({document:parseDisbursementRow(disbursementToSheetRow(validation.account),current.sheetRow)});
  }catch(error){
    console.error('Billing document handler failed:',error?.message||'unknown error');
    return res.status(503).json({error:'The document desk could not reach its Google Sheet. Check the setup and try again.'});
  }
}
