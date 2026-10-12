const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const OUT='bureau-r03e-response-roi-results',ENTRY='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03e/';
const ROI=[384,320,192,192];fs.mkdirSync(OUT,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{if(fs.statSync(p).isDirectory())p+='/index.html';res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.json')?'application/json':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(8783,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
const receipt={commit:process.env.GITHUB_SHA,anchor:'f8d5f94f2d91828b1c839a6a6c6fbaf8357a7b63',status:'running',errors:[],console:[],roi:ROI,fullRayResolution:[960,640],views:[],backend:'WebGPU on CI SwiftShader; no hardware or phone FPS claim',responseScope:[4,14,18],diagnostics:'opaque wood response terms after existing glass attenuation only; zero for non-wood and sky, no repeated glass reflection or fog; stone remains the frozen legacy control' };
const save=()=>fs.writeFileSync(OUT+'/receipt.json',JSON.stringify(receipt,null,2));let page;
const attach=p=>{p.on('pageerror',e=>{receipt.errors.push(e.message);save();});p.on('console',m=>{if(m.type()==='error'){receipt.console.push(m.text());save();}});};
try{
 page=await browser.newPage({viewport:{width:1270,height:800}});attach(page);
 await page.goto('http://127.0.0.1:8783/'+ENTRY+'qa/frame-probe.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__frameProbe?.status==='passed'||window.__frameProbe?.status==='failed',null,{timeout:600000});
 receipt.materialProbe=await page.evaluate(()=>window.__frameProbe);save();
 if(receipt.materialProbe.status!=='passed')throw Error('GPU material-frame covariance probe failed');
 await page.close();page=await browser.newPage({viewport:{width:1270,height:800}});attach(page);
 await page.exposeFunction('__qaProgress',e=>{console.log('ROI_PROGRESS',JSON.stringify(e));fs.writeFileSync(OUT+'/progress.json',JSON.stringify(e));});
 await page.goto('http://127.0.0.1:8783/'+ENTRY+'?qa=1&width=960&height=640&view=window&frameFix=1&response=0&roi='+ROI.join(','),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__bureau?.proof?.ready||window.__bureau?.proof?.failure,null,{timeout:900000});
 let proof=await page.evaluate(()=>window.__bureau.proof);if(proof.failure)throw Error(proof.failure);
 const capture=async(name)=>{const frame=await page.evaluate(()=>window.__bureau.proof.frames.at(-1));await page.screenshot({path:OUT+'/'+name+'.png',clip:{x:ROI[0],y:80+ROI[1],width:ROI[2],height:ROI[3]},timeout:60000});receipt.views.push({name,frame});save();};
 await capture('baseline-beauty');
 await page.evaluate(()=>window.__bureau.debug(9));await capture('baseline-roughness');
 await page.evaluate(()=>window.__bureau.response(1));
 for(const [name,mode] of [['connected-beauty',0],['connected-diffuse',10],['connected-base-specular',11],['connected-coat-specular',12],['connected-roughness',9],['connected-response-channels',13],['connected-cavity',14],['sun-visibility',5],['material-id',1]]){await page.evaluate(m=>window.__bureau.debug(m),mode);await capture(name);}
 receipt.final=await page.evaluate(()=>window.__bureau.proof);receipt.state=await page.evaluate(()=>JSON.parse(window.__bureau.state()));
 receipt.geometrySame=receipt.views.every(x=>['hit','miss','exhausted','retried','maxSteps','glassRays','glassMiss','glassExhausted','visibilityRays','visibilityUnresolved'].every(k=>x.frame.stats[k]===receipt.views[0].frame.stats[k]));
 const failed=receipt.errors.length||receipt.console.length||receipt.final.errors.length||!receipt.geometrySame||receipt.views.some(x=>x.frame.dispatchedPixels!==192*192||x.frame.stats.hit+x.frame.stats.miss!==192*192||x.frame.stats.exhausted||x.frame.stats.glassExhausted||x.frame.stats.visibilityUnresolved);
 receipt.status=failed?'failed':'rendered-for-response-diagnosis';save();if(failed)process.exitCode=1;
}catch(e){receipt.status='failed';receipt.failure=e.stack;if(page)receipt.proof=await page.evaluate(()=>window.__bureau?.proof).catch(()=>null);save();process.exitCode=1;}finally{await browser.close();server.close();}})();
