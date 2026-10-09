// Native mouse/touch regressions with HUD refresh between press and release.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium,webkit}=require('playwright');
const {clickTarget,clickControl}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',shard=Number(process.env.R12_SHARD||0),out=`r12-${engine}-controls-${shard}`;
const base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const cases=[
 {name:'desktop-2048',width:2048,height:1026},
 {name:'desktop-2560',width:2560,height:1336},
 {name:'desktop-125percent-equivalent',width:1638,height:821,dpr:1.25},
 {name:'desktop-150percent-equivalent',width:1365,height:684,dpr:1.5},
 {name:'landscape-844',width:844,height:390,touch:true},
 {name:'portrait-390',width:390,height:844,touch:true,portrait:true},
 {name:'portrait-360',width:360,height:780,touch:true,portrait:true},
 {name:'landscape-568',width:568,height:320,touch:true}
].filter((spec,i)=>process.env.R12_ONLYCASE?spec.name===process.env.R12_ONLYCASE:i%2===shard);
const ids=['pause','accelerate','decelerate','brake','stationAction'],checks=[],errors=[],bad=[];
fs.mkdirSync(out,{recursive:true});
const harness=`
window.__r12={
 freeze(){window.requestAnimationFrame=()=>0;},
 refresh(){updateHUD(game.view());return this.state();},
 show(){const v=game.view();draw(v,1,true);railAudio.update(v);updateHUD(v);return this.state();},
 setup(render=false){game=new Session({line:'kcr1',seed:'KCR-0620'});game.command('start');game.activateStation(2);game.distance=game.station.target-.2;game.velocity=0;game.throttle=0;game.stopStable=1;game.elapsed=130;game.scheduleMinutes=401;game.phase='running';game.paused=false;$('startScreen').hidden=true;$('pauseScreen').hidden=true;$('summaryScreen').hidden=true;setPaused(false);return render?this.show():this.refresh();},
 state(){let v=game.view();return {phase:v.phase,paused:v.paused,throttle:v.throttle,brake:v.brake,velocity:v.velocity,stopStable:game.stopStable,canOpen:v.station.canOpen,remaining:v.station.remaining,stationIndex:v.station.index,tick:v.tick,elapsed:v.elapsed,inputLog:game.inputLog.slice(-12)};},
 game:()=>game,
 step(n){game.stepTicks(n);return this.show();}
};
window.__nativeInputs=[];for(const type of ['pointerdown','pointerup','click','pointercancel','lostpointercapture'])document.addEventListener(type,e=>{if(e.target.closest?.('#drivePanel'))__nativeInputs.push({type,target:e.target.id||e.target.tagName,button:e.target.closest('button')?.id,trusted:e.isTrusted,detail:e.detail,pointerId:e.pointerId,buttons:e.buttons,buttonCode:e.button,x:e.clientX,y:e.clientY})},true);
`;
async function point(page,id,where='center'){
 return page.locator('#'+id).evaluate((el,where)=>{const r=el.getBoundingClientRect();let x=r.x+r.width/2,y=r.y+r.height/2;if(where==='left')x=r.left+4;if(where==='right')x=r.right-4;if(where==='top')y=r.top+4;if(where==='bottom')y=r.bottom-4;if(where==='label')y=r.y+r.height*.67;const hit=document.elementFromPoint(x,y);return{x,y,id:el.id,where,rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:hit?.closest('button')?.id||hit?.id,disabled:el.disabled,ariaDisabled:el.getAttribute('aria-disabled'),inert:!!el.closest('[inert]'),pointerEvents:getComputedStyle(el).pointerEvents};},where);
}
function reachable(p,spec){assert.equal(p.hit,p.id,JSON.stringify(p));assert.equal(p.inert,false);assert(!p.disabled);assert(p.x>=0&&p.y>=0&&p.x<spec.width&&p.y<spec.height,JSON.stringify(p));}
(async()=>{const browser=await({chromium,webkit})[engine].launch();let context,page,spec;try{
 for(spec of cases){
 context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.dpr||1,hasTouch:!!spec.touch});page=await context.newPage();page.setDefaultTimeout(45000);
 page.on('pageerror',e=>errors.push({spec:spec.name,message:e.message}));page.on('response',r=>{if(r.status()>=400)bad.push([spec.name,r.status(),r.url()]);});
 await page.route('**/game/app.mjs',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+harness})});
 await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>window.__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-desktop-r12');
 await clickTarget(page,'#startGame',{touch:!!spec.touch});if(spec.portrait)await clickControl(page,'portraitView',{touch:true});await page.evaluate(()=>__r12.freeze());await page.waitForTimeout(250);
 const state=await page.evaluate(()=>__r12.setup(true));assert.equal(state.canOpen,true);assert(Math.abs(state.remaining-.2)<1e-6);
 const layout=await page.evaluate(()=>{const names=['stationHeader','routeMap','instrumentPanel','whistle','openCameraMenu','openSettings','drivePanel','pause','accelerate','decelerate','brake','stationAction'];return Object.fromEntries(names.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x,y:r.y,w:r.width,h:r.height}]}))});
 for(const id of ['whistle','openCameraMenu','openSettings',...ids]){const r=layout[id];assert(r.x>=-1&&r.y>=-1&&r.x+r.w<=spec.width+1&&r.y+r.h<=spec.height+1,'clipped '+id+JSON.stringify(r));assert(r.w>=44&&r.h>=44,id+' target >=44');}
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const a=layout[ids[i]],b=layout[ids[j]];assert(Math.max(b.x-a.x-a.w,a.x-b.x-b.w,b.y-a.y-a.h,a.y-b.y-b.h)>=7.8,'overlap '+ids[i]+' '+ids[j]);}
 await page.screenshot({path:`${out}/${spec.name}-shatin.png`,timeout:60000});
 const events=[];
 for(const id of ids)for(const edge of ['center','left','right','top','bottom','label']){
  await page.evaluate(()=>{__r12.setup();__nativeInputs=[]});const p=await point(page,id,edge);reachable(p,spec);
  await page.mouse.move(p.x,p.y);await page.mouse.down();const held=await page.evaluate(()=>__r12.state());
  await page.evaluate(()=>{for(let i=0;i<5;i++)__r12.refresh()});await page.waitForTimeout(130);await page.mouse.up();
  const after=await page.evaluate(()=>({state:__r12.state(),events:__nativeInputs}));
  if(id==='accelerate')assert.equal(after.state.throttle,1,'one throttle up at '+edge);
  if(id==='decelerate')assert.equal(after.state.throttle,-1,'one throttle down at '+edge);
  if(id==='stationAction')assert.equal(after.state.phase,'doors-opening','open at '+edge);
  if(id==='pause')assert.equal(after.state.paused,true,'pause at '+edge);
  if(id==='brake'){assert.equal(held.brake,true,'brake held '+edge);assert.equal(after.state.brake,false,'brake released '+edge);}
  assert(after.events.some(e=>e.type==='pointerdown'&&e.trusted),'actual native mouse');events.push({id,edge,point:p,held,state:after.state,events:after.events});
 }
 // Releasing an activation outside cancels; leaving a held brake releases it.
 for(const id of ['accelerate','stationAction','pause','brake']){
  await page.evaluate(()=>__r12.setup());const p=await point(page,id);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(10,spec.height/2,{steps:4});await page.mouse.up();
  const v=await page.evaluate(()=>__r12.state());assert.equal(v.phase,'running',id+' drag-out');assert.equal(v.paused,false);assert.equal(v.throttle,0);assert.equal(v.brake,false);
 }
 // A window blur cancels all held input even when release arrives elsewhere.
 await page.evaluate(()=>__r12.setup());let p=await point(page,'brake');await page.mouse.move(p.x,p.y);await page.mouse.down();assert.equal(await page.evaluate(()=>__r12.state().brake),true);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await page.evaluate(()=>__r12.state().brake),false);await page.mouse.up();
 // The E shortcut and primary buttons still honor authoritative stop/interlock.
 await page.evaluate(()=>{__r12.setup();__r12.game().stopStable=.7;__r12.refresh()});assert.equal(await page.locator('#stationAction').isDisabled(),true);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>__r12.state().phase),'running');
 await page.evaluate(()=>__r12.setup());await page.keyboard.press('e');await page.evaluate(()=>__r12.refresh());assert.equal(await page.evaluate(()=>__r12.state().phase),'doors-opening');assert.equal(await page.locator('#accelerate').isDisabled(),true);
 await page.evaluate(()=>__r12.setup());await clickTarget(page,'#stationAction',{touch:!!spec.touch});await page.evaluate(()=>__r12.step(40));assert.notEqual(await page.evaluate(()=>__r12.state().phase),'running');
 await page.screenshot({path:`${out}/${spec.name}-door-open.png`,timeout:60000});
 // Explicit Pause freezes the authoritative clock and all native controls resume.
 await page.evaluate(()=>{__r12.setup();__nativeInputs=[]});await clickTarget(page,'#pause',{touch:!!spec.touch});const paused=await page.evaluate(()=>__r12.state());const pauseEvents=await page.evaluate(()=>__nativeInputs);assert.equal(paused.paused,true,'Pause click evidence '+JSON.stringify({paused,pauseEvents}));await page.evaluate(()=>__r12.step(30));assert.equal(await page.evaluate(()=>__r12.state().tick),paused.tick);await clickTarget(page,'#pause',{touch:!!spec.touch});assert.equal(await page.evaluate(()=>__r12.state().paused),false);
 await clickTarget(page,'#openCameraMenu',{touch:!!spec.touch});assert.equal(await page.locator('#settingsScreen').isVisible(),true);await clickTarget(page,'#closeSettings',{touch:!!spec.touch});assert.equal(await page.evaluate(()=>__r12.state().paused),false);
 checks.push({spec,state,layout,events,dragOut:true,dispatchedBlurRelease:true,stopRulesUnchanged:true,pause:true,settings:true});await context.close();context=null;
 }
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,engine,shard,base,checks,errors,bad,zoomBoundary:'DPR and CSS viewport equivalent to 125/150 percent desktop zoom; separate headed test covers native browser zoom.'},null,2));
 }catch(e){if(page)await page.screenshot({path:out+'/failure.png',timeout:60000}).catch(()=>{});fs.writeFileSync(out+'/failure.json',JSON.stringify({spec,error:String(e),stack:e.stack,checks,errors,bad,diagnostic:page?await page.evaluate(()=>({state:__r12.state(),events:__nativeInputs})).catch(()=>null):null},null,2));throw e;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
