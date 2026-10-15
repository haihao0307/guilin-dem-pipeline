// Focused acceptance after the shadow-receiver-only change. Full earlier QA retained.
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'evidence');fs.mkdirSync(out,{recursive:true});
const report={schema:'hk-shadow-receiver-review/1',commit:process.env.GITHUB_SHA,passed:false,errors:[],failedRequests:[],screenshots:[],note:'Focused final shadow/camera regression; complete source/geometry/function and prior movement checks are separate evidence.'};
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.css':'text/css'};
const server=http.createServer((q,s)=>{let p=path.resolve(root,'.'+decodeURIComponent(q.url.split('?')[0]));if(q.url==='/favicon.ico')return s.writeHead(204).end();if(!p.startsWith(root+path.sep)&&p!==root)return s.writeHead(403).end();if(q.url.split('?')[0].endsWith('/'))p+='/index.html';fs.readFile(p,(e,b)=>{if(e)return s.writeHead(404).end();s.setHeader('Content-Type',mime[path.extname(p)]||'text/plain');s.end(b);});});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{let browser;try{
 await new Promise(r=>server.listen(8197,'127.0.0.1',r));browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));page.on('requestfailed',r=>report.failedRequests.push(r.url()));
 await page.goto('http://127.0.0.1:8197/viewer/',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__KAOPU_TRIAL__?.ready||window.__KAOPU_TRIAL__?.fatalError);if(!await page.evaluate(()=>window.__KAOPU_TRIAL__.ready))throw Error(await page.evaluate(()=>window.__KAOPU_TRIAL__.fatalError));
 async function shot(file){await page.evaluate(()=>window.__KAOPU_TRIAL__.render());await page.screenshot({path:path.join(out,file),fullPage:true});report.screenshots.push({file,sha256:hash(fs.readFileSync(path.join(out,file))),stats:await page.evaluate(()=>window.__KAOPU_TRIAL__.stats())});}
 await shot('FINAL-three-buildings-complete-scene.png');
 for(let i=0;i<3;i++)for(const v of ['whole','mid','near']){await page.evaluate(async({i,v})=>{const a=window.__KAOPU_TRIAL__;await a.selectBuilding(i);a.setView(v);},{i,v});await shot(`FINAL-building-${i+1}-${v}.png`);}
 await page.evaluate(async()=>{const a=window.__KAOPU_TRIAL__;await a.selectBuilding(1);a.setView('near');a.renderer.shadowMap.enabled=false;a.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.needsUpdate=true;});a.render();});await shot('FINAL-building-2-shadow-off-control.png');
 await page.evaluate(async()=>{const a=window.__KAOPU_TRIAL__;a.renderer.shadowMap.enabled=true;a.scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])m.needsUpdate=true;});await a.selectBuilding('all');a.setView('whole');});
 report.cost=await page.evaluate(async()=>{const a=window.__KAOPU_TRIAL__,gl=a.renderer.getContext(),pixel=new Uint8Array(4),samples=[];for(let i=0;i<5;i++){const t=performance.now();a.render();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);if(i)samples.push(performance.now()-t);await new Promise(r=>setTimeout(r,0));}return {method:'draw+finish+synchronous pixel readback wall time',samplesMs:samples,glError:gl.getError(),drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight]};});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await shot('FINAL-mobile-emulated.png');
 report.final=await page.evaluate(()=>window.__KAOPU_TRIAL__.stats());report.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 report.passed=!report.errors.length&&!report.failedRequests.length&&!report.final.errors.length&&!report.overflow&&report.cost.glError===0;
 if(!report.passed)throw Error('Final shadow review runtime gate failed');
}catch(e){report.error=e.stack;process.exitCode=1;}finally{report.finished=new Date().toISOString();fs.writeFileSync(path.join(out,'FINAL_SHADOW_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();await new Promise(r=>server.close(r));}})();
