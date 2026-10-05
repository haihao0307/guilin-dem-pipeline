'use strict';
const fs=require('node:fs'),path=require('node:path');
module.exports=async function(browser,url,out){
  fs.mkdirSync(out,{recursive:true});
  const result={passed:false,checks:[],errors:[],screenshots:[],physicalIPhoneTested:false};
  const target=new URL('gnm-groom-editor/experiment.html',url).href;
  let context,page;
  const check=(name,pass,detail)=>{result.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
  try{
    context=await browser.newContext({viewport:{width:1440,height:1000}});page=await context.newPage();
    page.on('pageerror',e=>result.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')result.errors.push(m.text());});
    await page.goto(url,{waitUntil:'load',timeout:120000});
    await page.waitForFunction(()=>window.platform?.module==='home');
    const link=page.locator('#catalogGnmExperiment');
    const order=await page.locator('#catalogHome .catalog-grid > *').evaluateAll(cards=>cards.map(card=>card.id));
    check('existing five object cards remain in order before the human card',
      await page.locator('#catalogHome .catalog-card').count()===5&&
      JSON.stringify(order)===JSON.stringify(['catalogRabbit','catalogAnemone','catalogFiber','catalogGroom','catalogFeather','catalogGnmExperiment']),order);
    check('original male is a single image card linked directly to R9',
      await page.locator('#catalogHome .gnm-catalog-card').count()===1&&
      await link.locator('.catalog-card-title').evaluate(e=>e.firstChild.textContent.trim()==='原男性')&&
      await link.evaluate(a=>a.href)===target);
    await link.locator('img').evaluate(img=>img.decode());
    const preview=await link.locator('img').evaluate(img=>({
      complete:img.complete,width:img.naturalWidth,height:img.naturalHeight,
      embedded:img.src.startsWith('data:image/jpeg;base64,'),alt:img.alt
    }));
    check('human preview contains the embedded actual-render JPEG',preview.complete&&preview.embedded&&preview.width>=600&&preview.height>=500&&preview.alt.includes('实际渲染'),preview);
    check('TEN24 is clearly an unfinished local task',await page.locator('#ten24LocalTask').innerText().then(t=>t.includes('待本地原件接入')&&t.includes('未完成'))&&await page.locator('#ten24LocalTask a').getAttribute('href')==='../handoffs/ten24-original-local/index.html');
    check('the one-line intro link is gone',await page.locator('.catalog-intro #catalogGnmExperiment, .catalog-experiment-link').count()===0);
    const desktopStyle=await link.evaluate(card=>{
      const existing=document.getElementById('catalogRabbit'),a=getComputedStyle(card),b=getComputedStyle(existing);
      return {width:card.getBoundingClientRect().width,existingWidth:existing.getBoundingClientRect().width,
        previewHeight:card.querySelector('.catalog-preview').getBoundingClientRect().height,
        existingPreviewHeight:existing.querySelector('.catalog-preview').getBoundingClientRect().height,
        radius:a.borderRadius,existingRadius:b.borderRadius,background:a.backgroundColor,existingBackground:b.backgroundColor};
    });
    check('human card matches existing desktop card scale and surface',desktopStyle.width>400&&Math.abs(desktopStyle.width-desktopStyle.existingWidth)<1&&desktopStyle.previewHeight===desktopStyle.existingPreviewHeight&&desktopStyle.radius===desktopStyle.existingRadius&&desktopStyle.background===desktopStyle.existingBackground,desktopStyle);
    await link.scrollIntoViewIfNeeded();
    check('human card is discoverable by scrolling on desktop',await link.isVisible()&&await link.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;}));
    check('home does not load GNM or existing renderers',await page.evaluate(()=>!window.gnmStudy&&!workbench.started&&!anemone.ready&&!kuko.ready));
    await page.screenshot({path:path.join(out,'home-desktop.png'),fullPage:true});result.screenshots.push('home-desktop.png');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>scrollTo(0,0));
    check('mobile home has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,'home-mobile.png'),fullPage:true});result.screenshots.push('home-mobile.png');
    await link.scrollIntoViewIfNeeded();
    const mobileCard=await link.evaluate(e=>{
      const r=e.getBoundingClientRect(),preview=e.querySelector('.catalog-preview').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,previewHeight:preview.height,
        viewportWidth:innerWidth,viewportHeight:innerHeight,radius:getComputedStyle(e).borderRadius,
        existingRadius:getComputedStyle(document.getElementById('catalogRabbit')).borderRadius};
    });
    check('sixth human card is reachable by scrolling on mobile',mobileCard.top>=0&&mobileCard.bottom<=mobileCard.viewportHeight&&mobileCard.left>=0&&mobileCard.right<=mobileCard.viewportWidth&&mobileCard.width>=150&&mobileCard.previewHeight>=140&&mobileCard.radius===mobileCard.existingRadius,mobileCard);
    await page.screenshot({path:path.join(out,'home-mobile-human.png')});result.screenshots.push('home-mobile-human.png');
    if(url.startsWith('http')){
      await Promise.all([page.waitForURL(target,{timeout:120000}),link.click()]);
      await page.waitForFunction(()=>window.groomStudy?.ready||document.querySelector('#error:not([hidden])'),null,{timeout:240000});
      const d=await page.evaluate(()=>{groomStudy.render();const gl=document.getElementById('canvas').getContext('webgl2');return {...groomStudy.diagnostics(),glError:gl.getError()};});
      check('home opens exact original male R9 identity and accepted groom',d.ready&&d.glError===0&&d.model.vertices===17821&&d.model.identityDim===253&&d.model.expressionDim===383&&d.model.positionHash===1686585375&&JSON.stringify(d.geometryHashes)===JSON.stringify([235204425,3385537001])&&d.state.case==='neutral'&&d.state.groom.style==='original'&&d.assets.length===2,d);
      await page.screenshot({path:path.join(out,'opened-from-home-mobile.png'),fullPage:true});result.screenshots.push('opened-from-home-mobile.png');
      await page.goBack({waitUntil:'load'});
      await page.waitForFunction(()=>window.platform?.module==='home');
      check('back returns to the same five-case home plus human card',await page.locator('#catalogHome .catalog-card').count()===5&&await page.locator('#catalogHome .gnm-catalog-card').count()===1&&await page.locator('#catalogGnmExperiment img').isVisible());
    }else result.onlineExperimentRequiresNetwork=true;
    check('entry route has no JS or console errors',result.errors.length===0,result.errors);result.passed=true;
  }catch(e){result.errors.push(e.stack||String(e));if(page)try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}catch{}}
  finally{if(context)await context.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));}
  return result;
};
