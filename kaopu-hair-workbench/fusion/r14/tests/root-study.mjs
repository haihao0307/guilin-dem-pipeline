import{chromium}from'playwright';import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import assert from'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),out=root+'/evidence/root-study';fs.mkdirSync(out,{recursive:true});
const report={success:false,referenceFrozenBuild:'c0816ec8388195bb79b12fc82e11ce2d3fa07d56',referenceInstrumentationOnly:true,checks:[],reference:[],candidate:[],errors:[],environment:{desktop:[1280,1000],softwareGPU:'SwiftShader',realMobileDevice:false},limitations:'Static sampled geometry; fixed top ROI visibility is not biological density or cinematic acceptance.'};
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});console.log(pass?'PASS':'FAIL',name,detail??'');assert(pass,name);}
async function ready(p){await p.waitForFunction('window.lengthGroom && (lengthGroom.diagnostics().ready || lengthGroom.diagnostics().errors.length)',{},{timeout:360000});await p.evaluate('lengthGroom.whenRendered()');assert.equal((await p.evaluate('lengthGroom.diagnostics()')).errors.length,0);}
async function image(p,name){await p.evaluate('lengthGroom.whenRendered()');await p.locator('#canvas').screenshot({path:out+'/'+name+'.png'});}
try{
 for(const [kind,url]of[['reference',process.argv[3]],['candidate',process.argv[2]]]){
  const context=await browser.newContext({viewport:{width:1280,height:1000},deviceScaleFactor:1}),p=await context.newPage();p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await ready(p);
  for(const style of['textured-fringe','side-flow','curtain-layer']){
   if(style!=='textured-fringe')await p.evaluate(s=>lengthGroom.preset(s),style);await ready(p);
   await p.evaluate('lengthGroom.camera("top")');await image(p,kind+'-'+style+'-top');
   const coverage=await p.evaluate('lengthGroom.coverageAudit()'),roots=await p.evaluate('lengthGroom.rootAudit(600)'),collision=await p.evaluate('lengthGroom.audit(300)'),diagnostics=await p.evaluate('lengthGroom.diagnostics()');
   report[kind].push({style,coverage,roots,collision,diagnostics});console.log(kind,style,JSON.stringify({coverage,roots,collision}));
   for(const view of['left','back']){await p.evaluate(v=>lengthGroom.camera(v),view);await image(p,kind+'-'+style+'-'+view);}
  }
  if(kind==='candidate'){
   await p.evaluate('lengthGroom.preset("textured-fringe")');await ready(p);const saved=await p.evaluate('lengthGroom.snapshot()'),initial=await p.evaluate('lengthGroom.diagnostics()');
   await p.evaluate('lengthGroom.camera("left");lengthGroom.setInspection("root-shafts")');await image(p,'candidate-actual-root-shafts-left');const shaft=await p.evaluate('lengthGroom.diagnostics()');
   check('root shaft view draws the actual indexed hair',shaft.inspection==='root-shafts'&&shaft.geometryBytes<initial.geometryBytes&&shaft.curveHash===initial.curveHash,{beforeBytes:initial.geometryBytes,rootShaftBytes:shaft.geometryBytes});
   await p.evaluate('lengthGroom.setInspection("fibers")');check('whole-strand inspection restores original indices',(await p.evaluate('lengthGroom.diagnostics()')).geometryBytes===initial.geometryBytes);
   await p.locator('summary').filter({hasText:'分区长度'}).click();await p.locator('#rootBlendMM').focus();await p.keyboard.press('Home');await p.keyboard.press('Tab');await p.evaluate('lengthGroom.whenRendered()');const collar=await p.evaluate('lengthGroom.diagnostics()');
   check('real root-collar input changes curves not follicles',collar.recipe.rootBlendMM===2&&collar.curveHash!==initial.curveHash&&collar.rootHash===initial.rootHash);
   await p.evaluate(v=>lengthGroom.restore(v),saved);await p.evaluate('lengthGroom.whenRendered()');
   await p.locator('#crownCover').focus();await p.keyboard.press('Home');await p.keyboard.press('Tab');await p.evaluate('lengthGroom.whenRendered()');const cover=await p.evaluate('lengthGroom.diagnostics()');
   check('real crown comb input changes curves not alpha or head',cover.recipe.crownCover===0&&cover.curveHash!==initial.curveHash&&cover.rootHash===initial.rootHash&&cover.modelPositionHash===initial.modelPositionHash&&cover.fiber.opacity===1);
   await p.evaluate(v=>lengthGroom.restore(v),saved);await p.evaluate('lengthGroom.whenRendered()');check('new root and crown parameters roundtrip exactly',(await p.evaluate('lengthGroom.diagnostics()')).curveHash===initial.curveHash);
  }
  await context.close();fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
 }
 for(let i=0;i<3;i++){
  const a=report.reference[i],b=report.candidate[i],ratio=b.coverage.visibleFraction/Math.max(.000001,a.coverage.visibleFraction);b.crownVisibleRatioToReference=ratio;
  check(b.style+' identical follicles, native head, diameter and buffer budget',a.diagnostics.rootHash===b.diagnostics.rootHash&&a.diagnostics.modelPositionHash===b.diagnostics.modelPositionHash&&a.diagnostics.geometryBytes===b.diagnostics.geometryBytes&&a.diagnostics.recipe.width===b.diagnostics.recipe.width);
  check(b.style+' crown exposure reduced by at least 20% in fixed ID pass',b.coverage.bareScalpSamples>1000&&ratio<.8,{before:a.coverage.visibleFraction,after:b.coverage.visibleFraction,ratio});
  check(b.style+' sampled roots are not inside native scalp',b.roots.rootInside===0,b.roots);
  check(b.style+' short-hair reversals do not increase',b.roots.shortReversals<=a.roots.shortReversals,{before:a.roots.shortReversals,after:b.roots.shortReversals,shortSamples:b.roots.shortUnder12MM});
  check(b.style+' sampled native head segments clear',b.collision.crossings===0&&b.collision.minGap>-.0001,b.collision);
 }
 check('no page or shader errors',report.errors.length===0,report.errors);report.success=true;
}catch(e){report.failure=String(e.stack||e);console.error(report.failure);process.exitCode=1;}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
