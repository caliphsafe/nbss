import {randomBytes} from 'node:crypto';

export const INVOICE_STATUSES=Object.freeze(['Draft','Issued','Paid','Void']);
export const DISBURSEMENT_STATUSES=Object.freeze(['Draft','Issued','Settled','Void']);
export const DISBURSEMENT_CATEGORIES=Object.freeze([
  'Port authority dues','Operational port costs','Third-party disbursements','Agency fees','Other'
]);

export const INVOICE_HEADERS=Object.freeze([
  'Invoice number','Status','Issued date','Due date','Customer name','Billing address',
  'Vessel / company','IMO number','Delivery date','Delivery port / berth','PO reference',
  'Payment terms','Currency','Order number','Line items JSON','Subtotal','Tax rate (%)',
  'Tax amount','Total due','Payment instructions','Staff notes','Created at','Updated at'
]);

export const DISBURSEMENT_HEADERS=Object.freeze([
  'DA number','Status','Issued date','Owner / principal','Settlement office','Billing address',
  'Vessel','IMO number','Port of call','Berth','Arrival (ATA)','Departure (ATD)','Currency',
  'Pre-funding received','Line items JSON','Total costs','Balance / credit','Notes','Created at','Updated at'
]);

const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const roundMoney=value=>Math.round((value+Number.EPSILON)*100)/100;
const optionalNumber=value=>{
  if(value===''||value===null||value===undefined)return null;
  const number=Number(value);
  return Number.isFinite(number)?number:undefined;
};
const validDate=value=>{
  if(!value)return true;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
};
const currency=value=>clean(value,3).toUpperCase();
const parseJSON=value=>{
  try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed:[];}catch{return [];}
};
const asNumber=value=>{
  if(value===''||value===null||value===undefined)return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
};

