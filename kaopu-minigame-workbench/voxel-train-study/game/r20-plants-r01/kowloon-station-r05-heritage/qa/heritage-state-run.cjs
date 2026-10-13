// Standalone numeric QA. Never opens the station host or renders a scene.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=__dirname,out=path.join(root,'heritage-state-results');fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA||null,status:'running',scope:'27 numeric material-state samples only',stages:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(report,null,2)+'\n');
const server=http.createServer((req,res)=>{
 try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+name);
  if(!file.startsWith(root+path.sep)||!path.relative(root,file).startsWith('heritage-state-'))return res.writeHead(403).end();
  const body=fs.readFileSync(file);res.setHeader('content-type',file.endsWith('.html')?'text/html':file.endsWith('.json')?'application/json':file.endsWith('.mjs')?'text/javascript':'text/plain');res.end(body);
 }catch{res.writeHead(404).end();}
});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function closeOwned(browser,owner){
 let error=null;const closed=Promise.resolve().then(()=>owner?owner.close():browser?.close()).catch(e=>{error=String(e);});
 const graceful=await Promise.race([closed.then(()=>true),delay(3000).then(()=>false)]),child=owner?.process();let forced=false;
 if(child&&child.exitCode===null&&child.signalCode===null){forced=true;await Promise.race([owner.kill().catch(e=>{error=String(e);}),delay(3000)]);if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
 return {graceful,forced,error};
}
(async()=>{
 let browser,owner,page,timer,rejectFatal;const fatal=new Promise((_,reject)=>{rejectFatal=reject;});fatal.catch(()=>{});
 const bounded=p=>Promise.race([p,fatal]);const arm=(ms,label)=>{clearTimeout(timer);timer=setTimeout(()=>rejectFatal(Error(`${label} exceeded ${ms}ms`)),ms);};
 try{
  for(const name of ['probe.frag','manifest.json'])if(!fs.existsSync(path.join(root,'heritage-state-generated',name)))throw Error(`Missing heritage-state-generated/${name}; emit and compile first`);
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  arm(45000,'Browser startup');owner=await bounded(chromium.launchServer({headless:true,args:['--no-sandbox','--disable-gpu-watchdog','--use-angle=swiftshader','--enable-logging=stderr']}));
  for(const stream of ['stdout','stderr'])owner.process()[stream]?.on('data',x=>fs.appendFileSync(path.join(out,'browser-'+stream+'.log'),x));
  browser=await bounded(chromium.connect(owner.wsEndpoint()));page=await bounded(browser.newPage());
  page.on('pageerror',e=>{report.errors.push(e.message);save();rejectFatal(e);});
  page.on('console',message=>{const text=message.text();if(text.startsWith('HERITAGE_STATE_STAGE ')){const stage=text.slice('HERITAGE_STATE_STAGE '.length);report.stages.push({stage,at:new Date().toISOString()});save();console.log(text);if(stage==='compile')arm(240000,'Shader compilation');if(stage==='readback')arm(120000,'GPU readback');}else if(message.type()==='error'){report.errors.push(text);save();}});
  await bounded(page.goto('http://127.0.0.1:'+server.address().port+'/heritage-state-probe.html',{waitUntil:'domcontentloaded',timeout:45000}));
  await bounded(page.waitForFunction(()=>['passed','failed'].includes(window.__heritageStateProbe?.status),null,{timeout:0}));
  report.probe=await bounded(page.evaluate(()=>window.__heritageStateProbe));
  fs.writeFileSync(path.join(out,'readback.json'),JSON.stringify(report.probe,null,2)+'\n');
  report.status=report.probe.status==='passed'&&!report.errors.length?'passed':'failed';
  if(report.status!=='passed')process.exitCode=1;
 }catch(e){report.status='failed';report.failure=e.stack||String(e);process.exitCode=1;}
 finally{clearTimeout(timer);report.cleanup=await closeOwned(browser,owner);save();server.closeAllConnections();await new Promise(r=>server.close(r));console.log('HERITAGE_STATE_RESULT '+report.status);}
})();
