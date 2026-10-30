import {createHmac,createPublicKey,randomBytes,timingSafeEqual,verify as verifySignature} from 'node:crypto';

export const SESSION_COOKIE='nbss_admin_session';
export const STATE_COOKIE='nbss_google_oauth_state';
const GOOGLE_CERTS='https://www.googleapis.com/oauth2/v3/certs';
let cachedKeys={values:null,expiresAt:0};

export function allowedAdminEmails(){
  return (process.env.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
}
export function adminAuthConfigured(){
  return Boolean(process.env.APP_BASE_URL&&process.env.ADMIN_GOOGLE_CLIENT_ID&&process.env.ADMIN_GOOGLE_CLIENT_SECRET&&
    process.env.ADMIN_SESSION_SECRET?.length>=32&&allowedAdminEmails().length);
}
export function sessionSecretConfigured(){return Boolean(process.env.ADMIN_SESSION_SECRET?.length>=32);}
export function appBaseUrl(){
  const value=process.env.APP_BASE_URL?.trim();
  if(!value) throw new Error('APP_BASE_URL is not configured.');
  const parsed=new URL(value);
  if(!['https:','http:'].includes(parsed.protocol)||parsed.pathname!=='/'||parsed.search||parsed.hash) throw new Error('APP_BASE_URL must be a site origin without a path.');
  return parsed.origin;
}
export function requestOriginAllowed(req){
  const origin=req.headers?.origin;
  if(!origin) return true;
  try{return new URL(origin).origin===appBaseUrl();}catch{return false;}
}
function cookieValue(req,name){
  const header=req.headers?.cookie||'';
  for(const part of header.split(';')){
    const [key,...rest]=part.trim().split('=');
    if(key===name)return rest.join('=');
  }
  return '';
}
const sign=value=>createHmac('sha256',process.env.ADMIN_SESSION_SECRET||'').update(value).digest('base64url');
function equal(a,b){
  const x=Buffer.from(a),y=Buffer.from(b);
  return x.length===y.length&&timingSafeEqual(x,y);
}
function secureCookie(){return process.env.NODE_ENV==='production'||process.env.APP_BASE_URL?.startsWith('https://');}
function cookie(name,value,{maxAge=3600}={}){
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie()?'; Secure':''}`;
}
export function clearStateCookie(){return cookie(STATE_COOKIE,'',{maxAge:0});}
export function clearSessionCookie(){return cookie(SESSION_COOKIE,'',{maxAge:0});}
export function createStateCookie(state){return cookie(STATE_COOKIE,state,{maxAge:600});}
export function createSessionCookie(email){
  const payload=Buffer.from(JSON.stringify({email,exp:Math.floor(Date.now()/1000)+8*60*60})).toString('base64url');
  return cookie(SESSION_COOKIE,`${payload}.${sign(payload)}`,{maxAge:8*60*60});
}
export function getAdminEmail(req){
  if(!sessionSecretConfigured()) return null;
  const token=cookieValue(req,SESSION_COOKIE),[payload,signature,...rest]=token.split('.');
  if(!payload||!signature||rest.length||!equal(sign(payload),signature))return null;
  try{
    const session=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    const email=String(session.email||'').toLowerCase();
    if(!email||!Number.isFinite(session.exp)||session.exp<=Date.now()/1000||!allowedAdminEmails().includes(email))return null;
    return email;
  }catch{return null;}
}

export function oauthRedirectUri(){return `${appBaseUrl()}/api/admin-auth-callback`;}
export function beginOAuthState(){return randomBytes(24).toString('base64url');}
export function stateCookieMatches(req,state){return Boolean(state&&equal(cookieValue(req,STATE_COOKIE),state));}

export function oauthLoginUrl(state){
  const params=new URLSearchParams({client_id:process.env.ADMIN_GOOGLE_CLIENT_ID,redirect_uri:oauthRedirectUri(),response_type:'code',scope:'openid email',state,nonce:state,prompt:'select_account'});
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function googleKeys(){
  if(cachedKeys.values&&cachedKeys.expiresAt>Date.now())return cachedKeys.values;
  const response=await fetch(GOOGLE_CERTS,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('Google identity verification failed.');
  const data=await response.json();
  cachedKeys={values:Array.isArray(data.keys)?data.keys:[],expiresAt:Date.now()+60*60*1000};
  return cachedKeys.values;
}

export async function exchangeAndVerifyGoogleCode(code,expectedNonce){
  const response=await fetch('https://oauth2.googleapis.com/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({code,client_id:process.env.ADMIN_GOOGLE_CLIENT_ID,client_secret:process.env.ADMIN_GOOGLE_CLIENT_SECRET,redirect_uri:oauthRedirectUri(),grant_type:'authorization_code'}),
    signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)throw new Error('Google sign-in could not be completed.');
  const token=await response.json();
  const parts=String(token.id_token||'').split('.');
  if(parts.length!==3)throw new Error('Google sign-in could not be verified.');
  let header,claims;
  try{header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{throw new Error('Google sign-in could not be verified.');}
  if(header.alg!=='RS256'||!header.kid)throw new Error('Google sign-in could not be verified.');
  const jwk=(await googleKeys()).find(key=>key.kid===header.kid&&key.kty==='RSA');
  if(!jwk)throw new Error('Google sign-in could not be verified.');
  const publicKey=createPublicKey({key:jwk,format:'jwk'});
  const signature=Buffer.from(parts[2],'base64url');
  if(!verifySignature('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),publicKey,signature))throw new Error('Google sign-in could not be verified.');
  const now=Math.floor(Date.now()/1000),audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
  const email=String(claims.email||'').trim().toLowerCase();
  if(!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||!audiences.includes(process.env.ADMIN_GOOGLE_CLIENT_ID)||
    (audiences.length>1&&claims.azp!==process.env.ADMIN_GOOGLE_CLIENT_ID)||claims.nonce!==expectedNonce||
    !Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+60||claims.email_verified!==true||!allowedAdminEmails().includes(email)){
    throw new Error('This Google account is not authorized for the NBSS order desk.');
  }
  return email;
}

