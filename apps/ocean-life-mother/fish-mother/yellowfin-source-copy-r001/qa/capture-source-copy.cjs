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
  const browser = await chromium.launch({
    headless:true,
    args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']
  });
  const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const consoleErrors=[];
  const pageErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',err=>pageErrors.push(String(err)));

  const trigger = async selector => {
    const found = await page.evaluate(sel=>{
      const element=document.querySelector(sel);
      if(!element)return false;
      element.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
      return true;
    },selector);
    if(!found)throw new Error(`QA control missing: ${selector}`);
  };

  let receipt;
  try{
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
    await page.waitForSelector('#stateDot.ok',{timeout:180000});
    await page.waitForFunction(()=>document.querySelector('#stateTitle')?.textContent?.includes('FISH-REF-002'),null,{timeout:180000});
    await sleep(1500);

    const identity=await page.evaluate(()=>({
      title:document.querySelector('#stateTitle')?.textContent||'',
      detail:document.querySelector('#stateText')?.textContent||'',
      sha:document.querySelector('#shaText')?.textContent||'',
      bytes:document.querySelector('#byteText')?.textContent||'',
      source:document.querySelector('#sourceText')?.textContent||'',
      scene:document.querySelector('#sceneText')?.textContent||'',
      animation:document.querySelector('#animText')?.textContent||''
    }));
    if(identity.sha!==expectedSha)throw new Error(`browser SHA display mismatch: ${identity.sha}`);
    if(identity.source!=='branch-local')throw new Error(`workbench did not use branch-local source: ${identity.source}`);

    const uiPath=path.join(outDir,'workbench-ui.png');
    await page.screenshot({path:uiPath,fullPage:true});
    if(!(await page.locator('#playBtn').isDisabled()))await trigger('#playBtn');
    await page.evaluate(()=>{
      const panel=document.querySelector('.panel');if(panel)panel.style.display='none';
      const badge=document.querySelector('.badge');if(badge)badge.style.display='none';
    });

    const shots=[['side','source-side.png'],['quarter','source-quarter.png'],['top','source-top.png'],['front','source-head-on.png']];
    for(const [view,file] of shots){
      await trigger(`[data-view="${view}"]`);await sleep(650);
      await page.screenshot({path:path.join(outDir,file),fullPage:true});
    }
    await trigger('[data-view="side"]');await trigger('#wireBtn');await sleep(650);
    await page.screenshot({path:path.join(outDir,'source-side-wireframe.png'),fullPage:true});
    await trigger('#wireBtn');await trigger('#skeletonBtn');await sleep(650);
    await page.screenshot({path:path.join(outDir,'source-side-skeleton.png'),fullPage:true});

    const files=fs.readdirSync(outDir).filter(x=>x.endsWith('.png')).sort().map(name=>{
      const p=path.join(outDir,name);return {name,bytes:fs.statSync(p).size,sha256:sha256File(p)};
    });
    receipt={
      schema:'kaopu.fish-mother.yellowfin-source-copy-browser-qa/1.0',
      date:'2026-09-21',
      build:'YELLOWFIN-SOURCE-COPY-R001',
      url,
      viewport:{width:1440,height:900,deviceScaleFactor:1},
      renderer:'headless Chromium WebGL / SwiftShader',
      identity,
      screenshots:files,
      consoleErrors,
      pageErrors,
      checks:{
        exactShaDisplayed:identity.sha===expectedSha,
        branchLocalSourceUsed:identity.source==='branch-local',
        fixedViewsCaptured:files.length>=7,
        consoleZeroErrors:consoleErrors.length===0,
        pageZeroErrors:pageErrors.length===0
      }
    };
    receipt.passed=Object.values(receipt.checks).every(Boolean);
    fs.writeFileSync(path.join(outDir,'BROWSER_QA_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
    if(!receipt.passed)throw new Error(`browser QA failed: ${JSON.stringify(receipt.checks)}`);
  }catch(err){
    receipt=receipt||{schema:'kaopu.fish-mother.yellowfin-source-copy-browser-qa/1.0',date:'2026-09-21',build:'YELLOWFIN-SOURCE-COPY-R001',url,consoleErrors,pageErrors,passed:false,error:String(err)};
    fs.writeFileSync(path.join(outDir,'BROWSER_QA_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
    throw err;
  }finally{
    await browser.close();
  }
  console.log(JSON.stringify(receipt,null,2));
})().catch(err=>{console.error(err);process.exit(1)});
