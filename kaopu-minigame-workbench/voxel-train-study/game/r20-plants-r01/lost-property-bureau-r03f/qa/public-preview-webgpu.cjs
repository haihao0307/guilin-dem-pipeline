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
  const ready=()=>page.waitForFunction(()=>window.__bureau?.proof?.ready||window.__bureau?.proof?.failure,null,{timeout:1200000});
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
    await page.goto('http://127.0.0.1:8783/'+ENTRY+'?qa=1&view=street&width=720&height=480',{waitUntil:'domcontentloaded',timeout:60000});
    await ready();await capture('street-720');
    receipt.contracts.initialViewIsStreet=receipt.frames[0].view==='street';
    receipt.contracts.actualStandardResolution=receipt.frames[0].width===720&&receipt.frames[0].height===480;
    receipt.contracts.qualityOptions=await page.locator('#quality option').evaluateAll(n=>n.map(x=>x.value).join(',')==='960,720,480');
    await page.click('[data-view="hall"]');await ready();await capture('hall-720');
    receipt.contracts.hallButtonCompleted=receipt.frames.at(-1).view==='hall';
    await page.click('#save');
    receipt.contracts.actualSaveButton=await page.evaluate(()=>document.getElementById('message').textContent.includes('已保存')&&localStorage.getItem('kaopu.bureau.r03e.custody.v3-network.public-hall-r03f.local-only')===window.__bureau.state());
    receipt.contracts.inventory=await page.evaluate(()=>window.__bureau.testInventory());
    receipt.contracts.noPrematureInventoryDelivery=receipt.contracts.inventory.oneYearPreservesItems;
    receipt.compilation=await page.evaluate(()=>window.__bureau.proof.compilation);
    if(receipt.errors.length||receipt.consoleErrors.length||Object.values(receipt.contracts).some(v=>v===false))throw Error('Public preview interaction contract failed');
    receipt.status='normal-resolution-and-interaction-pass';receipt.artisticAcceptance=false;save();
  }catch(e){receipt.status='failed';receipt.failure=e.stack;save();await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});process.exitCode=1;}
  finally{await browser.close();server.close();}
})();
