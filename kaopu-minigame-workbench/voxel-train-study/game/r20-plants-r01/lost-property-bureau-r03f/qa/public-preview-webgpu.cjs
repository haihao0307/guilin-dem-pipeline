const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const OUT='bureau-r03f-public-preview-results';
const ENTRY='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03f/';
fs.mkdirSync(OUT,{recursive:true});
const receipt={commit:process.env.GITHUB_SHA,status:'running',backend:'WebGPU API on software SwiftShader; not hardware or phone FPS',frames:[],errors:[],consoleErrors:[],contracts:{}};
const save=()=>fs.writeFileSync(OUT+'/receipt.json',JSON.stringify(receipt,null,2));
const server=http.createServer((req,res)=>{let p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{if(fs.statSync(p).isDirectory())p+='/index.html';res.setHeader('Content-Type',p.endsWith('.html')?'text/html':p.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{
  await new Promise(r=>server.listen(8783,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror',e=>{receipt.errors.push(e.message);save();});
  page.on('console',m=>{if(m.type()==='error'){receipt.consoleErrors.push(m.text());save();}});
  await page.exposeFunction('__qaProgress',event=>{fs.writeFileSync(OUT+'/progress.json',JSON.stringify(event,null,2));if(event.stage!=='render'||event.tiles%32===0||event.tiles===event.total)console.log('BUREAU_PUBLIC_PROGRESS',JSON.stringify(event));});
  const ready=(view,after)=>page.waitForFunction(({view,after})=>{const p=window.__bureau?.proof;return p?.failure||(p?.frames?.length>after&&p.frames.at(-1).view===view&&document.getElementById('scene').getAttribute('aria-busy')==='false');},{view,after},{timeout:1200000});
  const capture=async(name)=>{
    const proof=await page.evaluate(()=>window.__bureau.proof);
    if(proof.failure)throw Error(proof.failure);
    const frame=proof.frames.at(-1);
    if(frame.stats.hit+frame.stats.miss!==frame.width*frame.height||frame.stats.exhausted||frame.stats.glassExhausted||frame.stats.visibilityUnresolved)throw Error('Frame contains unresolved or missing pixels');
    if(frame.publicCounterFinish!==true)throw Error('Latest counter candidate was not enabled');
    const png=await page.evaluate(async()=>{const raw=await window.__bureau.captureRgba();const c=document.createElement('canvas');c.width=raw.width;c.height=raw.height;const ctx=c.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(raw.rgba),raw.width,raw.height),0,0);return c.toDataURL('image/png');});
    fs.writeFileSync(OUT+'/'+name+'.png',Buffer.from(png.split(',')[1],'base64'));
    await page.screenshot({path:OUT+'/'+name+'-ui.png'});
    receipt.frames.push(frame);save();
  };
  try{
    await page.goto('http://127.0.0.1:8783/'+ENTRY+'?qa=1&deferRender=1&view=street&width=240&height=160',{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>typeof window.__bureau?.view==='function'&&document.getElementById('scene').getAttribute('aria-busy')==='false',null,{timeout:480000});
    const before=await page.evaluate(()=>window.__bureau.proof.frames.length);
    if(before!==0)throw Error('Interaction run must defer initial rendering');
    const box=await page.locator('#scene').boundingBox();
    await page.mouse.move(box.x+box.width*.50,box.y+box.height*.50);
    await page.mouse.down();await page.mouse.move(box.x+box.width*.59,box.y+box.height*.53,{steps:8});await page.mouse.up();
    await ready('street',before);await capture('street-rotated-240');
    const rotated=receipt.frames.at(-1).camera;
    receipt.contracts.actualPointerRotation=rotated.eye.some((n,i)=>Math.abs(n-[-87,23,-23][i])>.01);
    await page.mouse.wheel(0,-260);await ready('street',before+1);await capture('street-zoomed-240');
    const zoomed=receipt.frames.at(-1).camera;
    const distance=c=>Math.hypot(...c.eye.map((n,i)=>n-c.target[i]));
    receipt.contracts.actualWheelZoom=distance(zoomed)<distance(rotated)*.9;
    await page.click('[data-view="hall"]');await ready('hall',before+2);await capture('hall-240');
    receipt.contracts.hallButtonCompleted=receipt.frames.at(-1).view==='hall';
    receipt.contracts.allDiagnosticFramesComplete=receipt.frames.length===3&&receipt.frames.every(f=>f.width===240&&f.height===160);
    receipt.contracts.qualityOptions=await page.locator('#quality option').evaluateAll(n=>n.map(x=>x.value).join(',')==='960,720,480');
    await page.click('#save');
    receipt.contracts.actualSaveButton=await page.evaluate(()=>document.getElementById('message').textContent.includes('已保存')&&localStorage.getItem('kaopu.bureau.r03e.custody.v3-network.public-hall-r03f.local-only')===window.__bureau.state());
    receipt.contracts.inventory=await page.evaluate(()=>window.__bureau.testInventory());
    receipt.contracts.noPrematureInventoryDelivery=receipt.contracts.inventory.oneYearPreservesItems;
    receipt.compilation=await page.evaluate(()=>window.__bureau.proof.compilation);
    if(receipt.errors.length||receipt.consoleErrors.length||Object.values(receipt.contracts).some(v=>v===false))throw Error('Public preview interaction contract failed');
    receipt.status='actual-pointer-wheel-hall-browser-pass';receipt.artisticAcceptance=false;save();
  }catch(e){receipt.status='failed';receipt.failure=e.stack;save();await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});process.exitCode=1;}
  finally{await browser.close();server.close();}
})();
