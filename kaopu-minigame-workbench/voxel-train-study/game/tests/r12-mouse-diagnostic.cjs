const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const engine=process.env.TRAIN_BROWSER||'chromium',out=`r12-${engine}-mouse-diagnostic`,base=process.env.TRAIN_GAME_URL||'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/game/';
fs.mkdirSync(out,{recursive:true});
const harness=`
window.__r12={freeze(){window.requestAnimationFrame=()=>0;},show(){const v=game.view();draw(v,1,true);updateHUD(v);return v;},refresh(){updateHUD(game.view());},game:()=>game,
setup(){game=new Session({line:'kcr1',seed:'KCR-0620',durationMinutes:10});game.command('start');game.activateStation(2);game.distance=game.station.target-.2;game.velocity=0;game.throttle=0;game.stopStable=1;game.elapsed=130;game.phase='running';game.paused=false;$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;return this.show();},
state(){let v=game.view();return {phase:v.phase,paused:v.paused,throttle:v.throttle,brake:v.brake,velocity:v.velocity,stopStable:game.stopStable,canOpen:v.station.canOpen,remaining:v.station.remaining,stationIndex:v.station.index,inputs:game.inputLog?.slice(-8)};}};
window.__inputLog=[];for(const type of ['pointerdown','mousedown','pointerup','mouseup','click','pointercancel','gotpointercapture','lostpointercapture'])document.addEventListener(type,e=>{if(e.target.closest?.('#drivePanel'))__inputLog.push({type,target:e.target.id||e.target.tagName,button:e.target.closest('button')?.id,trusted:e.isTrusted,time:performance.now()})},true);
`;
(async()=>{const browser=await({chromium,webkit})[engine].launch();let context,page;const cases=[],errors=[];try{
context=await browser.newContext({viewport:{width:2048,height:1026}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('**/game/app.mjs',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+harness})});
await page.goto(base);await page.waitForFunction(()=>window.__trainDriver?.ready,{timeout:60000});await page.evaluate(()=>__r12.freeze());await page.waitForTimeout(300);await page.evaluate(()=>__r12.setup());
await page.screenshot({path:out+'/shatin-baseline.png',timeout:60000});
for(const id of ['accelerate','decelerate','stationAction','pause','brake'])for(const position of ['center','left','right','top','bottom','label']){
await page.evaluate(()=>{__r12.setup();__inputLog=[]});
const before=await page.evaluate(()=>__r12.state());
const target=await page.locator('#'+id).evaluate((el,position)=>{let r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;if(position==='left')x=r.left+4;if(position==='right')x=r.right-4;if(position==='top')y=r.top+4;if(position==='bottom')y=r.bottom-4;if(position==='label')y=r.top+r.height*.67;let hit=document.elementFromPoint(x,y);return{x,y,rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:hit?.id||hit?.tagName,closest:hit?.closest('button')?.id,disabled:el.disabled,opacity:getComputedStyle(el).opacity,pe:getComputedStyle(el).pointerEvents};},position);
await page.mouse.move(target.x,target.y);await page.mouse.down();const held=await page.evaluate(()=>__r12.state());
// A real HUD refresh between native mouse down/up matches the frame timing
// missed by previous frozen-frame center-click regressions.
await page.evaluate(()=>{for(let i=0;i<5;i++)__r12.refresh()});await page.waitForTimeout(125);await page.mouse.up();
const after=await page.evaluate(()=>({state:__r12.state(),events:__inputLog}));cases.push({id,position,target,before,held,...after});
}
fs.writeFileSync(out+'/result.json',JSON.stringify({engine,base,cases,errors},null,2));console.log(JSON.stringify(cases.map(c=>({id:c.id,point:c.position,hit:c.target.closest,disabled:c.target.disabled,phase:c.state.phase,throttle:c.state.throttle,paused:c.state.paused,brakeHeld:c.held.brake,events:c.events.map(e=>e.type+':'+e.target)}))));assert.deepEqual(errors,[]);
}catch(e){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(e),stack:e.stack,cases,errors},null,2));throw e;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
