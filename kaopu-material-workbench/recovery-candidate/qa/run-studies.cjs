'use strict';
const http=require('node:http'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process');
const candidate=path.resolve('kaopu-material-workbench/recovery-candidate'),fixture=path.resolve('kaopu-material-workbench/candidate-r16');
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://local').pathname),file;
 if(name.startsWith('/candidate/lab-r16/'))file=path.resolve(fixture,name.slice(19)||'index.html');
 else if(name.startsWith('/candidate/')){let rel=name.slice(11)||'index.html';if(rel.endsWith('/'))rel+='index.html';file=path.resolve(candidate,rel);}
 else{res.writeHead(404).end();return;}
 if(!file.startsWith(candidate+path.sep)&&!file.startsWith(fixture+path.sep)){res.writeHead(403).end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':ext==='.css'?'text/css':'text/plain');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
});
server.listen(4173,'127.0.0.1',()=>{const child=spawn(process.execPath,[path.join(__dirname,'studies-browser-qa.cjs')],{stdio:'inherit',env:{...process.env,BASE:'http://127.0.0.1:4173/candidate/',OUT:'material-studies-qa'}});child.on('exit',code=>server.close(()=>process.exit(code??1)));child.on('error',error=>{console.error(error);server.close(()=>process.exit(1));});});
