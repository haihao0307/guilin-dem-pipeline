const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const OUT='kowloon-wood-parallax-results',ENTRY='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-station-r03/webgpu-receiver/room-wood-parallax-r01/';
fs.mkdirSync(OUT,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{if(fs.statSync(p).isDirectory())p+='/index.html';res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{
 await new Promise(r=>server.listen(8767,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
 const page=await browser.newPage({viewport:{width:960,height:640}});
 const receipt={commit:process.env.GITHUB_SHA,status:'running',scope:'same-camera timber parallax coordinate restoration only',adapterClass:'software SwiftShader; not device performance',fullProjection:[480,320],nativeCrop:{x:192,y:160,width:96,height:64},errors:[],console:[],frames:[]};
 const save=()=>fs.writeFileSync(OUT+'/receipt.json',JSON.stringify(receipt,null,2));
 page.on('pageerror',e=>{receipt.errors.push(e.message);save();});
 page.on('console',m=>{if(m.type()==='error'){receipt.console.push(m.text());save();}});
 try{
  await page.exposeFunction('__qaProgress',e=>console.log('KAOPU_PROGRESS '+JSON.stringify(e)));
  await page.goto('http://127.0.0.1:8767/'+ENTRY+'?scale=.5&stone=slate&cloth=filtered&audit=replay',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__kaopuWebGPU?.proof?.diagnosticReady||window.__kaopuWebGPU?.proof?.failure,null,{timeout:300000});
  receipt.initial=await page.evaluate(()=>window.__kaopuWebGPU.proof);
  if(receipt.initial.failure)throw Error(receipt.initial.failure);
  const clip={x:384,y:320,width:192,height:128};
  for(const [name,mode,debug] of [['before-lit',0,0],['after-lit',1,0],['before-albedo',0,4],['after-albedo',1,4],['before-normal',0,1],['after-normal',1,1],['material-id',1,3],['fallback-lit',0,0]]){
   await page.evaluate(mode=>window.__kaopuWebGPU.setWoodParallax(mode),mode);
   const frame=await page.evaluate(({debug,region})=>window.__kaopuWebGPU.inspectRegion('wood',debug,region),{debug,region:receipt.nativeCrop});
   receipt.frames.push({name,...frame});
   await page.screenshot({path:OUT+'/'+name+'.png',clip});save();
  }
  receipt.final=await page.evaluate(()=>window.__kaopuWebGPU.proof);
  const same=(a,b)=>fs.readFileSync(OUT+'/'+a+'.png').equals(fs.readFileSync(OUT+'/'+b+'.png'));
  receipt.checks={allPixelsAccounted:receipt.frames.every(f=>f.rayStatus.hit+f.rayStatus.trueMiss+f.rayStatus.exhausted===6144),woodCropAllHits:receipt.frames.every(f=>f.rayStatus.hit===6144),noExhausted:receipt.frames.every(f=>f.rayStatus.exhausted===0&&f.rayStatus.secondaryExhausted===0),noUnresolvedCoverage:receipt.frames.every(f=>f.rayStatus.reserved===0),sameCamera:receipt.frames.every(f=>JSON.stringify(f.frameSnapshot.camera)===JSON.stringify(receipt.frames[0].frameSnapshot.camera)),sameRayStatistics:receipt.frames.every(f=>JSON.stringify(f.rayStatus)===JSON.stringify(receipt.frames[0].rayStatus)),normalsUnchanged:same('before-normal','after-normal'),fallbackPixelExact:same('before-lit','fallback-lit'),eightFrames:receipt.final.frames.length===8};
  receipt.status=receipt.errors.length||receipt.console.length||receipt.final.deviceErrors.length||Object.values(receipt.checks).some(v=>!v)?'failed':'rendered-for-review';
  save();
  // Small crop output, recoverable through authenticated job logs without public
  // photo uploads or third-party storage. Artifacts also retain the same files.
  for(const n of ['before-lit','after-lit','before-albedo','after-albedo','before-normal','after-normal','material-id','fallback-lit'])console.log('KAOPU_IMAGE '+n+' '+fs.readFileSync(OUT+'/'+n+'.png').toString('base64'));
  console.log('KAOPU_RECEIPT '+JSON.stringify(receipt));
  if(receipt.status==='failed')process.exitCode=1;
 }catch(e){receipt.status='failed';receipt.failure=e.stack;receipt.proof=await page.evaluate(()=>window.__kaopuWebGPU?.proof).catch(()=>null);save();console.log('KAOPU_RECEIPT '+JSON.stringify(receipt));process.exitCode=1;}
 finally{await browser.close();server.close();}
})();
