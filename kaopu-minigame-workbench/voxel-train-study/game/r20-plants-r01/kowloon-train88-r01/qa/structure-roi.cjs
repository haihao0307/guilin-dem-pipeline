// Real retained FH88 renderer/state, one complete perspective frame and bounded native-pixel structural inspection.
// Neither crops nor the diagnostic shadow resolution are a game-quality pass.
const{chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const out='train88-kowloon-structure-roi-results';fs.mkdirSync(out,{recursive:true});
const report={commit:process.env.GITHUB_SHA,status:'running',viewport:[640,426],shadowDiagnostic:[96,64],scope:'complete restored function station in the real FH88 host, actual perspective camera; diagnostic sun resolution disclosed',errors:[],views:[]};
const save=()=>fs.writeFileSync(out+'/receipt.json',JSON.stringify(report,null,2));
const server=http.createServer((req,res)=>{const p=path.resolve('.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(process.cwd()+path.sep))return res.writeHead(403).end();try{res.setHeader('content-type',p.endsWith('.html')?'text/html':p.endsWith('.css')?'text/css':p.endsWith('.json')?'application/json':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.png')?'image/png':p.endsWith('.jpg')?'image/jpeg':p.endsWith('.woff2')?'font/woff2':'text/javascript');res.end(fs.readFileSync(p));}catch{res.writeHead(404).end();}});
(async()=>{let browser;await new Promise(r=>server.listen(8784,'127.0.0.1',r));try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-gpu-watchdog','--enable-unsafe-webgpu','--use-angle=swiftshader','--use-vulkan=swiftshader','--enable-features=Vulkan','--disable-vulkan-surface']});
 const page=await browser.newPage({viewport:{width:640,height:426}});page.setDefaultTimeout(900000);
 page.on('pageerror',e=>{report.errors.push(e.message);save();});page.on('console',m=>{if(m.type()==='error'){report.errors.push(m.text());save();}if(m.text().includes('KOWLOON_STAGE'))console.log(m.text());});
 const q=new URLSearchParams({bridgeQA:'1',bridgeWidth:'640',bridgeHeight:'426',bridgeView:'station',bridgeStartTicks:'240'});
 await page.goto('http://127.0.0.1:8784/kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/kowloon-train88-r01/index.html?'+q,{waitUntil:'domcontentloaded',timeout:900000});await page.waitForFunction(()=>window.__trainDriver?.ready);
 await page.addStyleTag({content:'#driverGame>*:not(#sceneWrap){visibility:hidden!important}#sceneWrap>*:not(canvas){visibility:hidden!important}'});
 const full=await page.evaluate(()=>window.__trainDriver.getState());report.full=full;save();
 await page.screenshot({path:out+'/complete-station-perspective-640x426.png',timeout:180000});
 const projection=full.kowloonFunction.shared.projection;if(projection[11]!==-1||projection[15]!==0)throw Error('Display camera is not a normal perspective projection');
 if(!full.kowloonFunction.complete||full.kowloonFunction.unresolved)throw Error('Incomplete full perspective station frame');
 const origin=await page.evaluate(()=>window.__trainDriver.getState().kowloonFunction.shared.state.origin);
 const world=([x,y,z])=>[origin[0]-z,origin[1]+y,origin[2]+x];
 for(const item of[
  {name:'portico-bearing-and-capital',crop:{x:256,y:21,w:128,h:384},eye:[-43.7,5.8,6.45],target:[-30.9,5.8,6.45]},
  {name:'cast-column-neck-branches-and-lamp',crop:{x:256,y:100,w:128,h:226},eye:[-25,7.4,-16],target:[-30,7.4,-17.5]}
 ]){
  const started=Date.now(),state=await page.evaluate(({crop,eye,target})=>window.__stationBridgeQA.roi(crop,eye,target),{crop:item.crop,eye:world(item.eye),target:world(item.target)});
  const receipt={...item,state,wallMilliseconds:Date.now()-started};report.views.push(receipt);save();
  await page.screenshot({path:out+'/'+item.name+'.png',clip:{x:item.crop.x,y:item.crop.y,width:item.crop.w,height:item.crop.h},timeout:180000});
  if(!state.kowloonFunction.complete||state.kowloonFunction.unresolved)throw Error('Incomplete structural crop '+item.name);
 }
 report.status=report.errors.length?'failed':'complete-perspective-and-structural-crops-rendered-awaiting-visual-review';if(report.errors.length)process.exitCode=1;save();
}catch(e){report.status='failed';report.failure=e.stack;save();process.exitCode=1;}finally{await browser?.close();server.close();}})();
