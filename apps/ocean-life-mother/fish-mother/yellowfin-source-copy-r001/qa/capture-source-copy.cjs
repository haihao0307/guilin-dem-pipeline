'use strict';

const { chromium } = require('playwright');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const url = process.env.QA_URL || 'http://127.0.0.1:4173/apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/index.html';
const outDir = path.resolve(process.env.QA_OUT || 'apps/ocean-life-mother/fish-mother/yellowfin-source-copy-r001/evidence/browser');
const expectedSha = '5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe';
fs.mkdirSync(outDir,{recursive:true});

const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));

(async()=>{
  const browser = await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const consoleErrors=[];
  const pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  page.on('pageerror',error=>pageErrors.push(String(error)));

  const trigger = async selector => {
    const found = await page.evaluate(sel=>{
      const element=document.querySelector(sel);if(!element)return false;
      element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));return true;
    },selector);
    if(!found)throw new Error(`QA control missing: ${selector}`);
  };
  const inspectView = async view => {
    await trigger(`[data-view="${view}"]`);await sleep(450);
    return page.evaluate(expected=>{
      const state=window.__fishQa;if(!state)throw new Error('window.__fishQa missing');
      const vector=state.camera.position.map((value,index)=>value-state.camera.target[index]);
      const axes=['x','y','z'];const dominant=axes[vector.map(Math.abs).indexOf(Math.max(...vector.map(Math.abs)))];
      return {expected,activeView:state.activeView,dominant,camera:state.camera,modelSpan:state.modelSpan,axes:state.axes,markerMapping:state.markerMapping};
    },view);
  };

  let receipt;
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForSelector('#stateDot.ok',{timeout:180000});
    await page.waitForFunction(()=>document.querySelector('#stateTitle')?.textContent?.includes('FISH-REF-002')&&window.__fishQa?.classificationLoaded===true&&window.__fishQa?.markerMapping?.count===19,null,{timeout:180000});
    await sleep(1200);

    const identity=await page.evaluate(()=>({
      title:document.querySelector('#stateTitle')?.textContent||'',detail:document.querySelector('#stateText')?.textContent||'',sha:document.querySelector('#shaText')?.textContent||'',bytes:document.querySelector('#byteText')?.textContent||'',source:document.querySelector('#sourceText')?.textContent||'',scene:document.querySelector('#sceneText')?.textContent||'',animation:document.querySelector('#animText')?.textContent||'',view:document.querySelector('#viewText')?.textContent||'',finlets:document.querySelector('#finletText')?.textContent||'',peduncle:document.querySelector('#peduncleText')?.textContent||'',qa:window.__fishQa
    }));
    if(identity.sha!==expectedSha)throw new Error(`browser SHA display mismatch: ${identity.sha}`);
    if(identity.source!=='branch-local')throw new Error(`workbench did not use branch-local source: ${identity.source}`);
    if(identity.qa?.classification?.dorsal!==9||identity.qa?.classification?.ventral!==8)throw new Error(`classification count mismatch: ${JSON.stringify(identity.qa?.classification)}`);
    if(identity.qa?.axes?.length!=='z'||identity.qa?.axes?.lateral!=='y'||identity.qa?.axes?.vertical!=='x')throw new Error(`display axis contract mismatch: ${JSON.stringify(identity.qa?.axes)}`);
    if(!(identity.qa?.modelSpan?.z>identity.qa?.modelSpan?.x&&identity.qa?.modelSpan?.z>identity.qa?.modelSpan?.y))throw new Error(`display length axis is not z: ${JSON.stringify(identity.qa?.modelSpan)}`);
    if(identity.qa?.markerMapping?.mode!=='canonical-source-axis-remap'||identity.qa?.markerMapping?.count!==19)throw new Error(`marker mapping mismatch: ${JSON.stringify(identity.qa?.markerMapping)}`);

    const uiPath=path.join(outDir,'workbench-ui.png');await page.screenshot({path:uiPath,fullPage:true});
    if(!(await page.locator('#playBtn').isDisabled()))await trigger('#playBtn');
    const restPose=await page.evaluate(()=>{
      const slider=document.querySelector('#timeSlider');if(!slider)throw new Error('time slider missing');
      slider.value='0';slider.dispatchEvent(new Event('input',{bubbles:true}));
      return {slider:Number(slider.value),label:document.querySelector('#timeText')?.textContent||''};
    });
    await sleep(500);
    restPose.label=await page.locator('#timeText').textContent();
    await page.evaluate(()=>{const panel=document.querySelector('.panel');if(panel)panel.style.display='none';const badge=document.querySelector('.badge');if(badge)badge.style.display='none';});

    const viewSemantics={};const expectedAxes={side:'y',top:'x',front:'z'};
    const shots=[['side','source-side.png'],['quarter','source-quarter.png'],['top','source-top.png'],['front','source-head-on.png']];
    for(const [view,file] of shots){
      const inspected=await inspectView(view);viewSemantics[view]=inspected;
      if(inspected.activeView!==view)throw new Error(`view state mismatch: ${view} -> ${inspected.activeView}`);
      if(expectedAxes[view]&&inspected.dominant!==expectedAxes[view])throw new Error(`semantic axis mismatch: ${view} -> ${inspected.dominant}, expected ${expectedAxes[view]}`);
      await page.screenshot({path:path.join(outDir,file),fullPage:true});
    }

    await inspectView('side');await trigger('#markersBtn');await sleep(500);
    await page.screenshot({path:path.join(outDir,'source-side-classification.png'),fullPage:true});
    await trigger('#markersBtn');await trigger('#wireBtn');await sleep(500);
    await page.screenshot({path:path.join(outDir,'source-side-wireframe.png'),fullPage:true});
    await trigger('#wireBtn');await trigger('#skeletonBtn');await sleep(500);
    await page.screenshot({path:path.join(outDir,'source-side-skeleton.png'),fullPage:true});

    const files=fs.readdirSync(outDir).filter(name=>name.endsWith('.png')).sort().map(name=>{const file=path.join(outDir,name);return {name,bytes:fs.statSync(file).size,sha256:sha256File(file)};});
    const semanticViewAxesPassed=['side','top','front'].every(view=>viewSemantics[view]?.dominant===expectedAxes[view]&&viewSemantics[view]?.activeView===view);
    receipt={schema:'kaopu.fish-mother.yellowfin-source-copy-browser-qa/2.1',date:'2026-09-21',build:'YELLOWFIN-SOURCE-COPY-R001',url,viewport:{width:1440,height:900,deviceScaleFactor:1},renderer:'headless Chromium WebGL / SwiftShader',identity,classification:{dorsalConfirmed:identity.qa.classification.dorsal,ventralConfirmed:identity.qa.classification.ventral,peduncleU:identity.qa.classification.peduncleU,markerMapping:identity.qa.markerMapping},restPose,viewSemantics,screenshots:files,consoleErrors,pageErrors,checks:{exactShaDisplayed:identity.sha===expectedSha,branchLocalSourceUsed:identity.source==='branch-local',classificationLoaded:identity.qa.classificationLoaded===true,finletCountsDisplayed:identity.finlets.includes('9 dorsal / 8 ventral'),displayAxisContractPassed:identity.qa.axes.length==='z'&&identity.qa.axes.lateral==='y'&&identity.qa.axes.vertical==='x',modelLengthAxisIsZ:identity.qa.modelSpan.z>identity.qa.modelSpan.x&&identity.qa.modelSpan.z>identity.qa.modelSpan.y,markerMappingPassed:identity.qa.markerMapping.mode==='canonical-source-axis-remap'&&identity.qa.markerMapping.count===19,restPoseLockedForEvidence:restPose.slider===0&&restPose.label.startsWith('0.00 /'),semanticViewAxesPassed,classificationMarkersCaptured:files.some(file=>file.name==='source-side-classification.png'),fixedViewsCaptured:files.length>=8,consoleZeroErrors:consoleErrors.length===0,pageZeroErrors:pageErrors.length===0}};
    receipt.passed=Object.values(receipt.checks).every(Boolean);
    fs.writeFileSync(path.join(outDir,'BROWSER_QA_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
    if(!receipt.passed)throw new Error(`browser QA failed: ${JSON.stringify(receipt.checks)}`);
  }catch(error){
    receipt=receipt||{schema:'kaopu.fish-mother.yellowfin-source-copy-browser-qa/2.1',date:'2026-09-21',build:'YELLOWFIN-SOURCE-COPY-R001',url,consoleErrors,pageErrors,passed:false,error:String(error)};
    fs.writeFileSync(path.join(outDir,'BROWSER_QA_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');throw error;
  }finally{await browser.close();}
  console.log(JSON.stringify(receipt,null,2));
})().catch(error=>{console.error(error);process.exit(1)});
