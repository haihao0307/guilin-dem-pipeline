'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),vm=require('vm'),{chromium}=require('playwright');
const fixture=path.resolve('kaopu-material-workbench/candidate-r16'),candidate=path.resolve('kaopu-material-workbench/recovery-candidate'),out='material-anchor-protection-qa';fs.mkdirSync(out,{recursive:true});
const report={startedAt:new Date().toISOString(),passed:false,checks:[],errors:[],stages:[]};
const assert=(v,m)=>{if(!v)throw Error(m)},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function bounded(p,ms=90000){let t;return Promise.race([p,new Promise((_,no)=>t=setTimeout(()=>no(Error('Bounded wait timed out')),ms))]).finally(()=>clearTimeout(t));}
function mark(s){report.stages.push({at:new Date().toISOString(),stage:s});fs.writeFileSync(out+'/progress.json',JSON.stringify(report,null,2));console.log('STAGE',s);}
let server,owner,browser,page;
async function frame(p){return bounded(p.evaluate(async()=>{const a=KAOPU_STUDIO;const bytes=Uint8Array.from(a.pixels());return {hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join(''),distinct:new Set(bytes).size,packet:a.packet(),error:a.glError()};}));}
(async()=>{try{
mark('verify exact R16 fixture and entry diff');
const manifest=JSON.parse(fs.readFileSync(path.join(candidate,'r16-manifest.json')));
for(const [name,sha]of Object.entries(manifest))assert(hash(fs.readFileSync(path.join(fixture,name)))===sha,'R16 fixture changed '+name);
const restored=fs.readFileSync(path.join(candidate,'index.html'),'utf8').replace('<script src="anchor-protection.js"></script>','');
const expected=fs.readFileSync(path.join(fixture,'index.html'),'utf8').replace('href="studio.css"','href="lab-r16/studio.css"').replace('src="defaults.js"','src="lab-r16/defaults.js"').replace('src="studio.js"','src="lab-r16/studio.js"').replace('href="../history/','href="history/');
assert(restored===expected,'Restored root differs beyond protection script');
const guard=fs.readFileSync(path.join(candidate,'anchor-protection.js'),'utf8');
for(const raw of [null,'{"version":16,"original":"自定义"}','{"version":17,"original":"保留原文"}','broken old value']){
 const data=new Map(raw===null?[]:[['KAOPU_MATERIAL_R16',raw]]),writes=[],notes=[];
 const storage={get length(){return data.size},key:i=>Array.from(data.keys())[i],getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{writes.push(k);data.set(k,v)}};
 const c={localStorage:storage,window:{},document:{createElement:()=>({style:{},setAttribute(){}}),body:{prepend:n=>notes.push(n)}},Date};vm.createContext(c);vm.runInContext(guard,c);vm.runInContext(guard,c);
 assert(storage.getItem('KAOPU_MATERIAL_R16')===raw,'Legacy bytes modified');assert(!writes.includes('KAOPU_MATERIAL_R16'),'Old key was written');assert(writes.length===(raw===null?0:1),'Backup repeated or missing');if(raw!==null)assert(Array.from(data.entries()).some(([k,v])=>k.startsWith('KAOPU_MATERIAL_RECOVERY_R16_RAW:')&&v===raw),'Backup not byte exact');
}
report.storageUnit='valid v16, overwritten v17, malformed and absent records preserved; repeated load makes no duplicate';
server=http.createServer((req,res)=>{let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file;
 if(pathname.startsWith('/reference/'))file=path.resolve(fixture,pathname.slice(11)||'index.html');
 else if(pathname.startsWith('/candidate/lab-r16/'))file=path.resolve(fixture,pathname.slice(19));
 else if(pathname.startsWith('/candidate/'))file=path.resolve(candidate,pathname.slice(11)||'index.html');
 else{res.writeHead(404).end();return;}
 if(!file.startsWith(fixture+path.sep)&&!file.startsWith(candidate+path.sep)){res.writeHead(403).end();return;}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'text/javascript':ext==='.html'?'text/html; charset=utf-8':ext==='.css'?'text/css':'text/plain');res.setHeader('Cache-Control','no-store');fs.createReadStream(file).on('error',()=>res.writeHead(404).end()).pipe(res);
});await new Promise(r=>server.listen(4173,'127.0.0.1',r));
mark('real browser four-anchor same-state pixel comparison');
owner=await bounded(chromium.launchServer({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']}),45000);browser=await chromium.connect(owner.wsEndpoint());
const frames={};for(const route of ['reference','candidate']){
 const context=await browser.newContext({viewport:{width:1440,height:960}});page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/'+route+'/?case=volcanic',{timeout:45000});await page.waitForFunction(()=>window.KAOPU_STUDIO?.ready,null,{timeout:90000});
 await bounded(page.evaluate(()=>{KAOPU_STUDIO.stop();KAOPU_STUDIO.setQuality({width:320,samples:1});}));
 for(const id of ['volcanic','analytic','iq','wet']){
  mark(route+' '+id);await bounded(page.evaluate(id=>{KAOPU_STUDIO.select(id,false);KAOPU_STUDIO.stop();KAOPU_STUDIO.draw();},id));const f=await frame(page);assert(f.error===0&&f.distinct>60,'Blank/error '+route+' '+id);
  if(route==='reference')frames[id]=f;else{assert(f.hash===frames[id].hash,'Anchor pixels changed '+id);assert(JSON.stringify(f.packet.uniforms)===JSON.stringify(frames[id].packet.uniforms),'Anchor parameters changed '+id);report.checks.push({id,samePixels:true,sameParameters:true,hash:f.hash});if(['volcanic','iq'].includes(id))await page.screenshot({path:out+'/'+id+'-restored.png',fullPage:true});}
 }
 await context.close();page=null;
}
mark('actual legacy URL redirects without writing old storage');
const context=await browser.newContext({viewport:{width:390,height:844}}),legacy='{"version":17,"states":{"raw":"原数据，不改写"}}';
await context.addInitScript(raw=>{if(location.protocol==='http:'&&localStorage.getItem('KAOPU_MATERIAL_R16')===null)localStorage.setItem('KAOPU_MATERIAL_R16',raw);},legacy);page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://127.0.0.1:4173/candidate/lab-r17/index.html',{timeout:45000});await page.waitForURL('**/anchors-r16.html',{timeout:20000});await page.waitForFunction(()=>window.KAOPU_STUDIO?.ready,null,{timeout:90000});
const legacyState=await page.evaluate(()=>({old:localStorage.getItem('KAOPU_MATERIAL_R16'),backup:localStorage.getItem(KAOPU_ANCHOR_PROTECTION.backupKey),status:KAOPU_ANCHOR_PROTECTION,overflow:document.documentElement.scrollWidth>innerWidth+2,version:KAOPU_STUDIO.version}));
assert(legacyState.old===legacy&&legacyState.backup===legacy,'Legacy original or backup changed');assert(legacyState.status.backedUp&&legacyState.status.needsReview,'Legacy status incorrect');assert(!legacyState.overflow&&legacyState.version===16,'Safe legacy entrance failed');report.legacy=legacyState;await page.screenshot({path:out+'/legacy-390-restored.png',fullPage:true});await context.close();page=null;
assert(report.errors.length===0,'Browser errors');report.passed=true;mark('all focused checks passed');
}catch(e){report.error=e.stack;console.error(e);if(page)try{await page.screenshot({path:out+'/failure.png',timeout:5000,fullPage:true});}catch{}}
finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(out+'/QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)try{await bounded(browser.close(),8000)}catch{};owner?.process()?.kill('SIGKILL');server?.close();process.exit(report.passed?0:1);}})();
