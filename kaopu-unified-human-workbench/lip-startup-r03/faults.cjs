const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const build=JSON.parse(fs.readFileSync(__dirname+'/SITE.json')),out=process.env.PERF_OUT||'lip-p3-evidence',isPublic=process.env.P3_PUBLIC==='1',base=build.siteURL;
const file=build.transport.files.find(f=>f.chunks.length>=5),target=new URL(file.chunks[3].file,base).href;
const modes=['stream-break','idle-stall','exhausted-then-resume','pause-then-resume','cache-denied'];if(process.env.P3_SKIP_SLOW!=='1')modes.push('slow-continuous-160s');
(async()=>{const report={scope:isPublic?'Published HTTPS bytes with controlled browser fetch/stream faults; not a user-network benchmark':'Candidate bytes served by browser routes with controlled streaming; not public-network measurements',cases:[]};const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{for(const mode of modes){const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage();page.setDefaultTimeout(240000);const row={mode};console.log('FAULT START',mode);
 await page.route('**/*',async route=>{const u=route.request().url();if(/^https:\/\/(raw\.githubusercontent\.com|htmlpreview\.github\.io)\//.test(u))return route.abort();if(!isPublic&&u.startsWith(base)){const rel=decodeURIComponent(u.slice(base.length).split('?')[0])||'index.html',root=path.resolve(__dirname,'site'),p=path.resolve(root,rel);if(!p.startsWith(root+path.sep)||!fs.existsSync(p))return route.fulfill({status:404,body:'Missing fixture'});return route.fulfill({status:200,contentType:({'.html':'text/html','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(p)]||'application/octet-stream',body:fs.readFileSync(p)});}return route.continue();});
 await page.addInitScript(({mode,target})=>{
  const raw=window.fetch.bind(window),S=window.__P3_INJECT__={calls:[],injected:0};const healed=sessionStorage.getItem('p3-test-healed')==='1';
  if(mode==='cache-denied')Object.defineProperty(window,'caches',{get(){throw new DOMException('Injected storage denial','SecurityError');}});
  window.fetch=async(input,options={})=>{const u=String(input);S.calls.push(u);if(u!==target||healed||mode==='cache-denied')return raw(input,options);
   if(['stream-break','idle-stall'].includes(mode)&&S.injected>0)return raw(input,options);S.injected++;
   if(mode==='idle-stall'||mode==='pause-then-resume')return new Response(new ReadableStream({start(c){options.signal.addEventListener('abort',()=>c.error(options.signal.reason),{once:true});}}));
   const r=await raw(input,options),data=new Uint8Array(await r.arrayBuffer());
   if(mode==='stream-break'||mode==='exhausted-then-resume'){let stage=0;return new Response(new ReadableStream({pull(c){if(stage++===0)c.enqueue(data.slice(0,65536));else c.error(new TypeError('Injected response body interrupted after headers'));}}));}
   if(mode==='slow-continuous-160s'){let offset=0,timer;const step=Math.ceil(data.length/160);return new Response(new ReadableStream({start(c){timer=setInterval(()=>{const end=Math.min(data.length,offset+step);c.enqueue(data.slice(offset,end));offset=end;if(offset===data.length){clearInterval(timer);c.close();}},1000);options.signal.addEventListener('abort',()=>{clearInterval(timer);c.error(options.signal.reason);},{once:true});},cancel(){clearInterval(timer);}}));}
   return r;
  };
 },{mode,target});
 const began=Date.now();try{
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:240000});
  if(mode==='pause-then-resume'){
   await page.waitForFunction(()=>window.__P3_INJECT__?.injected>0&&window.__LIP_P3__?.transport.stats.verifiedBytes>0);await page.click('#lipP3Status [data-pause]');assert(await page.evaluate(()=>__LIP_P3__.paused));row.before=await page.evaluate(()=>__LIP_P3__.snapshot());
   row.savedKeys=await page.evaluate(async()=>Array.from(await(await caches.open('kaopu-lips-verified-chunks-p3')).keys()).map(r=>r.url.split('/').pop()));await page.evaluate(()=>sessionStorage.setItem('p3-test-healed','1'));await page.click('#lipP3Status [data-resume]');
  }else if(mode==='exhausted-then-resume'){
   await page.waitForFunction(()=>window.__LIP_P3__?.errors.length>0);row.before=await page.evaluate(()=>__LIP_P3__.snapshot());assert(row.before.errors[0].includes(file.label));assert.equal(await page.evaluate(()=>__P3_INJECT__.injected),3);assert(await page.locator('#lipP3Status [data-resume]').isVisible());
   row.savedKeys=await page.evaluate(async()=>Array.from(await(await caches.open('kaopu-lips-verified-chunks-p3')).keys()).map(r=>r.url.split('/').pop()));await page.evaluate(()=>sessionStorage.setItem('p3-test-healed','1'));await page.click('#lipP3Status [data-resume]');
  }
  await page.waitForFunction(()=>window.__LIP_P3__?.ready);row.after=await page.evaluate(()=>({state:__LIP_P3__.snapshot(),injection:__P3_INJECT__}));assert.equal(row.after.state.errors.length,0);assert.equal(row.after.state.transport.verifiedBytes,row.after.state.transport.totalBytes);
  if(['stream-break','idle-stall'].includes(mode)){assert.equal(row.after.injection.injected,1);assert(row.after.state.transport.retries>=1);}
  if(mode.endsWith('then-resume')){assert(row.savedKeys.length>0);assert(row.after.state.transport.cacheBytes>0);const fetches=row.after.injection.calls;assert(row.savedKeys.every(hash=>!fetches.some(u=>u.endsWith('/'+hash+'.bin'))),'Previously completed chunks must not be fetched again');}
  if(mode==='cache-denied')assert(row.after.state.transport.warnings.length>0);
  if(mode==='slow-continuous-160s'){assert(Date.now()-began>150000);assert.equal(row.after.state.transport.retries,0);assert.equal(row.after.injection.injected,1);}
  assert(row.after.state.transport.maximumActive<=3);row.passed=true;
 }catch(e){row.passed=false;row.error=String(e);row.body=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:path.join(out,(isPublic?'public':'candidate')+'-'+mode+'-failed.png')}).catch(()=>{});}
 row.elapsedMS=Date.now()-began;report.cases.push(row);console.log(JSON.stringify({mode,passed:row.passed,elapsedMS:row.elapsedMS,error:row.error}));await ctx.close();}
}finally{await browser.close();report.passed=report.cases.length===modes.length&&report.cases.every(r=>r.passed);fs.writeFileSync(path.join(out,(isPublic?'public':'candidate')+'-faults.json'),JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;}
})();
