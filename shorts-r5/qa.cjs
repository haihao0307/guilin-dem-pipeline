const {chromium}=require('../.r5-deps/node_modules/playwright-core');const fs=require('node:fs');
const url=process.env.REVIEW_URL||'http://127.0.0.1:4173/shorts-original-r5/';
(async()=>{
 fs.mkdirSync('proof',{recursive:true});let stage='launch';const deadline=setTimeout(()=>{fs.writeFileSync('proof/TIMEOUT.json',JSON.stringify({stage,url}));process.exit(2);},650000);
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1200,height:900}});page.setDefaultTimeout(120000);
 const errors=[],warnings=[],actions=[];let result={url};
 page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
 const shot=async name=>{stage=name;await page.screenshot({path:'proof/'+name+'.png',timeout:120000});};
 // Keep the original 1/60 physics steps but render only once per four-second batch.
 const settle=async()=>{for(let t=0;t<6;t++){const a=await page.evaluate(()=>{HumanLab.setAuto(false);HumanLab.advance(4);return HumanLab.agent.activity();});if(a.error)throw Error(a.error);if(a.readyForTask)return a;}throw Error('Original motion did not settle');};
 try{
  stage='navigate';const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});if(!response?.ok())throw Error('Entry HTTP '+response?.status());await page.waitForFunction(()=>window.__SHORTS_R5_READY__===true||window.__startupError,{},{timeout:180000});
  result=await page.evaluate(()=>({ready:window.__SHORTS_R5_READY__,startup:window.__humanStartup,card:window.ShortsR5?.card(),mesh:window.ShortsR5?.report(),version:window.ShortsR5?.version,uiSliders:document.querySelectorAll('#r5-ui input[type=range]').length,standDisabled:document.querySelector('[data-r5-action=stand]').disabled}));if(!result.ready)throw Error(JSON.stringify(result));
  if(result.card.binding?.influences!==8)throw Error('Original body binding is missing');
  await page.evaluate(()=>{HumanLab.setAuto(false);ShortsR5.camera('front',true);});await shot('01-front');await page.evaluate(()=>ShortsR5.camera('back',true));await shot('02-back');
  fs.writeFileSync('proof/STATIC.json',JSON.stringify(result,null,2));
  if(process.env.PUBLIC_SMOKE!=='1')for(const name of ['walk','turn','sit']){
   stage='action-'+name;const response=await page.evaluate(name=>{const r=ShortsR5.action(name);HumanLab.setAuto(false);return r;},name);if(!response?.accepted)throw Error(name+': '+response?.error);
   if(name==='walk'){await page.evaluate(()=>HumanLab.advance(1.5));await page.evaluate(()=>ShortsR5.camera('quarter',true));await shot('03-walking');}
   await settle();const state=await page.evaluate(()=>({pos:[...HumanLab.agent.pos],yaw:HumanLab.agent.yaw,error:HumanLab.agent.error||null,activity:HumanLab.agent.activity(),evidence:HumanLab.agent.evidence.slice(-2)}));if(name==='sit'&&state.activity.posture!=='sitting')throw Error('Sit did not complete');actions.push({name,state});fs.writeFileSync('proof/ACTIONS.json',JSON.stringify(actions,null,2));
   if(name==='sit'){await page.evaluate(()=>ShortsR5.camera('quarter',true));await shot('04-seated');}
  }
  await page.evaluate(()=>{ShortsR5.action('reset');HumanLab.setAuto(false);ShortsR5.camera('quarter');});await shot('05-full');await page.setViewportSize({width:390,height:844});await page.evaluate(()=>HumanLab.render());await shot('06-mobile');
  if(result.mesh.openings!==3||result.mesh.nonManifoldEdges||result.mesh.degenerateTriangles||result.uiSliders)throw Error('Topology or UI invalid');if(!result.standDisabled)throw Error('Known failed stand action must not be offered as accepted');if(result.card.source.commit!=='3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568')throw Error('Wrong source');if(errors.length)throw Error(errors.join('\n'));result.browserChecksPassed=true;
 }catch(e){result.failure=e.stack||String(e);await shot('failure').catch(()=>{});}
 finally{result.url=url;result.stage=stage;result.errors=errors;result.warnings=[...new Set(warnings)];result.actions=actions;result.originalStand={accepted:false,disabled:true,reason:'Original controller foot target out of reach',evidenceRun:36688311125};result.checkedAt=new Date().toISOString();fs.writeFileSync('proof/QA.json',JSON.stringify(result,null,2));if(result.card)fs.writeFileSync('proof/FIT_CARD.json',JSON.stringify(result.card,null,2));console.log(JSON.stringify({ready:result.ready,passed:result.browserChecksPassed,failure:result.failure,actions},null,2));await browser.close();clearTimeout(deadline);}
 if(!result.browserChecksPassed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
