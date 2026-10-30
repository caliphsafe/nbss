import {adminAuthConfigured,getAdminEmail} from './_lib/admin-session.mjs';
import {sheetsConfigured} from './_lib/google-sheets.mjs';
import {orderEmailConfigured} from './_lib/order-email.mjs';

export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const email=getAdminEmail(req);
  return res.status(200).json({authenticated:Boolean(email),email:email||null,authConfigured:adminAuthConfigured(),storageConfigured:sheetsConfigured(),emailConfigured:orderEmailConfigured()});
}

