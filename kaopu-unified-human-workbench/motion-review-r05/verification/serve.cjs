const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),port=Number(process.env.MOTION_PORT||8895);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gz':'application/octet-stream'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
 if(pathname==='/')pathname='/kaopu-unified-human-workbench/motion-review-r05/preview.html';
 const target=path.resolve(root,'.'+pathname),rel=path.relative(root,target);
 if(rel.startsWith('..')||path.isAbsolute(rel)||rel.split(/[\\/]/).some(x=>x.startsWith('.'))){res.writeHead(403);return res.end();}
 fs.stat(target,(error,s)=>{if(error||!s.isFile()){res.writeHead(404);return res.end('Missing '+pathname);}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':s.size});fs.createReadStream(target).pipe(res);});
}).listen(port,'127.0.0.1',()=>console.log('Single motion workbench http://127.0.0.1:'+port));
