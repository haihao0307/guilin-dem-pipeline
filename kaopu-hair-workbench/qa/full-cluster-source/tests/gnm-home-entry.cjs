'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=async function(browser,url,out){
  fs.mkdirSync(out,{recursive:true});
  const result={passed:false,checks:[],errors:[],screenshots:[],physicalIPhoneTested:false};
  const target='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/qa/gnm-study/';
  let context,page;
  const check=(name,pass,detail)=>{result.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
  try{
    context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    await page.goto(url,{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>window.platform?.module==='home');
    const link=page.locator('#catalogGnmExperiment');
    check('existing five object cards remain',await page.locator('#catalogHome .catalog-card').count()===5);
    check('experiment is discoverable on desktop',await link.isVisible()&&await link.getAttribute('href')===target);
    check('home does not load GNM or existing renderers',await page.evaluate(()=>!window.gnmStudy&&!workbench.started&&!anemone.ready&&!kuko.ready));
    await page.screenshot({path:path.join(out,'home-desktop.png'),fullPage:true});result.screenshots.push('home-desktop.png');
    await page.setViewportSize({width:390,height:844});
    check('experiment is in mobile first screen',await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight;}));
    check('mobile home has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'home-mobile.png'),fullPage:true});result.screenshots.push('home-mobile.png');
    if(url.startsWith('http')){
      await Promise.all([page.waitForURL(target,{timeout:120000}),link.click()]);
      await page.waitForFunction(()=>window.gnmStudy?.ready||document.querySelector('#error:not([hidden])'),null,{timeout:120000});
      const d=await page.evaluate(()=>{gnmStudy.render();const gl=document.getElementById('canvas').getContext('webgl2');return {...gnmStudy.getDiagnostics(),glError:gl.getError()};});
      check('home link opens the real complete GNM model',d.ready&&d.glError===0&&d.vertices===17821&&d.identityDim===253&&d.expressionDim===383&&d.assetRecords.length===2&&d.assetRecords.every(x=>x.sha256===x.expectedSha256),d);
      await page.screenshot({path:path.join(out,'opened-from-home-mobile.png'),fullPage:true});result.screenshots.push('opened-from-home-mobile.png');
      await page.locator('a.back').click();
      await page.waitForFunction(()=>window.platform?.module==='home');
      check('back returns to the same five-case home and experiment link',await page.locator('#catalogHome .catalog-card').count()===5&&await page.locator('#catalogGnmExperiment').isVisible());
    }else result.onlineExperimentRequiresNetwork=true;
    check('entry route has no JS or console errors',result.errors.length===0,result.errors);result.passed=true;
  }catch(e){result.errors.push(e.stack||String(e));if(page)try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}}
  finally{if(context)await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));}
  return result;
};
