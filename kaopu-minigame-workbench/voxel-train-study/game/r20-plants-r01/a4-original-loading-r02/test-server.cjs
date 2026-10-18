/* CI fixture only. Serves existing files inside the current repository; creates no models. */
const http=require('node:http'),fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.gz':'application/gzip','.bin':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'};
async function startTestServer({root=process.cwd(),host='127.0.0.1',port=0,slowChunkBytes=512*1024,slowDelayMs=100}={}){
  root=await fsp.realpath(path.resolve(root));
  if(!(Number.isInteger(slowChunkBytes)&&slowChunkBytes>0&&slowChunkBytes<=1024*1024))throw Error('Invalid slow chunk size');
  if(!(slowDelayMs>=1&&slowDelayMs<=5000))throw Error('Invalid slow delay');
  const requests=[];
  const server=http.createServer(async(req,res)=>{
    let record;
    try{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
      const url=new URL(req.url,'http://fixture.invalid'),pathname=decodeURIComponent(url.pathname);
      if(pathname.includes('\0')){res.writeHead(400);res.end();return;}
      let candidate=path.resolve(root,'.'+pathname);
      if(candidate!==root&&!candidate.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      let stat=await fsp.stat(candidate);if(stat.isDirectory()){candidate=path.join(candidate,'index.html');stat=await fsp.stat(candidate);}
      const real=await fsp.realpath(candidate);
      if(real!==root&&!real.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      if(!stat.isFile()){res.writeHead(404);res.end();return;}
      const slow=path.basename(real)==='fields.bin.gz'&&url.searchParams.get('_qaSlow')==='1',cut=path.basename(real)==='fields.bin.gz'&&url.searchParams.get('_qaCut')==='1';
      record={method:req.method,url:req.url,pathname,slow,cut,status:200,totalBytes:stat.size,bytesSent:0,chunkEvents:[],startedAt:Date.now(),finishedAt:null,closedEarly:false};
      requests.push(record);
      res.on('finish',()=>{record.finishedAt=Date.now();});
      res.on('close',()=>{if(!res.writableFinished)record.closedEarly=true;});
      res.writeHead(200,{'Content-Type':types[path.extname(real)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});
      if(req.method==='HEAD'){res.end();return;}
      if(cut){
        const handle=await fsp.open(real,'r');
        try{const buffer=Buffer.allocUnsafe(Math.min(512*1024,stat.size)),{bytesRead}=await handle.read(buffer,0,buffer.length,0);
          record.bytesSent=bytesRead;record.chunkEvents.push({at:Date.now(),loaded:bytesRead});res.write(buffer.subarray(0,bytesRead));
          // Let the browser consume real body bytes before deliberately truncating the advertised response.
          await sleep(150);record.injectedTruncation=true;if(!res.destroyed)res.destroy();
        }finally{await handle.close();}return;
      }
      if(!slow){const stream=fs.createReadStream(real);stream.on('data',chunk=>record.bytesSent+=chunk.length);stream.on('error',error=>res.destroy(error));res.on('close',()=>stream.destroy());stream.pipe(res);return;}
      // This is a real streamed HTTP body, not route.fulfill() delivering a complete buffered response.
      const handle=await fsp.open(real,'r');
      try{
        for(let offset=0;offset<stat.size&&!res.destroyed;){
          const buffer=Buffer.allocUnsafe(Math.min(slowChunkBytes,stat.size-offset));
          const {bytesRead}=await handle.read(buffer,0,buffer.length,offset);if(!bytesRead)throw Error('Unexpected end of fixture file');
          offset+=bytesRead;record.bytesSent+=bytesRead;record.chunkEvents.push({at:Date.now(),loaded:offset});
          if(!res.write(buffer.subarray(0,bytesRead)))await new Promise(resolve=>{
            const done=()=>{res.off('drain',done);res.off('close',done);resolve();};res.once('drain',done);res.once('close',done);
          });
          if(offset<stat.size&&!res.destroyed)await sleep(slowDelayMs);
        }
        if(!res.destroyed)res.end();
      }finally{await handle.close();}
    }catch(error){
      if(record)record.error=error.message;
      if(!res.headersSent){res.writeHead(error.code==='ENOENT'?404:500,{'Content-Type':'text/plain'});res.end(error.code==='ENOENT'?'Not found':'Fixture server error');}
      else res.destroy(error);
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const actualPort=server.address().port;
  return {server,root,url:`http://${host}:${actualPort}`,requests,slowChunkBytes,slowDelayMs,
    close:()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();})};
}
module.exports={startTestServer};
if(require.main===module)startTestServer({root:process.env.REPO_ROOT||process.cwd(),port:Number(process.env.PORT||8097)}).then(f=>{
  console.log(JSON.stringify({fixtureURL:f.url,root:f.root,slowQuery:'_qaSlow=1',slowChunkBytes:f.slowChunkBytes,slowDelayMs:f.slowDelayMs}));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await f.close();process.exit(0);});
}).catch(error=>{console.error(error);process.exitCode=1;});
