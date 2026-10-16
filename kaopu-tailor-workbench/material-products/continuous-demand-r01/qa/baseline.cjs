const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8897/MP05-Continuous-Demand-R01/baseline/?look=K04&top=knit-reverse-3&bottom=knit-soft-0');
  await page.waitForFunction(()=>window.__MP05__?.audit().selected&&!__MP05__.audit().pending,{},{timeout:120000});
  const env=await page.evaluate(()=>{const v=__MP05__.debug().viewer,g=v.renderer.getContext(),x=g.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,dpr:devicePixelRatio,glRenderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),version:g.getParameter(g.VERSION),rendererInfo:v.renderer.info.render,viewport:[innerWidth,innerHeight]};});
  console.log('BASELINE READY',JSON.stringify(env));
  const input=await page.evaluate(()=>{const p=__MP05__.debug().physics;return JSON.parse(JSON.stringify({rows:p.inputRows,lock:p.lock,settings:p.settings,actor:p.actor,look:p.look},(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v))});
  fs.writeFileSync(path.join(__dirname,'input.json'),JSON.stringify(input));
  const t=Date.now();await page.evaluate(()=>__MP05__.debug().physics.ensureReference());console.log('LIVE INIT MS',Date.now()-t);
  const steps=[];for(let i=0;i<8;i++){
   const r=await page.evaluate(async()=>{const p=__MP05__.debug().physics.reference,t=performance.now();await p.command('step');return{wallMS:performance.now()-t,audit:p.frame.audit,rows:p.rows.map(r=>({vertices:r.positions.length/3,indices:r.indices.length,audit:r.audit}))};});steps.push(r);console.log('LIVE STEP',i,JSON.stringify({wallMS:r.wallMS,solverMS:r.audit.solverMs,vertices:r.rows.map(r=>r.vertices)}));
  }
  await page.screenshot({path:path.join(__dirname,'baseline-live.png')});
  fs.writeFileSync(path.join(__dirname,'baseline.json'),JSON.stringify({source:'ea04961daab261488023a73d2cb1e1516e2e8fb1',env,steps,errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
