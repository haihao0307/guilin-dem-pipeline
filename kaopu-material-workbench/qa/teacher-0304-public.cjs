'use strict';
const {chromium}=require('playwright'),fs=require('fs'),crypto=require('crypto');
const root='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/';
const out='material-qa-output';fs.mkdirSync(out,{recursive:true});const assert=(v,m)=>{if(!v)throw Error(m);};
const report={publishedCommit:'bff7aa693855e86b078475313d1fcb3c20f0b43d',url:root,startedAt:new Date().toISOString(),environment:'Official Playwright 1.55.0 Chromium + SwiftShader; desktop/390px viewport, not physical iPhone',checks:[],pageErrors:[],consoleErrors:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function waitPublication(){for(let i=0;i<60;i++){const r=await fetch(root+'?qa='+Date.now()),s=await r.text();if(r.ok&&s.includes('03/04 轻量老师参考')&&s.includes('analytic-r01/viewer.js')&&!s.includes('knotNav'))return;await wait(5000);}throw Error('Expected 03/04 public release has not propagated');}
async function state(p,key){return p.evaluate(k=>window[k].getState(),key);}
async function pixels(p,key){return p.evaluate(async k=>{const bytes=Uint8Array.from(window[k].pixels()),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');const colors=new Set();let min=255,max=0;for(let i=0;i<bytes.length;i+=16){min=Math.min(min,bytes[i]);max=Math.max(max,bytes[i]);colors.add(bytes[i]+','+bytes[i+1]+','+bytes[i+2]);}return {hash,min,max,colors:colors.size};},key);}
async function oldPixels(p){return p.evaluate(async()=>{const bytes=Uint8Array.from(KAOPU10.pixels()),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');return {hash,distinct:new Set(bytes).size,frames:KAOPU10.frames(),glErrors:KAOPU10.glErrors()};});}
(async()=>{let browser;try{await waitPublication();
const manifest=await(await fetch(root+'volcanic-r01/provenance.json')).json();report.frozenR15=[];
for(const [path,expected] of Object.entries(manifest.old_r15_frozen_files)){const r=await fetch(root+path);assert(r.ok,'Frozen file unavailable '+path);const b=Buffer.from(await r.arrayBuffer()),hash=crypto.createHash('sha256').update(b).digest('hex');assert(hash===expected.sha256,'R15 bytes changed '+path);report.frozenR15.push({path,sha256:hash});}
browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
const p=await browser.newPage({viewport});p.on('pageerror',e=>report.pageErrors.push(e.message));p.on('console',m=>{if(m.type()==='error')report.consoleErrors.push(m.text());});
await p.goto(root+'?case=volcanic&v=r15-v03r01',{waitUntil:'load',timeout:90000});await p.waitForFunction(()=>window.KAOPU10?.ready&&window.KAOPU_VOLCANIC?.getState().ready,null,{timeout:90000});
const check={viewport,cases:[]};
for(const c of [{id:'volcanic',key:'KAOPU_VOLCANIC',name:'03 火山岩'},{id:'analytic',key:'KAOPU_ANALYTIC',name:'04 解析石头'}]){
 await p.locator('#'+c.id+'Nav').click();
 // Wait for this case, with the actual key argument.
 await p.waitForFunction(k=>window[k]?.getState().ready,c.key,{timeout:90000});await p.locator('#'+c.id+'Reset').click();await p.waitForTimeout(160);
 const before=await state(p,c.key),original=await pixels(p,c.key);assert(before.width===640&&before.height===360,'Not lightweight default '+c.id);assert(original.colors>100&&original.max-original.min>50,'Blank render '+c.id);assert(await p.locator('#'+c.id+'Workspace').isVisible(),'Case invisible '+c.id);assert(!(await p.locator('#workspace').isVisible()),'R15 workspace overlaps '+c.id);
 await p.screenshot({path:`${out}/${c.id}-${viewport.width}-original.png`,fullPage:true});
 await p.locator('#'+c.id+'Play').click();await p.waitForFunction(k=>window[k].getState().time>.15,c.key,{timeout:30000});await p.locator('#'+c.id+'Play').click();await p.waitForTimeout(100);const rotated=await pixels(p,c.key);assert(rotated.hash!==original.hash,'Rotation did not change pixels '+c.id);
 await p.locator('#'+c.id+'ZoomIn').click();await p.waitForTimeout(100);assert((await state(p,c.key)).zoom>1,'Zoom did not change '+c.id);
 await p.locator('#'+c.id+'Quality').selectOption('480');await p.waitForTimeout(150);assert((await state(p,c.key)).width===480,'480 selection failed '+c.id);await p.locator('#'+c.id+'Quality').selectOption('640');
 const box=await p.locator('#'+c.id+'Canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.6,box.y+box.height*.56,{steps:8});await p.mouse.up();await p.waitForTimeout(120);assert((await state(p,c.key)).orbit.some(v=>v!==0),'Drag did not change camera '+c.id);
 await p.locator('#'+c.id+'Reset').click();await p.waitForTimeout(150);const restored=await pixels(p,c.key);assert(restored.hash===original.hash,'Reset differs from raw baseline '+c.id);await p.screenshot({path:`${out}/${c.id}-${viewport.width}-reset.png`,fullPage:true});
 check.cases.push({id:c.id,default:before,originalPixels:original,rotationChanged:true,zoom:true,drag:true,lowResolution:true,resetMatches:true});
}
for(const id of ['wet','iq']){
 await p.locator('header [data-go="'+id+'"]').click();await p.waitForTimeout(250);assert(await p.locator('#workspace').isVisible(),'Old case hidden '+id);assert(!(await p.locator('#volcanicWorkspace').isVisible())&&!(await p.locator('#analyticWorkspace').isVisible()),'New workspace overlaps '+id);const before=await oldPixels(p);assert(before.distinct>50&&before.frames>0&&before.glErrors.every(x=>x===0),'Old case render failed '+id);
 await p.locator('#rotate').click();await p.waitForTimeout(450);await p.locator('#rotate').click();await p.waitForTimeout(150);const after=await oldPixels(p);assert(before.hash!==after.hash,'Old case rotation stuck '+id);await p.screenshot({path:`${out}/${id}-${viewport.width}-regression.png`,fullPage:true});check.cases.push({id,rendered:true,rotationChanged:true,glErrors:after.glErrors});
}
for(const id of ['volcanic','analytic','volcanic','analytic']){await p.locator('#'+id+'Nav').click();await p.waitForTimeout(100);assert(await p.locator('#'+id+'Workspace').isVisible(),'Repeated nav failed '+id);}
await p.goBack();await p.waitForTimeout(150);assert(await p.locator('#volcanicWorkspace').isVisible(),'Back does not select 03');assert(!(await p.locator('#analyticWorkspace').isVisible()),'Back leaves 04 visible');await p.goForward();await p.waitForTimeout(150);assert(await p.locator('#analyticWorkspace').isVisible(),'Forward does not select 04');assert(!(await p.locator('#volcanicWorkspace').isVisible()),'Forward leaves 03 visible');
assert((await p.locator('#iqMeshCanvas').count())===0,'Substitute mesh introduced');assert((await p.locator('#knotNav').count())===0,'Unfinished 05 placeholder introduced');const overflow=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow,'Horizontal overflow');check.backForward=true;check.noOverflow=true;check.noPlaceholder05=true;report.checks.push(check);await p.close();
}
assert(report.pageErrors.length===0,'Browser page errors');assert(report.consoleErrors.length===0,'Browser console errors');report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;console.error(e);}finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(out+'/QA.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(browser)await browser.close();if(!report.passed)process.exitCode=1;}})();
