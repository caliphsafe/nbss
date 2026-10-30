import {createSign} from 'node:crypto';
import {ORDER_HEADERS} from '../../lib/supply-orders.mjs';

const TOKEN_URL='https://oauth2.googleapis.com/token';
const SHEETS_URL='https://sheets.googleapis.com/v4/spreadsheets';
const SCOPE='https://www.googleapis.com/auth/spreadsheets';
let cachedToken;

export function sheetsConfigured(){
  return Boolean(process.env.GOOGLE_SHEETS_SPREADSHEET_ID&&process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL&&process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

function credentials(){
  const spreadsheetId=process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim();
  const clientEmail=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey=process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g,'\n').trim();
  if(!spreadsheetId||!clientEmail||!privateKey) throw new Error('Supply order storage is not configured.');
  return {spreadsheetId,clientEmail,privateKey};
}

const b64url=value=>Buffer.from(value).toString('base64url');

async function accessToken(){
  if(cachedToken&&cachedToken.expiresAt>Date.now()+60_000) return cachedToken.value;
  const {clientEmail,privateKey}=credentials();
  const now=Math.floor(Date.now()/1000);
  const header=b64url(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claim=b64url(JSON.stringify({iss:clientEmail,scope:SCOPE,aud:TOKEN_URL,iat:now,exp:now+3600}));
  const unsigned=`${header}.${claim}`;
  const signer=createSign('RSA-SHA256');signer.update(unsigned);signer.end();
  const assertion=`${unsigned}.${signer.sign(privateKey).toString('base64url')}`;
  const response=await fetch(TOKEN_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(12000)});
  if(!response.ok) throw new Error('Google Sheets authorization failed.');
  const data=await response.json();
  if(!data.access_token) throw new Error('Google Sheets authorization failed.');
  cachedToken={value:data.access_token,expiresAt:Date.now()+Number(data.expires_in||3600)*1000};
  return cachedToken.value;
}

async function sheetsFetch(path,{method='GET',body}={}){
  const {spreadsheetId}=credentials();
  const token=await accessToken();
  const response=await fetch(`${SHEETS_URL}/${encodeURIComponent(spreadsheetId)}/${path}`,{
    method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(`Google Sheets request failed (${response.status}).`);
  return data;
}

export async function getOrderRows(){
  const data=await sheetsFetch(`values/${encodeURIComponent('Orders!A:P')}`);
  const rows=Array.isArray(data.values)?data.values:[];
  if(!rows.length||ORDER_HEADERS.some((header,index)=>rows[0]?.[index]!==header)) throw new Error('The Orders tab needs the setup header row.');
  return rows;
}

export async function appendOrder(row){
  return sheetsFetch(`values/${encodeURIComponent('Orders!A:P')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,{
    method:'POST',body:{majorDimension:'ROWS',values:[row]}
  });
}

export async function updateOrderCells(sheetRow,{status,staffNotes,staffAlertStatus,customerConfirmationStatus,updatedAt}){
  const data=[];
  if(status!==undefined) data.push({range:`Orders!C${sheetRow}`,values:[[status]]});
  if(staffNotes!==undefined) data.push({range:`Orders!L${sheetRow}`,values:[[staffNotes]]});
  if(updatedAt!==undefined) data.push({range:`Orders!M${sheetRow}`,values:[[updatedAt]]});
  if(staffAlertStatus!==undefined) data.push({range:`Orders!N${sheetRow}`,values:[[staffAlertStatus]]});
  if(customerConfirmationStatus!==undefined) data.push({range:`Orders!O${sheetRow}`,values:[[customerConfirmationStatus]]});
  if(!data.length) return;
  return sheetsFetch('values:batchUpdate?valueInputOption=RAW',{method:'POST',body:{valueInputOption:'RAW',data}});
}

