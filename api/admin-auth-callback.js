import {adminAuthConfigured,appBaseUrl,clearStateCookie,createSessionCookie,exchangeAndVerifyGoogleCode,stateCookieMatches} from './_lib/admin-session.mjs';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end('Method not allowed');}
  let base='/';try{base=appBaseUrl();}catch{}
  const fail=()=>{res.setHeader('Set-Cookie',clearStateCookie());return res.redirect(302,`${base}/admin?auth_error=denied`);};
  if(!adminAuthConfigured()||req.query?.error||!stateCookieMatches(req,req.query?.state)||!req.query?.code)return fail();
  try{
    const email=await exchangeAndVerifyGoogleCode(String(req.query.code),String(req.query.state));
    res.setHeader('Set-Cookie',[clearStateCookie(),createSessionCookie(email)]);
    return res.redirect(302,`${base}/admin`);
  }catch{
    return fail();
  }
}

