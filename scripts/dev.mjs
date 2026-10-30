import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';
import handler from '../api/catalog.js';
import supplyOrdersHandler from '../api/supply-orders.js';
import adminLoginHandler from '../api/admin-login.js';
import adminCallbackHandler from '../api/admin-auth-callback.js';
import adminSessionHandler from '../api/admin-session.js';
import adminLogoutHandler from '../api/admin-logout.js';
const root=path.resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 req.query=Object.fromEntries(url.searchParams.entries());
 res.status=n=>(res.statusCode=n,res);
 res.json=x=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(x));return res;};
 res.redirect=(status,target)=>{res.statusCode=status;res.setHeader('Location',target);res.end();};
 if(url.pathname==='/api/catalog'){
   res.status=n=>(res.statusCode=n,res);res.json=x=>res.end(JSON.stringify(x));res.setHeader('Content-Type','application/json');return handler(req,res);
 }
 const apiRoutes=new Map([
  ['/api/supply-orders',supplyOrdersHandler],['/api/admin-login',adminLoginHandler],
  ['/api/admin-auth-callback',adminCallbackHandler],['/api/admin-session',adminSessionHandler],['/api/admin-logout',adminLogoutHandler]
 ]);
 if(apiRoutes.has(url.pathname)){
  if(['POST','PATCH'].includes(req.method)){
   try{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536){res.statusCode=413;return res.end(JSON.stringify({error:'Request is too large.'}));}}req.body=raw?JSON.parse(raw):{};}catch{res.statusCode=400;return res.end(JSON.stringify({error:'Invalid request body.'}));}
  }
  res.setHeader('Content-Type','application/json; charset=utf-8');
  return apiRoutes.get(url.pathname)(req,res);
 }
 try {
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)&&file!==root)throw Error('bad path');
  try {if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch {file+='.html';}
  const data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(root+'/404.html'));}
}).listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('NBSS preview ready'));
