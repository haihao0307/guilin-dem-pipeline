const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const engine=process.env.TRAIN_BROWSER||'chromium',base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const out=`r12-${engine}-input-fixture`;fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await({chromium,webkit})[engine].launch(),context=await browser.newContext({viewport:{width:390,height:500},hasTouch:true}),page=await context.newPage(),cases=[];
 try{
  await page.goto(new URL('tests/r12-input-fixture.html',base).href);await page.waitForFunction(()=>window.fixture?.ready);
  async function verify(name,expected,act){await page.evaluate(()=>fixture.reset());await act();const state=await page.evaluate(()=>fixture.state());cases.push({name,expected,state,pass:state.actions===expected&&state.paused===(expected%2===1)&&state.held.length===0});}
  await verify('one immediate mouse click',1,()=>page.mouse.click(105,95));
  await verify('forty immediate mouse clicks',40,async()=>{for(let i=0;i<40;i++)await page.mouse.click(105,95);});
  await verify('one mouse press across 130ms',1,async()=>{await page.mouse.move(105,95);await page.mouse.down();await page.waitForTimeout(130);await page.mouse.up();});
  await verify('fast mouse click following brake blur release',1,async()=>{await page.mouse.move(265,95);await page.mouse.down();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();await page.mouse.click(105,95);});
  await verify('fast mouse click following cancelled pause drag',1,async()=>{await page.mouse.move(105,95);await page.mouse.down();await page.mouse.move(370,250);await page.mouse.up();await page.mouse.click(105,95);});
  await verify('one touch tap',1,()=>page.touchscreen.tap(105,95));
  await verify('forty touch taps',40,async()=>{for(let i=0;i<40;i++)await page.touchscreen.tap(105,95);});
  await verify('touch tap following cancelled mouse pause',1,async()=>{await page.mouse.move(105,95);await page.mouse.down();await page.mouse.move(370,250);await page.mouse.up();await page.touchscreen.tap(105,95);});
  await verify('Enter after a mouse activation',2,async()=>{await page.mouse.click(105,95);await page.keyboard.press('Enter');});
  fs.writeFileSync(out+'/result.json',JSON.stringify({engine,pass:cases.every(c=>c.pass),cases},null,2));
  console.log(JSON.stringify(cases.map(c=>({name:c.name,pass:c.pass,actions:c.state.actions,clicks:c.state.events.filter(e=>e.type==='click'&&e.where==='document-capture')}))));
  assert(cases.every(c=>c.pass),'Native input fixture failed; see event trace');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