export function createDocumentNumber(kind,now=new Date()){
  const day=now.toISOString().slice(0,10).replaceAll('-','');
  const prefix=kind==='invoice'?'INV':'DA';
  return `NBSS-${prefix}-${day}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizeInvoiceLines(input){
  if(!Array.isArray(input)||input.length===0||input.length>100)return {error:'Add between 1 and 100 invoice lines.'};
  const lines=[];
  for(const source of input){
    const description=clean(source?.description,240);
    if(!description)return {error:'Enter a description for every invoice line.'};
    const qty=optionalNumber(source?.qty),unitPrice=optionalNumber(source?.unitPrice);
    if(qty===undefined||qty!==null&&(qty<=0||qty>10000000))return {error:'Invoice quantities must be greater than zero.'};
    if(unitPrice===undefined||unitPrice!==null&&(unitPrice<0||unitPrice>1000000000))return {error:'Unit prices must be zero or greater.'};
    const unit=clean(source?.unit,50);
    lines.push({description,qty,unit,unitPrice,amount:qty!==null&&unitPrice!==null?roundMoney(qty*unitPrice):null});
  }
  return {lines};
}

export function validateInvoice(input={},metadata={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Enter valid invoice details.'};
  if(input.status!==undefined&&!INVOICE_STATUSES.includes(input.status))return {error:'Choose a valid invoice status.'};
  const status=INVOICE_STATUSES.includes(input.status)?input.status:'Draft';
  const issuedDate=clean(input.issuedDate,10),dueDate=clean(input.dueDate,10),deliveryDate=clean(input.deliveryDate,10);
  if(!validDate(issuedDate)||!validDate(dueDate)||!validDate(deliveryDate))return {error:'Check the invoice and delivery dates.'};
  const customerName=clean(input.customerName,160),vessel=clean(input.vessel,160),imoNumber=clean(input.imoNumber,20);
  if(!customerName)return {error:'Customer or company name is required.'};
  if(imoNumber&&!/^\d{7}$/.test(imoNumber))return {error:'IMO number must contain seven digits, or be left blank.'};
  const currencyCode=currency(input.currency);
  if(!/^[A-Z]{3}$/.test(currencyCode))return {error:'Enter a three-letter currency code such as USD.'};
  const taxRate=optionalNumber(input.taxRate);
  if(taxRate===undefined||taxRate!==null&&(taxRate<0||taxRate>100))return {error:'Tax rate must be between 0 and 100 percent.'};
  const normalized=normalizeInvoiceLines(input.lineItems);
  if(normalized.error)return normalized;
  const lines=normalized.lines,subtotal=roundMoney(lines.reduce((sum,line)=>sum+(line.amount??0),0));
  const taxAmount=taxRate===null?null:roundMoney(subtotal*taxRate/100);
  const totalDue=taxAmount===null?null:roundMoney(subtotal+taxAmount);
  const invoice={
    invoiceNumber:clean(metadata.invoiceNumber||input.invoiceNumber,40),status,issuedDate,dueDate,
    customerName,billingAddress:clean(input.billingAddress,1000),vessel,imoNumber,
    deliveryDate,deliveryLocation:clean(input.deliveryLocation,160),poReference:clean(input.poReference,100),
    paymentTerms:clean(input.paymentTerms,160),currency:currencyCode,orderNumber:clean(input.orderNumber,60),
    lineItems:lines,subtotal,taxRate,taxAmount,totalDue,
    paymentInstructions:clean(input.paymentInstructions,1000),staffNotes:clean(input.staffNotes,3000),
    createdAt:clean(metadata.createdAt||input.createdAt,50),updatedAt:clean(metadata.updatedAt||input.updatedAt,50)
  };
  const incomplete=lines.some(line=>line.qty===null||line.unitPrice===null||!line.unit);
  if(!['Draft','Void'].includes(status)){
    if(!issuedDate)return {error:'Set an issue date before issuing the invoice.'};
    if(!lines.length||incomplete)return {error:'Add a quantity, unit, and unit price to every line before issuing.'};
    if(taxRate===null)return {error:'Enter the applicable tax rate. Enter 0 only when NBSS has confirmed no tax applies.'};
  }
  return {invoice,readyToIssue:!incomplete&&taxRate!==null};
}

export function invoiceToSheetRow(invoice){
  return [invoice.invoiceNumber,invoice.status,invoice.issuedDate,invoice.dueDate,invoice.customerName,
    invoice.billingAddress,invoice.vessel,invoice.imoNumber,invoice.deliveryDate,invoice.deliveryLocation,
    invoice.poReference,invoice.paymentTerms,invoice.currency,invoice.orderNumber,JSON.stringify(invoice.lineItems),
    invoice.subtotal,invoice.taxRate??'',invoice.taxAmount??'',invoice.totalDue??'',invoice.paymentInstructions,
    invoice.staffNotes,invoice.createdAt,invoice.updatedAt];
}

export function parseInvoiceRow(row=[],sheetRow=0){
  const lineItems=parseJSON(row[14]).map(source=>{
    const qty=asNumber(source?.qty),unitPrice=asNumber(source?.unitPrice);
    return {description:String(source?.description||''),qty,unit:String(source?.unit||''),unitPrice,
      amount:qty!==null&&unitPrice!==null?roundMoney(qty*unitPrice):null};
  });
  const subtotal=roundMoney(lineItems.reduce((sum,line)=>sum+(line.amount??0),0));
  const taxRate=asNumber(row[16]);
  const calculatedTax=taxRate===null?null:roundMoney(subtotal*taxRate/100);
  return {
    sheetRow,invoiceNumber:String(row[0]||''),status:INVOICE_STATUSES.includes(String(row[1]||''))?String(row[1]):'Draft',
    issuedDate:String(row[2]||''),dueDate:String(row[3]||''),customerName:String(row[4]||''),billingAddress:String(row[5]||''),
    vessel:String(row[6]||''),imoNumber:String(row[7]||''),deliveryDate:String(row[8]||''),deliveryLocation:String(row[9]||''),
    poReference:String(row[10]||''),paymentTerms:String(row[11]||''),currency:String(row[12]||'USD'),orderNumber:String(row[13]||''),
    lineItems,subtotal,taxRate,taxAmount:calculatedTax,totalDue:calculatedTax===null?null:roundMoney(subtotal+calculatedTax),
    paymentInstructions:String(row[19]||''),staffNotes:String(row[20]||''),createdAt:String(row[21]||''),updatedAt:String(row[22]||'')
  };
}

function normalizeDisbursementLines(input,status){
  if(!Array.isArray(input)||input.length===0||input.length>150)return {error:'Add between 1 and 150 disbursement lines.'};
  const lines=[];
  for(const source of input){
    const category=DISBURSEMENT_CATEGORIES.includes(source?.category)?source.category:'Other';
    const description=clean(source?.description,240),payee=clean(source?.payee,160),reference=clean(source?.reference,160);
    if(!description)return {error:'Enter a description for every disbursement line.'};
    const amount=optionalNumber(source?.amount);
    if(amount===undefined||amount!==null&&(amount<0||amount>1000000000))return {error:'Disbursement amounts must be zero or greater.'};
    if(!['Draft','Void'].includes(status)&&amount===null)return {error:'Enter an amount for every disbursement line before issuing.'};
    if(!['Draft','Void'].includes(status)&&category==='Third-party disbursements'&&!reference)return {error:'Add an invoice or voucher reference for every third-party disbursement.'};
    lines.push({category,description,payee,reference,amount});
  }
  return {lines};
}

export function validateDisbursement(input={},metadata={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {error:'Enter valid disbursement account details.'};
  if(input.status!==undefined&&!DISBURSEMENT_STATUSES.includes(input.status))return {error:'Choose a valid disbursement status.'};
  const status=DISBURSEMENT_STATUSES.includes(input.status)?input.status:'Draft';
  const issuedDate=clean(input.issuedDate,10),arrival=clean(input.arrival,30),departure=clean(input.departure,30);
  if(!validDate(issuedDate))return {error:'Check the issue date.'};
  const principal=clean(input.principal,180),vessel=clean(input.vessel,160),imoNumber=clean(input.imoNumber,20);
  if(!principal)return {error:'Owner or principal is required.'};
  if(!vessel)return {error:'Vessel name is required.'};
  if(imoNumber&&!/^\d{7}$/.test(imoNumber))return {error:'IMO number must contain seven digits, or be left blank.'};
  const currencyCode=currency(input.currency);
  if(!/^[A-Z]{3}$/.test(currencyCode))return {error:'Enter a three-letter currency code such as USD.'};
  const preFunding=optionalNumber(input.preFunding);
  if(preFunding===undefined||preFunding!==null&&(preFunding<0||preFunding>1000000000000))return {error:'Pre-funding must be zero or greater.'};
  const normalized=normalizeDisbursementLines(input.lineItems,status);
  if(normalized.error)return normalized;
  const lines=normalized.lines,totalCosts=roundMoney(lines.reduce((sum,line)=>sum+(line.amount??0),0));
  const balance=preFunding===null?null:roundMoney(totalCosts-preFunding);
  if(!['Draft','Void'].includes(status)){
    if(!issuedDate)return {error:'Set an issue date before issuing the account.'};
    if(!clean(input.portOfCall,160))return {error:'Enter the port of call before issuing the account.'};
    if(preFunding===null)return {error:'Enter pre-funding received. Enter 0 if no advance was received.'};
  }
  const account={
    daNumber:clean(metadata.daNumber||input.daNumber,40),status,issuedDate,principal,
    settlementOffice:clean(input.settlementOffice,180),billingAddress:clean(input.billingAddress,1000),
    vessel,imoNumber,portOfCall:clean(input.portOfCall,160),berth:clean(input.berth,100),arrival,departure,
    currency:currencyCode,preFunding,lineItems:lines,totalCosts,balance,
    notes:clean(input.notes,3000),createdAt:clean(metadata.createdAt||input.createdAt,50),
    updatedAt:clean(metadata.updatedAt||input.updatedAt,50)
  };
  return {account};
}

export function disbursementToSheetRow(account){
  return [account.daNumber,account.status,account.issuedDate,account.principal,account.settlementOffice,
    account.billingAddress,account.vessel,account.imoNumber,account.portOfCall,account.berth,account.arrival,
    account.departure,account.currency,account.preFunding??'',JSON.stringify(account.lineItems),account.totalCosts,
    account.balance??'',account.notes,account.createdAt,account.updatedAt];
}

export function parseDisbursementRow(row=[],sheetRow=0){
  const preFunding=asNumber(row[13]);
  const lineItems=parseJSON(row[14]).map(source=>({
    category:DISBURSEMENT_CATEGORIES.includes(source?.category)?source.category:'Other',
    description:String(source?.description||''),payee:String(source?.payee||''),reference:String(source?.reference||''),amount:asNumber(source?.amount)
  }));
  const totalCosts=roundMoney(lineItems.reduce((sum,line)=>sum+(line.amount??0),0));
  const account={
    sheetRow,daNumber:String(row[0]||''),status:DISBURSEMENT_STATUSES.includes(String(row[1]||''))?String(row[1]):'Draft',
    issuedDate:String(row[2]||''),principal:String(row[3]||''),settlementOffice:String(row[4]||''),
    billingAddress:String(row[5]||''),vessel:String(row[6]||''),imoNumber:String(row[7]||''),
    portOfCall:String(row[8]||''),berth:String(row[9]||''),arrival:String(row[10]||''),departure:String(row[11]||''),
    currency:String(row[12]||'USD'),preFunding,lineItems,totalCosts,
    balance:preFunding===null?null:roundMoney(totalCosts-preFunding),notes:String(row[17]||''),
    createdAt:String(row[18]||''),updatedAt:String(row[19]||'')
  };
  account.sheetRow=sheetRow;
  return account;
}
