// The user's current R05 entry and GNM-only identity picker must remain native.
const fs=require('fs'),assert=require('assert/strict'),{chromium}=require('playwright');
const commit=process.env.PUBLIC_COMMIT,dir='qa-face-et12/native-'+(commit?'public':'source');fs.mkdirSync(dir,{recursive:true});
const url=commit?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+commit+'/kaopu-unified-human-workbench/face-transfer/preview.html':'http://127.0.0.1:8765/kaopu-unified-human-workbench/face-transfer/preview.html';
const report={schema:'kaopu/current-native-face-composition@1',native:'0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe',commit,url,checks:[],faces:[],actions:[],errors:[],realMobileDeviceTested:false};let b,p;
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
(async()=>{
 b=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await b.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.fullFaceTransfer?.report()?.face&&window.fullCommonWorkbench?.diagnostics().ready&&!fullCommonWorkbench.diagnostics().busy,null,{timeout:300000});await p.evaluate(()=>fullFaceTransfer.ready());
 check('current R05 picker, not the old comparison tabs',await p.locator('[data-preset]').count()===36&&await p.locator('[data-collection]').count()===0);
 check('four native face choices and eight original action entries',await p.locator('[data-face-identity]').count()===4&&await p.locator('[data-entry-action]').count()===8);
 await p.evaluate(()=>{window.__NHASH__=a=>{let h=2166136261;for(const x of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^x,16777619);return(h>>>0).toString(16);};window.__NBODY__=()=>{const s=fullCommonWorkbench.state();return{phenotypes:s.anny.phenotypes,pose:s.anny.pose,translations:s.anny.translations,mhr:s.mhr,expression:s.gnm.expression,owners:s.owners};};});
 const beforeBody=await p.evaluate(()=>JSON.stringify(__NBODY__())),fields=await p.evaluate(()=>JSON.stringify(fullFaceTransfer.fieldArrays())),saved=await p.evaluate(()=>fullCommonWorkbench.archive());
 for(const id of['neutral','long_narrow','short_broad','square_jaw']){
  await p.click('[data-face-identity="'+id+'"]');await p.waitForFunction(()=>document.getElementById('workbench-entries').getAttribute('aria-busy')==='false');
  const r=await p.evaluate(()=>{const q=fullCommonWorkbench.positions(),B=fullCommonWorkbench.diagnostics().bodyVertices,original=eyeTransferredHuman.nativePositions();let bodyDelta=0;for(let i=0;i<B*3;i++)bodyDelta=Math.max(bodyDelta,Math.abs(q[i]-original[i]));return{hash:__NHASH__(q),bodyDelta,finite:q.every(Number.isFinite),body:JSON.stringify(__NBODY__()),fields:JSON.stringify(fullFaceTransfer.fieldArrays()),face:fullFaceTransfer.capture().face,skin:fullFaceTransfer.capture().skinSettings};});
  const stableFields=r.fields===fields;delete r.fields;report.faces.push({id,stableFields,...r});
  check(id+' current native identity really drives composed head',r.finite&&r.body===beforeBody&&r.bodyDelta===0&&r.face.enabled&&r.face.affectedNativeVertices>0&&stableFields,{finite:r.finite,bodyDelta:r.bodyDelta,affected:r.face.affectedNativeVertices});
  check(id+' native selection button remains selected',await p.locator('[data-face-identity="'+id+'"]').getAttribute('aria-pressed')==='true');
  await p.screenshot({path:dir+'/face-'+id+'.png'});
 }
 check('four actual generated heads stay distinct',new Set(report.faces.map(x=>x.hash)).size===4);
 const previous=await p.evaluate(()=>__NHASH__(fullCommonWorkbench.positions()));await p.evaluate(()=>fullCommonWorkbench.selectFaceIdentity('long_narrow'));await p.evaluate(()=>fullCommonWorkbench.setSkin({tone:.38}));
 await p.click('#undo-face-identity');await p.waitForFunction(()=>document.getElementById('workbench-entries').getAttribute('aria-busy')==='false');
 check('native face undo preserves current skin and transferred layers',await p.evaluate(h=>__NHASH__(fullCommonWorkbench.positions())===h&&fullCommonWorkbench.skinReport().settings.tone===.38&&fullFaceTransfer.capture().faceSettings.enabled,previous));
 await p.evaluate(a=>fullCommonWorkbench.restore(a),saved);
 for(const action of['walk','run','jump']){
  const q=await p.evaluate(async action=>{await fullCommonWorkbench.activateMainEntry(action);const m=fullCommonWorkbench.motion();m.setPlaying(false);await m.actors[0].human.skin.faceReady;m.advanceSteps(3);const r=m.diagnostics(),f=m.actors[0].human.skin.faceExtension;return{mode:r.mode,clip:r.activityClip,errors:r.errors,ready:f.ready,version:f.version,compiles:f.shaderCompiles,weightsTruncated:m.actors[0].human.report.weightsTruncated};},action);report.actions.push({action,...q});
  check('original '+action+' entry keeps native motion and composed skin',q.mode==='activity'&&q.clip===action&&q.ready&&q.compiles>0&&q.version==='ET12-F1.1'&&!q.weightsTruncated&&q.errors.length===0,q);
 }
 await p.evaluate(()=>fullCommonWorkbench.activateMainEntry('shape'));await p.evaluate(a=>fullCommonWorkbench.restore(a),saved);await p.click('#faceView');
 check('returning to shape keeps full face active',await p.evaluate(()=>fullCommonWorkbench.motion().mode==='shape'&&fullFaceTransfer.capture().faceSettings.enabled));
 await p.screenshot({path:dir+'/desktop-current-entry.png'});
 await p.setViewportSize({width:390,height:844});await p.click('#faceView');await p.locator('#canvas').scrollIntoViewIfNeeded();await p.screenshot({path:dir+'/mobile-current-entry.png'});
 check('mobile current layout does not horizontally overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('one original canvas',await p.locator('canvas').count()===1);check('no runtime errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(p&&!report.pass)await p.screenshot({path:dir+'/failure.png'}).catch(()=>{});if(b)await b.close();fs.writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));console.log('ET12_NATIVE_ENTRY',JSON.stringify({pass:report.pass,checks:report.checks.length,error:report.error}));});
