const {chromium}=require('../.r5-deps/node_modules/playwright-core');
const fs=require('node:fs');
const url=process.env.REVIEW_URL||'http://127.0.0.1:4173/shorts-original-r5/';
(async()=>{
 fs.mkdirSync('proof',{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(180000);
 const errors=[],warnings=[],actions=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
 page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
 page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))errors.push(r.status()+' '+r.url());});
 let result={url};
 try{
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:180000});
  if(!response?.ok())throw Error('Entry HTTP '+response?.status());
  await page.waitForFunction(()=>window.__SHORTS_R5_READY__===true||window.__startupError,{},{timeout:180000});
  result=await page.evaluate(()=>({ready:window.__SHORTS_R5_READY__,startup:window.__humanStartup,card:window.ShortsR5?.card(),mesh:window.ShortsR5?.report(),status:document.getElementById('r5-status')?.textContent,uiSliders:document.querySelectorAll('#r5-ui input[type=range]').length}));
  if(!result.ready)throw Error(JSON.stringify(result));
  await page.evaluate(()=>{HumanLab.setAuto(false);ShortsR5.camera('front');});
  await page.screenshot({path:'proof/01-full-front.png'});
  for(const v of ['front','back','left','right','quarter']){
   await page.evaluate(v=>ShortsR5.camera(v,true),v);
   await page.screenshot({path:'proof/02-close-'+v+'.png'});
  }
  for(const [name,seconds]of [['walk',5],['turn',3],['sit',6],['stand',6]]){
   await page.evaluate(name=>{if(name==='walk'||name==='sit')ShortsR5.action('reset');ShortsR5.action(name);HumanLab.setAuto(false);},name);
   for(let t=0;t<seconds;t+=.25)await page.evaluate(()=>HumanLab.advance(.25));
   const state=await page.evaluate(()=>({pos:[...HumanLab.agent.pos],yaw:HumanLab.agent.yaw,error:HumanLab.agent.error||null,status:HumanLab.status,report:ShortsR5.report()}));
   actions.push({name,seconds,state});
   await page.evaluate(()=>ShortsR5.camera('quarter',true));
   await page.screenshot({path:'proof/03-'+name+'.png'});
  }
  await page.evaluate(()=>{ShortsR5.action('reset');ShortsR5.camera('quarter');});
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>HumanLab.render());
  await page.screenshot({path:'proof/04-mobile.png'});
  if(result.mesh.openings!==3||result.mesh.nonManifoldEdges!==0||result.mesh.degenerateTriangles!==0)throw Error('Invalid garment topology');
  if(result.uiSliders!==0)throw Error('User sizing sliders are not allowed');
  if(result.card.source.commit!=='3c3e9a4b7b250f4c8db20c15e2e5fab4ca9ce568')throw Error('Wrong body source');
  if(errors.length)throw Error(errors.join('\n'));
  result.browserChecksPassed=true;
 }catch(e){result.failure=e.stack||String(e);await page.screenshot({path:'proof/failure.png'}).catch(()=>{});}
 finally{
  result.url=url;result.errors=errors;result.warnings=[...new Set(warnings)];result.actions=actions;result.checkedAt=new Date().toISOString();
  fs.writeFileSync('proof/QA.json',JSON.stringify(result,null,2));if(result.card)fs.writeFileSync('proof/FIT_CARD.json',JSON.stringify(result.card,null,2));
  console.log(JSON.stringify({ready:result.ready,passed:result.browserChecksPassed,failure:result.failure,errors,actions:actions.map(a=>({name:a.name,error:a.state.error,pos:a.state.pos,yaw:a.state.yaw}))},null,2));
  await browser.close();
 }
 if(!result.browserChecksPassed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
