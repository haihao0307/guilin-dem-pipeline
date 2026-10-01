import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),version=process.argv[2]||'R06',label=process.argv[3]||'before',previous=version==='R06',html=path.join(root,previous?'../local-r06/dist/KAOPU_FISH_SPINE_FIN_R06_WORKBENCH.html':'dist/KAOPU_FISH_TAIL_DRIVE_R07_WORKBENCH.html');
const sourceHtmlSha256=crypto.createHash('sha256').update(fs.readFileSync(html)).digest('hex');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1280,height:900},recordVideo:{dir:path.join(root,'evidence'),size:{width:1280,height:900}}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(pathToFileURL(html).href,{waitUntil:'load',timeout:120000});await page.waitForFunction(v=>window['__KAOPU_'+v+'__']?.ready,version,{timeout:120000});
 await page.waitForTimeout(500);
 const samples=[];
 for(const mode of ['CRUISE','TURN_LEFT']){
  await page.evaluate(({version,mode})=>{const {renderer:r,handle:h,instrument:A}=window['__KAOPU_'+version+'__'];r.state.playing=false;r.state.mode=mode;r.state.paths=true;r.camera.setView('top');document.querySelector('[data-motion="'+mode+'"]').click();A.reset(h,mode,r.state);for(let i=0;i<2400;i++)A.update(h,1/60,r.state);},{version,mode});
  for(let phase=0;phase<4;phase++){
   const state=await page.evaluate(({version})=>{const {renderer:r,handle:h,instrument:A}=window['__KAOPU_'+version+'__'];const period=1/(h.state.beatFrequencyHz||h.metadata.motion.modes[r.state.mode].frequency||1);for(let i=0;i<12;i++)A.update(h,period/48,r.state);return {time:h.state.time,body:Array.from(h.state.body.q),worldCenters:Array.from(h.state.worldCenters),finTip:Array.from(h.state.parts[7].q)};},{version});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(root,'evidence',`${label}-${mode}-top-${phase}.png`),fullPage:true});samples.push({mode,phase,...state});
  }
 }
 await page.evaluate(version=>{const {renderer:r,handle:h,instrument:A}=window['__KAOPU_'+version+'__'];r.state.mode='CRUISE';r.camera.setView('perspective');r.state.paths=false;A.reset(h,'CRUISE',r.state);for(let i=0;i<2400;i++)A.update(h,1/60,r.state);r.state.playing=true;},version);
 await page.waitForTimeout(6000);
 const video=page.video();await context.close();await video.saveAs(path.join(root,'evidence',label+'-gait.webm'));
 fs.writeFileSync(path.join(root,'evidence',label+'-GAIT_CAPTURE.json'),JSON.stringify({version,capturedAt:new Date().toISOString(),source:html,sourceHtmlSha256,video:label+'-gait.webm',samples,errors},null,2));console.log(JSON.stringify({version,sourceHtmlSha256,frames:samples.length,video:label+'-gait.webm',errors}));
}finally{await browser.close();}
