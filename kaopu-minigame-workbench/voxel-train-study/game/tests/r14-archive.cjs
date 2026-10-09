const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const {clickTarget}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',base=process.env.TRAIN_GAME_URL,out=`r14-${engine}-archive`;
fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await({chromium,webkit})[engine].launch();const errors=[],bad=[];try{
 const page=await browser.newPage({viewport:{width:1440,height:900},hasTouch:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()])});
 await page.goto(base+'r13/',{waitUntil:'load'});await page.waitForFunction(()=>window.__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-dynamics-r13');
 await clickTarget(page,'#startGame');await page.waitForFunction(()=>__trainDriver.getState().station.canOpen);await clickTarget(page,'#stationAction');await page.waitForFunction(()=>__trainDriver.getState().phase==='ready-depart');const served=await page.evaluate(()=>__trainDriver.getState());assert.equal(served.stats.stops,1);assert.equal(served.audio.unlocked,true);await page.screenshot({path:out+'/r13-preserved-first-stop.png',timeout:60000});
 await clickTarget(page,'#pause',{touch:true});const before=await page.evaluate(()=>__trainDriver.getState());await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>__trainDriver.getState())).timetable.minutes,before.timetable.minutes);await clickTarget(page,'#resume');await clickTarget(page,'#openSettings');const current=page.locator('.settings-links a').filter({hasText:'返回当前版'});assert.equal(await current.evaluate(a=>a.href),base);await current.click();await page.waitForFunction(()=>window.__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-hud-r14');
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,engine,base,archive:'r13/',served,returnCurrent:true,errors,bad},null,2));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
