import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import './build.mjs';
import handler from '../api/catalog.js';
const root=path.resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.xml':'application/xml'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/catalog'){
   res.status=n=>(res.statusCode=n,res);res.json=x=>res.end(JSON.stringify(x));res.setHeader('Content-Type','application/json');return handler(req,res);
 }
 try {
  let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)&&file!==root)throw Error('bad path');
  try {if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch {file+='.html';}
  const data=await readFile(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.statusCode=404;res.setHeader('Content-Type','text/html');res.end(await readFile(root+'/404.html'));}
}).listen(Number(process.env.PORT)||4173,'0.0.0.0',()=>console.log('NBSS preview ready'));
