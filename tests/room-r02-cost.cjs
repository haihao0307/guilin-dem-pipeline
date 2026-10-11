// Existing-page, response-only QA; no entry file is changed.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const ROOT=process.cwd(),GAME=process.env.ROOM_GAME||'kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01';
const MODULE=GAME+'/room-unit-r02',OUT=path.resolve(process.env.ROOM_OUT||'room-r02-results');fs.mkdirSync(OUT,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceFile=path.join(ROOT,GAME,'app.mjs'),source=fs.readFileSync(sourceFile,'utf8');
const appendix=fs.readFileSync(path.join(ROOT,MODULE,'qa/cost-appendix.mjs'),'utf8')
 .replace('fov,cameraCutaway:cutaway,errors};',"fov,cameraCutaway:cutaway,errors,png:renderer.domElement.toDataURL('image/png')};")
 .replaceAll(',{wetness:.38}', '');
const receipt={host:GAME,commit:process.env.GITHUB_SHA||null,sourceAppSHA256:hash(source),testOnlyResponseAppendix:true,diskEntryModified:false,screenshots:[],pageErrors:[],console:[]};
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.KaoPu':'application/octet-stream','.png':'image/png','.jpg':'image/jpeg','.ogg':'audio/ogg','.wav':'audio/wav'};
const server=http.createServer((req,res)=>{let p;try{p=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400);return res.end();}if(!p.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}try{if(fs.statSync(p).isDirectory())p=path.join(p,'index.html');res.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(res);}catch{res.writeHead(404);res.end();}});
(async()=>{
 let browser;
 try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});
 page.on('pageerror',e=>{receipt.pageErrors.push(String(e));console.log('PAGEERROR',String(e));});
 page.on('console',m=>{if(['error','warning'].includes(m.type())){receipt.console.push({type:m.type(),text:m.text()});console.log('CONSOLE',m.type(),m.text());}});
 await page.route(origin+'/'+GAME+'/app.mjs',route=>route.fulfill({status:200,contentType:'text/javascript',body:source+'\n'+appendix}));
 await page.exposeFunction('__writeRoomCost', sample=>{receipt.costSamples??=[];receipt.costSamples.push(sample);fs.writeFileSync(path.join(OUT,'cost-progress.json'),JSON.stringify(receipt,null,2));console.log('COMPLETED_FRAME_COST',JSON.stringify(sample));});
 await page.goto(origin+'/'+GAME+'/index.html?native-room-qa=1',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__roomCost?.ready||window.__roomCost?.error,null,{timeout:150000});
 const state=await page.evaluate(()=>({ready:window.__roomCost.ready,error:window.__roomCost.error}));console.log('ROOM_READY',JSON.stringify(state));
 if(!state.ready)throw Error(state.error);
 receipt.cost=await page.evaluate(()=>window.__roomCost.probe());
 receipt.sourceAppUnchanged=hash(fs.readFileSync(sourceFile))===receipt.sourceAppSHA256;
 receipt.gpuCompilePassed=receipt.cost.shaderErrors.length===0&&receipt.pageErrors.length===0&&receipt.cost.samples.every(s=>s.glError===0);receipt.interactiveAcceptance=false;
 if(!receipt.sourceAppUnchanged||!receipt.gpuCompilePassed)throw Error('GPU/entry integrity QA failed');
 }catch(e){receipt.failure=String(e.stack||e);process.exitCode=1;console.error(e);}
 finally{fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}
 console.log(JSON.stringify({gpuCompilePassed:receipt.gpuCompilePassed,screenshots:receipt.screenshots.length,failure:receipt.failure||null}));
})();
