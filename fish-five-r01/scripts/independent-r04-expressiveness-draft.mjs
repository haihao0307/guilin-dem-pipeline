import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Draft collection only. No browser is launched without all freeze arguments
// and explicit --execute. This script intentionally cannot issue final PASS.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const ids=['barracuda','herring','tuna-yellow-label','tuna-blue-label','colorful','picasso'];
const report={schema:'fish.independent-r04-draft/1',createdAt:new Date().toISOString(),status:'DRAFT_ONLY',visualAcceptance:false,productionReady:false,requiredFinalGates:['source-and-eye-shape-retention','source-jaw-provenance','mouth-actual-GPU-edge-area-Jacobian-normal','eye-visible-head-closeup-vs-R03','pause-and-REST','30-independent-expressions','R03-runtime-lifecycle-and-motion-regressions','published-actual-browser'],rows:[],errors:[]};
if(!process.argv.includes('--execute')){
 fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R04_DRAFT_STATUS.json'),JSON.stringify(report,null,2)+'\n');
 console.log('DRAFT_ONLY: no browser launched; awaiting final R04 freeze.');
 process.exit(0);
}
for(const key of ['html','expected-html','source-head'])if(!arg(key))throw Error('Final freeze argument required: '+key);
const html=path.resolve(arg('html')),expected=arg('expected-html');
if(hash(fs.readFileSync(html))!==expected)throw Error('Frozen R04 HTML mismatch');
if(!/^[a-f0-9]{40}$/.test(arg('source-head')))throw Error('Invalid production source head');
report.testedHtmlSha256=expected;report.productionSourceHead=arg('source-head');
report.status='PARTIAL_COLLECTION_NOT_AN_ACCEPTANCE_VERDICT';
const {chromium}=createRequire(import.meta.url)('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}});
 page.on('pageerror',e=>report.errors.push(String(e)));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(pathToFileURL(html).href,{timeout:120000});
 await page.waitForFunction(()=>__FIVE_FISH__?.ready,null,{timeout:120000});
 for(const id of ids){
  await page.evaluate(id=>__FIVE_FISH__.select(id),id);
  await page.evaluate(()=>__FIVE_FISH__.setGroup(false));
  for(const mode of ['rest','cruise']){
   await page.evaluate(mode=>{__FIVE_FISH__.state.playing=true;__FIVE_FISH__.setMode(mode);},mode);
   const rows=await page.evaluate(async()=>{
    const A=__FIVE_FISH__,result=[],start=performance.now();
    function take(){
     if(A.state.selected==='barracuda'){
      const r=A.barracuda.api.renderer,active=r.state.school?r.actors:[r.actors[r.state.selected]];
      return active.map(h=>({yaw:h.state.eyeYaw,pitch:h.state.eyePitch,pupil:h.state.pupil,jaw:h.state.jaw,time:h.state.time}));
     }
     return A.behavior.actors.map(a=>({leftYaw:a.eyes?.leftYaw,rightYaw:a.eyes?.rightYaw,pitch:a.eyes?.pitch,pupil:a.eyes?.pupil??null,jaw:a.jaw?.angle??a.jawAngle??a.mouth?.angle??null,time:A.behavior.time,renderedGaze:A.eyes?.[a.index??0]?.objects?.map(e=>[e.gaze.rotation.x,e.gaze.rotation.y])??null}));
    }
    await new Promise(resolve=>{function frame(t){result.push({t,actors:take()});if(t-start<12000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
    return result;
   });
   report.rows.push({id,mode,count:1,frames:rows});
   await page.screenshot({path:path.join(root,'evidence',`independent-r04-draft-${id}-${mode}.png`)});
  }
  await page.evaluate(()=>{__FIVE_FISH__.state.playing=false;});
  const paused=await page.evaluate(async()=>{const A=__FIVE_FISH__,snapshot=()=>A.state.selected==='barracuda'?A.barracuda.api.renderer.actors.map(h=>[h.state.time,h.state.eyeYaw,h.state.eyePitch,h.state.pupil,h.state.jaw]):A.behavior.actors.map(a=>[A.behavior.time,a.eyes?.leftYaw,a.eyes?.rightYaw,a.eyes?.pitch,a.jaw?.angle??a.jawAngle??a.mouth?.angle??null]);const before=snapshot();await new Promise(r=>setTimeout(r,400));return {before,after:snapshot()};});
  report.rows.push({id,paused,pauseValuesEqual:JSON.stringify(paused.before)===JSON.stringify(paused.after)});
  await page.evaluate(()=>{__FIVE_FISH__.state.playing=true;return __FIVE_FISH__.setGroup(true);});
  await page.waitForTimeout(1500);
  const group=await page.evaluate(()=>{const A=__FIVE_FISH__;return A.state.selected==='barracuda'?A.barracuda.api.renderer.actors.map(h=>({yaw:h.state.eyeYaw,pitch:h.state.eyePitch,jaw:h.state.jaw})):A.behavior.actors.map(a=>({yaw:a.eyes?.leftYaw,pitch:a.eyes?.pitch,jaw:a.jaw?.angle??a.jawAngle??a.mouth?.angle??null}));});
  report.rows.push({id,count:group.length,group,unknownMouthControl:group.some(a=>a.jaw===null||a.jaw===undefined)});
 }
}catch(e){report.errors.push(String(e.stack||e));}
finally{
 await browser.close();report.artifactUnchangedDuringRun=hash(fs.readFileSync(html))===expected;
 fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_R04_DRAFT_COLLECTION.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({status:report.status,rows:report.rows.length,errors:report.errors}));
