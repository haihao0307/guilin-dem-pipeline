const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium,webkit}=require('playwright');
const engine=process.env.OVERVIEW_BROWSER||'chromium',base=process.env.OVERVIEW_URL||'http://127.0.0.1:8765/kaopu-human-overview/',out=process.env.OVERVIEW_QA_DIR||'ui-evidence';fs.mkdirSync(out,{recursive:true});
const sizes=[{name:'wide',width:2048,height:1040},{name:'desktop',width:1440,height:900},{name:'phone',width:390,height:844},{name:'landscape',width:844,height:390}];
const cases=[{name:'anny',path:'../kaopu-anny-workbench/r02/',api:'annyWorkbench',control:'#p-weight',stage:'#stage',view:'[data-view="front"]'},{name:'face',path:'../kaopu-face-workbench/?release=r02-41d46766#edit',api:'faceWorkbench',control:'#coefficient',stage:'#stage',view:'[data-view="front"]'},{name:'mhr',path:'../kaopu-mhr-workbench/',api:'mhrWorkbench',control:'#sliders input[type=range]',stage:'#viewport',view:'[data-view="front"]'},{name:'common',path:'../kaopu-unified-human-workbench/',api:'unifiedWorkbench',control:'#weight',stage:'#stage',view:'[data-view="front"]'},{name:'skin',path:'../kaopu-skin-workbench/',api:'unifiedWorkbench',control:'#skin-tone',stage:'#stage',view:'[data-view="face"]'}];
if(process.env.OVERVIEW_UI_LEGACY==='true'){cases.splice(0,cases.length,{name:'anny-legacy',path:'../kaopu-anny-workbench/',api:'annyWorkbench',control:'#p-weight',stage:'#stage',view:'[data-view="front"]'},{name:'face-legacy',path:'../kaopu-face-workbench/r01.html#edit',api:'faceWorkbench',control:'#coefficient',stage:'#stage',view:'[data-view="front"]'},{name:'hair-r9-header',path:'../kaopu-hair-workbench/qa/gnm-groom-editor/experiment.html',api:'groomStudy',control:'#hairLength',stage:'#stage',view:'[data-view="front"]'});sizes.splice(0,1);sizes.splice(2,1);}
let browser,ctx,page;const report={engine,base,sizes,rows:[],warnings:[],errors:[],passed:false,physicalPhone:false,rendererMathChanged:false};
function save(){fs.writeFileSync(`${out}/ui-layout-${engine}.json`,JSON.stringify(report,null,2))}
(async()=>{
 browser=await({chromium,webkit})[engine].launch(engine==='webkit'?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});ctx=await browser.newContext({viewport:sizes[0],hasTouch:true});page=await ctx.newPage();await ctx.tracing.start({screenshots:true,snapshots:true,sources:true});
 page.on('pageerror',e=>report.warnings.push({type:'pageerror',url:page.url(),message:e.message}));page.on('crash',()=>report.errors.push({type:'crash',url:page.url()}));page.on('requestfailed',r=>report.warnings.push({type:'requestfailed',url:r.url(),error:r.failure()?.errorText}));
 for(const c of cases){
  console.log('UI_START',engine,c.name);await page.setViewportSize(sizes[0]);await page.goto(new URL(c.path,base).href,{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(c=>{const api=window[c.api],d=api?.diagnostics?.();return d?.ready&&!d.lost&&!d.busy&&(c.name!=='mhr'||window.__MHR__?.ready&&window.__MHR__.result?.id===d.revision)},c,{timeout:180000});
  if(c.name.startsWith('face'))await page.locator('#parameters').evaluate(e=>e.closest('details').open=true);
  for(const size of sizes){
   await page.setViewportSize(size);await page.waitForTimeout(150);await page.locator(c.view).first().click();await page.waitForTimeout(150);
   const control=page.locator(c.control).first();await control.scrollIntoViewIfNeeded();await control.focus();
   const before=await control.inputValue();const direction=await control.evaluate(e=>Number(e.value)+(Number(e.step)||1)<=Number(e.max)?'ArrowRight':'ArrowLeft');await control.press(direction);await page.waitForTimeout(200);const after=await control.inputValue();assert.notEqual(before,after,c.name+' real control change');
   await page.waitForFunction(c=>{const d=window[c.api]?.diagnostics();return d?.ready&&!d.busy&&(c.name!=='mhr'||window.__MHR__.result?.id===d.revision)},c,{timeout:30000});
   const proof=await page.evaluate(({c,size})=>{
    const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right}};
    const api=window[c.api],pixels=api.pixelAudit?.();const selected=document.querySelector(c.control);let checksum=null;const pos=api.positions?.();if(pos){let sum=0,sq=0;for(let i=0;i<pos.length;i++){sum+=pos[i];sq+=pos[i]*pos[i]}checksum={count:pos.length,sum,sq};}
    return{stage:box(c.stage),workspace:box('.wb-workspace'),panel:box('.wb-controls'),scroll:box('.wb-controls-scroll'),control:box(c.control),header:box('.wb-header'),bodyScroll:document.documentElement.scrollHeight,bodyWidth:document.documentElement.scrollWidth,scrollY,viewport:{width:innerWidth,height:innerHeight},controlFont:getComputedStyle(selected).fontSize,diagnostics:api.diagnostics(),pixels,checksum,controlValue:selected.value,expanded:document.querySelector('[data-wb-toggle]')?.getAttribute('aria-expanded')};
   },{c,size});
   assert(proof.stage.width>200&&proof.stage.height>140,`${c.name}/${size.name} useful stage`);assert(proof.stage.y>=0&&proof.stage.bottom<=size.height+1,`${c.name}/${size.name} stage visible`);assert(proof.control.y>=proof.scroll.y-1&&proof.control.bottom<=proof.scroll.bottom+1,`${c.name}/${size.name} control independently visible`);assert(proof.panel.bottom<=size.height+1,`${c.name}/${size.name} panel visible`);assert(proof.bodyWidth<=size.width,`${c.name}/${size.name} horizontal overflow`);assert.equal(proof.scrollY,0,`${c.name}/${size.name} outer page scrolled`);assert(parseFloat(proof.controlFont)>=14);assert(proof.control.height>=44-1);if(proof.pixels){assert(proof.pixels.colors>20);assert.equal(proof.pixels.error,0)}
   if(size.width>=960)assert(proof.stage.width>size.width*.6,`${c.name} full-width canvas`);
   if(size.name==='landscape')assert(proof.panel.x>proof.stage.x+proof.stage.width-2,`${c.name} landscape side-by-side`);
   const row={name:c.name,size:size.name,before,after,...proof};report.rows.push(row);save();await page.screenshot({path:`${out}/${c.name}-${size.name}-${engine}.png`});
   if(size.name==='phone'){
    await page.locator('[data-wb-toggle]').click();await page.waitForTimeout(100);const collapsed=await page.locator(c.stage).boundingBox();assert(collapsed.height>proof.stage.height+80,c.name+' collapsed sheet expands stage');assert.equal(await page.locator('[data-wb-toggle]').getAttribute('aria-expanded'),'false');await page.screenshot({path:`${out}/${c.name}-phone-collapsed-${engine}.png`});await page.locator('[data-wb-toggle]').click();
   }
   await control.press(direction==='ArrowRight'?'ArrowLeft':'ArrowRight');
  }
  await page.locator('[data-wb-back]').click();await page.waitForURL(base,{waitUntil:'domcontentloaded'});assert.equal(ctx.pages().length,1);await page.goBack({waitUntil:'domcontentloaded'});await page.waitForFunction(api=>window[api]?.diagnostics?.().ready,c.api,{timeout:180000});await page.locator('[data-wb-back]').click();await page.waitForURL(base,{waitUntil:'domcontentloaded'});console.log('UI_PASS',engine,c.name);
 }
 report.passed=true;report.version=browser.version();save();await ctx.tracing.stop({path:`${out}/ui-layout-trace-${engine}.zip`});await browser.close();
})().catch(async e=>{report.errors.push({message:e.stack||String(e),url:page?.url()});save();console.error(e);try{await page?.screenshot({path:`${out}/ui-failure-${engine}.png`,timeout:5000});await ctx?.tracing.stop({path:`${out}/ui-layout-trace-${engine}.zip`});}catch{}await browser?.close();process.exit(1)});
