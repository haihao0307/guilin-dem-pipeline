'use strict';
// Browser execution is deliberately restricted to the authorized GitHub CI.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');

function argsOf(argv) {
  const args = {probeOnly:false,site:__dirname,out:'/tmp/r02-original-gpucloth-d48'};
  for(let i=0;i<argv.length;i++) {
    const key=argv[i];
    if(key==='--probe-only') args.probeOnly=true;
    else if(key==='--site'||key==='--out') {
      if(!argv[i+1]||argv[i+1].startsWith('--')) throw Error('Missing argument: '+key);
      args[key.slice(2)]=path.resolve(argv[++i]);
    } else throw Error('Unknown argument: '+key);
  }
  return args;
}
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bounded=(promise,ms,label)=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error(label+' exceeded '+ms+' ms')),ms);
  Promise.resolve(promise).then(x=>{clearTimeout(timer);resolve(x);},e=>{clearTimeout(timer);reject(e);});
});

async function main() {
  if(process.env.GITHUB_ACTIONS!=='true') throw Error('CI_ONLY: local browser execution is not authorized for this diagnostic.');
  const args=argsOf(process.argv.slice(2));
  const sourceHead=process.env.SOURCE_HEAD||process.env.GITHUB_SHA;
  if(!/^[0-9a-f]{40}$/.test(sourceHead||'')) throw Error('Exact GitHub source head required.');
  if(fs.existsSync(args.out)&&fs.readdirSync(args.out).length) throw Error('Output directory must be empty.');
  fs.mkdirSync(args.out,{recursive:true});
  const write=(name,data)=>fs.writeFileSync(path.join(args.out,name),JSON.stringify(data,null,2)+'\n');
  const flags=['--no-sandbox','--enable-unsafe-webgpu','--use-webgpu-adapter=swiftshader','--use-gpu-in-tests'];
  const report={
    schema:'independent-original-gpucloth-ci/1',status:'RUNNING',sourceHead,
    mode:args.probeOnly?'adapter-probe':'D-48-fit',
    flags,flagStrategy:'one fixed Chromium upstream SwiftShader WebGPU set; no combinations or fallback',
    platform:{os:os.platform(),release:os.release(),arch:os.arch(),node:process.version,cpus:os.cpus().length},
    github:{repository:process.env.GITHUB_REPOSITORY,runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT},
    startedAt:new Date().toISOString(),deadlineMS:args.probeOnly?60000:1200000,
    pageErrors:[],consoleErrors:[],failedRequests:[],httpErrors:[],blockedRequests:[],
    resourceResponses:[],cleanup:[],browser:null,result:null,
    diagnosticCompleted:false,productionCandidate:false,visualAcceptance:false,performanceAcceptance:false,
  };
  const driverStarted=Date.now();
  const remaining=cap=>Math.max(1,Math.min(cap,report.deadlineMS-(Date.now()-driverStarted)));
  let server,browser,context,page,terminal=null,origin=null;
  const save=()=>write('qa.json',report);
  save();
  let manifest=null;
  const allowed=new Map();
  const include=name=>{
    const file=path.join(args.site,name),bytes=fs.readFileSync(file);
    allowed.set('/'+name,{file,bytes,sha256:sha(bytes)});
  };
  try {
    if(args.probeOnly) ['probe.html','gpu-environment.mjs'].forEach(include);
    else {
      manifest=JSON.parse(fs.readFileSync(path.join(args.site,'BUILD.json')));
      if(manifest.sourceHead!==sourceHead) throw Error('BUILD sourceHead mismatch');
      for(const row of manifest.files) {
        include(row.path);
        const actual=allowed.get('/'+row.path);
        if(actual.sha256!==row.sha256||actual.bytes.length!==row.bytes) throw Error('BUILD byte mismatch: '+row.path);
      }
      include('BUILD.json');
      report.build={sourceHead:manifest.sourceHead,sha256:sha(fs.readFileSync(path.join(args.site,'BUILD.json'))),files:manifest.files};
    }
    server=http.createServer((req,res)=>{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const entry=allowed.get(pathname);
      if(req.method!=='GET'||!entry) {res.writeHead(404);res.end('Not in frozen diagnostic closure');return;}
      const ext=path.extname(entry.file),types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.wgsl':'text/plain; charset=utf-8','.gz':'application/octet-stream'};
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Content-Length':entry.bytes.length,'Cache-Control':'no-store'});
      res.end(entry.bytes);
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    origin='http://127.0.0.1:'+server.address().port;
    const {chromium}=require('playwright');
    browser=await bounded(chromium.launch({headless:true,args:flags}),remaining(60000),'Chromium launch');
    report.browser={version:browser.version(),requestedBackend:'SwiftShader WebGPU',actualAdapter:null};
    context=await browser.newContext({serviceWorkers:'block',viewport:{width:1100,height:760}});
    await context.route('**/*',route=>{
      const url=route.request().url();
      if(url.startsWith(origin+'/')||url.startsWith('data:')||url.startsWith('blob:')) return route.continue();
      report.blockedRequests.push({url});save();return route.abort('blockedbyclient');
    });
    page=await context.newPage();
    page.on('pageerror',e=>{report.pageErrors.push({message:e.message,stack:e.stack});save();});
    page.on('console',m=>{
      fs.appendFileSync(path.join(args.out,'console.ndjson'),JSON.stringify({type:m.type(),text:m.text()})+'\n');
      if(m.type()==='error'){report.consoleErrors.push(m.text());save();}
    });
    page.on('requestfailed',r=>{report.failedRequests.push({url:r.url(),error:r.failure()});save();});
    page.on('response',r=>{
      const u=r.url(),p=u.startsWith(origin)?new URL(u).pathname:null,entry=p?allowed.get(p):null;
      report.resourceResponses.push({url:u,status:r.status(),frozenBytes:entry?.bytes.length??null,frozenSHA256:entry?.sha256??null});
      if(r.status()>=400)report.httpErrors.push({url:u,status:r.status()});
      save();
    });
    await page.exposeFunction('__GPU_D48_EMIT__',event=>{
      const record={at:new Date().toISOString(),...event};
      if(event.type==='state') {
        if(!/^[a-z0-9-]+$/.test(event.name||'')) throw Error('Invalid state artifact name');
        write(event.name+'.json',event.data);
      } else fs.appendFileSync(path.join(args.out,'events.ndjson'),JSON.stringify(record)+'\n');
      if(event.type==='probe') {
        report.probe=event.data;write('adapter-probe.json',event.data);
      }
      if(event.type==='phase'||event.type==='frame-start')report.lastStage=event.data;
      if(event.type==='frame') {
        (report.frames??=[]).push(event.data);
        write('frames.json',report.frames);
      }
      if(event.type==='terminal') {
        terminal=event.data;report.result=event.data;write('browser-result.json',event.data);
      }
      save();
    });
    const documentPath=args.probeOnly?'/probe.html':'/index.html';
    const response=await page.goto(origin+documentPath,{waitUntil:'load',timeout:remaining(30000)});
    const documentBytes=await bounded(response.body(),remaining(30000),'Actual diagnostic document body');
    const expected=allowed.get(documentPath);
    report.navigation={url:response.url(),status:response.status(),bytes:documentBytes.length,sha256:sha(documentBytes)};
    if(response.status()!==200||sha(documentBytes)!==expected.sha256) throw Error('Actual document body mismatch');
    await page.waitForFunction(()=>typeof globalThis.__GPU_D48_RUN__==='function',undefined,{timeout:remaining(15000)});
    const result=await bounded(page.evaluate(()=>globalThis.__GPU_D48_RUN__()),remaining(report.deadlineMS),'Fixed diagnostic run');
    if(!terminal||terminal.status!==result.status) throw Error('Missing matching terminal diagnostic event');
    report.result=result;
    report.browser.actualAdapter=result.actualAdapter||result.adapter||null;
    const errors=['pageErrors','consoleErrors','failedRequests','httpErrors','blockedRequests'].some(k=>report[k].length);
    const completed=args.probeOnly?result.eligible===true:result.status==='ORIGINAL_GPU_D48_COMPLETED_NOT_APPROVED';
    report.status=errors?'BROWSER_ERRORS':completed?(args.probeOnly?'PROBE_COMPLETE_NOT_SOLVER_PASS':'D48_NUMERIC_COMPLETE_NOT_APPROVED'):result.status;
    report.diagnosticCompleted=completed&&!errors;
  } catch(error) {
    report.status='DIAGNOSTIC_INCOMPLETE';
    report.error={message:error.message,stack:error.stack};
  } finally {
    save();
    if(context) {
      try {await bounded(context.close(),10000,'Context close');report.cleanup.push({name:'context',passed:true});}
      catch(e){report.cleanup.push({name:'context',passed:false,error:e.message});}
    }
    if(browser) {
      try {await bounded(browser.close(),10000,'Browser close');report.cleanup.push({name:'browser',passed:true});}
      catch(e){report.cleanup.push({name:'browser',passed:false,error:e.message});}
    }
    if(server) {
      server.closeAllConnections?.();
      await bounded(new Promise(resolve=>server.close(resolve)),5000,'HTTP server close').catch(e=>report.cleanup.push({name:'server',passed:false,error:e.message}));
    }
    report.finishedAt=new Date().toISOString();
    if(report.cleanup.some(x=>!x.passed)){report.diagnosticCompleted=false;report.status='DIAGNOSTIC_CLEANUP_FAILED';}
    save();
  }
  console.log(JSON.stringify({status:report.status,sourceHead,out:args.out,probe:report.probe?.status,completedFrames:report.result?.completedFrames??0}));
  process.exitCode=report.diagnosticCompleted?0:2;
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=2;});
