import {adminAuthConfigured,beginOAuthState,createStateCookie,oauthLoginUrl} from './_lib/admin-session.mjs';

export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end('Method not allowed');}
  if(!adminAuthConfigured())return res.redirect(302,'/admin?auth_error=setup');
  const state=beginOAuthState();
  res.setHeader('Set-Cookie',createStateCookie(state));
  return res.redirect(302,oauthLoginUrl(state));
}

