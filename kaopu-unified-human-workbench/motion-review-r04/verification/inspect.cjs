const fs=require('node:fs'),path=require('node:path');

const ROOT=path.resolve(__dirname,'../../..');
let playwright;try{playwright=require(path.join(ROOT,'tooling/node_modules/playwright'));}catch{playwright=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}const {chromium}=playwright;
const out=path.join(ROOT,'qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,...((process.env.CHROME_PATH||fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe'))?{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{}),args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
 const page=await browser.newPage({viewport:{width:1280,height:920},deviceScaleFactor:1});
 page.on('pageerror',e=>console.log('ERROR',e.message));
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,600));});
 page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()?.errorText));
 await page.route('https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/**',async route=>{
  const u=new URL(route.request().url()),p=u.pathname.split('/').slice(4).join('/'),local=path.join(ROOT,p);
  if(fs.existsSync(local)&&fs.statSync(local).isFile())return route.fulfill({body:fs.readFileSync(local),contentType:/\.m?js$/.test(p)?'text/javascript':/\.json$/.test(p)?'application/json':'application/octet-stream',headers:{'access-control-allow-origin':'*'}});
  console.log('REMOTE',p);await route.continue();
 });
 const started=Date.now();await page.goto('http://127.0.0.1:8894/#walk-loop',{waitUntil:'domcontentloaded'});
 for(let i=0;i<100;i++){
  const state=await page.evaluate(()=>({ready:window.motionReview?.ready,busy:window.motionReview?.busy,error:window.motionReviewError,errors:window.motionReview?.errors,status:document.getElementById('mr-status')?.textContent,load:document.getElementById('load-status')?.textContent}));
  if(i%5===0)console.log(JSON.stringify(state));
  if(state.error||state.errors?.length)throw Error(JSON.stringify(state));
  if(state.ready&&!state.busy)break;
  await page.waitForTimeout(1000);
 }
 const data=await page.evaluate(()=>{const r=window.motionReview;if(!r?.ready)throw Error('Not ready');r.play(false);r.blend=false;r.seek(.4);r.view('three');return r.report();});
 console.log('READY',Date.now()-started,'ms',data.sourceLocalOffsetErrorM,data.binding);
 fs.writeFileSync(path.join(out,'baseline-report.json'),JSON.stringify(data,null,2));
 await page.screenshot({path:path.join(out,'baseline-walk.png')});
 const diagnostic=await page.evaluate(()=>{const r=motionReview,b=r.binding;return{rig:b.rig,positions:Array.from(b.positions),range:Array.from(b.range),packed:Array.from(b.packed),floorOffset:b.floorOffset,height:b.height,faces:Array.from(b.faces),displayRange:Array.from(b.displayRange),displayPacked:Array.from(b.displayPacked),displayPosition:Array.from(b.geometry.attributes.position.array),displayNormals:Array.from(b.geometry.attributes.normal.array),clip:r.clip.frames.map(f=>({q:Array.from(f.q),p:Array.from(f.p)}))};});
 const zlib=require('node:zlib');fs.writeFileSync(path.join(out,'native-fixture.json.gz'),zlib.gzipSync(JSON.stringify(diagnostic)));
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
