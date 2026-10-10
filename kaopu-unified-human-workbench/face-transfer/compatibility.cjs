// Additional continuation gates. These complement, not replace, verify.cjs.
// Exact frame hashes test that native master controls really reach donor bands.
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),{chromium}=require('playwright');
const commit=process.env.PUBLIC_COMMIT,OUT=commit?'qa-face-et12/compat-public':'qa-face-et12/compat-source';fs.mkdirSync(OUT,{recursive:true});
const url=commit?'https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/'+commit+'/kaopu-unified-human-workbench/face-transfer/preview.html':'http://127.0.0.1:8765/kaopu-unified-human-workbench/face-transfer/preview.html';
const report={schema:'kaopu/full-face-native-compatibility@1',commit,url,checks:[],presets:[],controls:[],errors:[],realMobileDeviceTested:false};let browser,page;
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});assert(pass,name+' '+JSON.stringify(detail));}
async function image(){const b=await page.locator('#canvas').screenshot();return crypto.createHash('sha256').update(b).digest('hex');}
async function shot(name){await page.screenshot({path:OUT+'/'+name+'.png'});}
(async()=>{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});page=await browser.newPage({viewport:{width:1440,height:1040},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Shader|WebGLProgram|GL_INVALID/.test(m.text()))report.errors.push(m.text());});
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.fullFaceTransfer&&fullCommonWorkbench.diagnostics().ready&&!fullCommonWorkbench.diagnostics().busy,null,{timeout:240000});await page.evaluate(()=>fullFaceTransfer.ready());
 await page.evaluate(()=>{window.__CF_HASH__=a=>{let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(const x of b)h=Math.imul(h^x,16777619);return(h>>>0).toString(16);};});
 const baseline=await page.evaluate(()=>fullCommonWorkbench.archive());
 // Check all72 profiles, not merely the visible36 current presets.
 const ids=await page.evaluate(()=>fullCommonWorkbench.allPresets().map(p=>p.id));check('72 retained current and historical presets',ids.length===72);
 const fields=await page.evaluate(()=>{const a=fullFaceTransfer.fieldArrays();return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,__CF_HASH__(Float32Array.from(v))]));});
 const topology=await page.evaluate(()=>__CF_HASH__(fullCommonWorkbench.faces()));
 for(const id of ids){await page.evaluate(id=>fullCommonWorkbench.applyPreset(id),id);
  const q=await page.evaluate(()=>{const p=fullCommonWorkbench.positions(),before=fullFaceTransfer.nativeBeforeFace(),original=eyeTransferredHuman.nativePositions(),B=fullCommonWorkbench.diagnostics().bodyVertices,arrays=fullFaceTransfer.fieldArrays();let body=0,delta=0,nonSkin=0;for(let i=0;i<p.length;i++){if(i<B*3)body=Math.max(body,Math.abs(p[i]-original[i]));else{delta=Math.max(delta,Math.abs(p[i]-before[i]));if(arrays.fA[Math.floor(i/3)*4]===0)nonSkin=Math.max(nonSkin,Math.abs(p[i]-before[i]));}}return {id:fullCommonWorkbench.presetRecord().presetId,headHash:__CF_HASH__(p.subarray(B*3)),finite:p.every(Number.isFinite),indexHash:__CF_HASH__(fullCommonWorkbench.faces()),bodyErrorMM:body*1000,faceDeltaMM:delta*1000,zeroMaskDeltaMM:nonSkin*1000,fields:Object.fromEntries(Object.entries(arrays).map(([k,v])=>[k,__CF_HASH__(Float32Array.from(v))])),affected:fullFaceTransfer.capture().face.affectedNativeVertices};});report.presets.push(q);
  check(id+' compatible identity and fixed correspondence',q.id===id&&q.finite&&q.indexHash===topology&&q.bodyErrorMM===0&&q.faceDeltaMM>0&&q.faceDeltaMM<1&&JSON.stringify(q.fields)===JSON.stringify(fields),q);
 }
 check('72 distinct native head results',new Set(report.presets.map(p=>p.headHash)).size===72);
 await page.evaluate(a=>fullCommonWorkbench.restore(a),baseline);await page.click('#faceBeauty');await page.click('#faceView');
 const masters=[
  {key:'detail',native:{detail:0},enabled:{detail:.72},faceA:{detail:0,meso:0},faceB:{detail:1.5,meso:1.5},layer:'normal'},
  {key:'variation',native:{variation:0},enabled:{variation:.4},faceA:{colorDetail:0},faceB:{colorDetail:1.5},layer:'color'},
  {key:'oil',native:{oil:0},enabled:{oil:.18},faceA:{oil:0},faceB:{oil:1.5},layer:'beauty'}
 ];
 for(const t of masters){
  await page.evaluate(({baseline,t})=>{fullCommonWorkbench.restore(baseline);fullFaceTransfer.set({layer:t.layer,diffusion:0,...t.faceA});fullCommonWorkbench.setSkin(t.native);},{baseline,t});const zeroA=await image();
  await page.evaluate(v=>fullFaceTransfer.set(v),t.faceB);const zeroB=await image();
  check('original '+t.key+' zero gates migrated residual exactly',zeroA===zeroB,{zeroA,zeroB});
  await page.evaluate(v=>fullCommonWorkbench.setSkin(v),t.enabled);const activeB=await image();await page.evaluate(v=>fullFaceTransfer.set(v),t.faceA);const activeA=await image();
  check('original '+t.key+' enabled restores donor contribution',activeB!==activeA,{activeA,activeB});
  report.controls.push({master:t.key,zeroA,zeroB,activeA,activeB});
 }
 await page.evaluate(a=>fullCommonWorkbench.restore(a),baseline);await page.click('#faceBeauty');await page.click('#faceView');
 const originalSettings=await page.evaluate(()=>fullFaceTransfer.capture().skinSettings);
 for(const [key,value]of[['tone',.2],['warmth',.9],['lipMix',.1],['lipColor','#613044'],['roughness',.85],['redness',.95]]){await page.evaluate(v=>fullCommonWorkbench.setSkin(v),originalSettings);const before=await image();await page.evaluate(({key,value})=>fullCommonWorkbench.setSkin({[key]:value}),{key,value});const after=await image();check('native '+key+' independently changes composed pixels',before!==after);}
 await page.evaluate(a=>fullCommonWorkbench.restore(a),baseline);
 // Grey A/B holds the material and camera, not merely the UI wording.
 await page.click('#faceGray');const camera=await page.evaluate(()=>fullCommonWorkbench.camera());await page.focus('#faceBefore');await page.keyboard.down('Space');const c=await page.evaluate(()=>({gray:eyeTransferredHuman.settings().gray,enabled:fullFaceTransfer.capture().faceSettings.enabled,camera:fullCommonWorkbench.camera()}));check('held comparison remains grey and same camera',c.gray&&!c.enabled&&JSON.stringify(c.camera)===JSON.stringify(camera));await page.keyboard.up('Space');
 const restored=await page.evaluate(()=>fullCommonWorkbench.positions());await page.keyboard.down('Space');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('Space');check('loss of focus restores new whole-face state',await page.evaluate(()=>fullFaceTransfer.capture().faceSettings.enabled));
 await page.click('#faceBeauty');await page.click('#faceView');await shot('01-composed-full-face');
 for(const feature of['nose','mouth','eyes','oblique']){await page.click('[data-face-closeup="'+feature+'"]');await shot('02-'+feature);}
 await page.click('#faceView');await page.click('#faceGray');await shot('03-gray-native-structure');await page.click('#faceBeauty');
 // The actor is the pre-existing native CSR-skinned person. Verify that the
 // same host-detail gate is available in that material, not only a still preview.
 report.motion=await page.evaluate(async()=>{const studio=fullCommonWorkbench.motion();await studio.setMode('activity');const a=studio.actors[0].human;await a.skin.faceReady;studio.advanceSteps(3);const first=a.sampleVertex(a.N-10);fullCommonWorkbench.setSkin({detail:0,oil:0,variation:0});studio.advanceSteps(7);const q={version:a.skin.faceExtension.version,hostMasters:a.skin.faceExtension.hostMasters,detail:a.skin.U.csDetail.value,oil:a.skin.U.csOil.value,variation:a.skin.U.csVariation.value,shaderCompiles:a.skin.faceExtension.shaderCompiles,weightsTruncated:a.report.weightsTruncated,first,second:a.sampleVertex(a.N-10),errors:studio.diagnostics().errors};return q;});
 check('same composed surface reaches original skinned actor and its controls',report.motion.version==='ET12-F1.1'&&report.motion.detail===0&&report.motion.oil===0&&report.motion.variation===0&&report.motion.shaderCompiles>0&&report.motion.weightsTruncated===false&&report.motion.errors.length===0,report.motion);
 check('native skeletal motion remains active',report.motion.first.some((x,i)=>Math.abs(x-report.motion.second[i])>1e-7));await shot('04-native-motion');await page.evaluate(()=>fullCommonWorkbench.motion().setMode('shape'));await page.evaluate(a=>fullCommonWorkbench.restore(a),baseline);
 await page.setViewportSize({width:390,height:844});await page.click('#faceView');await shot('05-mobile-composition');check('mobile view no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('one host canvas',await page.evaluate(()=>document.querySelectorAll('canvas').length===1));check('no runtime or shader errors',report.errors.length===0,report.errors);report.pass=true;
})().catch(e=>{report.pass=false;report.error=e.stack;console.error(e);process.exitCode=1;}).finally(async()=>{if(page&&!report.pass)await page.screenshot({path:OUT+'/failure.png'}).catch(()=>{});if(browser)await browser.close();fs.writeFileSync(OUT+'/report.json',JSON.stringify(report,null,2));console.log('ET12_COMPAT',JSON.stringify({pass:report.pass,presets:report.presets.length,checks:report.checks.length,error:report.error}));});
