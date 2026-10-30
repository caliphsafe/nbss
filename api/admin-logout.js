import {clearSessionCookie,requestOriginAllowed} from './_lib/admin-session.mjs';

export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'});}
  if(!requestOriginAllowed(req))return res.status(403).json({error:'Request origin not allowed.'});
  res.setHeader('Set-Cookie',clearSessionCookie());
  return res.status(204).end();
}

