const fs=require('node:fs'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events'),{chromium,webkit}=require('playwright');
const {clickTarget,clickControl}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',suite=process.env.R14_SUITE||'normal',base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const out=`r14-${engine}-${suite}`,fps=15;fs.mkdirSync(out,{recursive:true});const errors=[],bad=[],checks=[];
const harness=`
window.__r13={
 freeze(){requestAnimationFrame=()=>0;},
 sync(render=true){const v=game.view();world.update(v,game.route);syncSpatialAudio(v);brakeEffects.update(v,{emitters:world.train.root.matrixWorld});smoke.update(v.elapsed,camera,{view:v,emitters:world.fillSteamEmitters(steamEmitters)});if(render){draw(v,1,true);updateHUD(v);railAudio.update(v);journeyMusic.update(v);}return this.state();},
 step(n,render=true){for(let i=0;i<n;i++){game.stepTicks(1);this.sync(false);}return this.sync(render);},
 prepare(kind){start({line:'kcr1',seed:'R13-'+kind});if(kind==='departure'){this.step(35,false);game.command('station-action');for(let i=0;i<1600&&game.phase!=='ready-depart';i++)this.step(1,false);if(game.phase!=='ready-depart')throw Error('Could not prepare genuine completed first stop');}else{game.activateStation(2);game.distance=game.station.target-(kind==='approach'?10.5:180);game.velocity=8;game.throttle=kind==='detail'?2:0;game.elapsed=20;game.tick=600;game.scheduleMinutes=398;game.phase='running';world.resetEffects();smoke.reset();brakeEffects.reset();}this.sync();},
 camera(kind){if(kind==='detail'){selectCamera('detail');}else{camera.position.set(12,14,42);cameraTarget.set(-6,7,0);camera.zoom=1;camera.lookAt(cameraTarget);viewControls.saveCurrent();projectionKey='';syncProjection();camera.fov=44;camera.updateProjectionMatrix();}return this.sync();},
 state(){const v=game.view(),m=world.train.steam;return {phase:v.phase,paused:v.paused,tick:v.tick,elapsed:v.elapsed,distance:v.distance,velocity:v.velocity,throttle:v.throttle,brake:v.brake,canOpen:v.station.canOpen,remaining:v.station.remaining,door:v.door,steam:structuredClone(smoke.root.userData.effects),body:structuredClone(world.train.proof.bodyMotion),coachBodies:structuredClone(world.train.proof.coachBodyMotion),brakeEffects:structuredClone(brakeEffects.proof),friction:structuredClone(railAudio.getState().brakeFriction),wheelAngle:m.motion.angle,wheels:m.wheels.map(w=>w.position.toArray()),emitters:structuredClone(world.fillSteamEmitters(steamEmitters)),camera:camera.position.toArray(),cameraTarget:cameraTarget.toArray(),buffer:[canvas.width,canvas.height],dpr:devicePixelRatio,renderRatio,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};},
 game:()=>game,
 reset(){world.resetEffects();smoke.reset();brakeEffects.reset();return this.sync();}
};`;
async function movie(page,name,seconds,onFrame){
 const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',`${out}/${name}.mp4`]);let err='';proc.stderr.on('data',b=>err+=b);const done=once(proc,'close');const frames=[];
 try{for(let i=0;i<seconds*fps;i++){
  if(onFrame)await onFrame(i,i/fps);const n=Math.floor((i+1)*30/fps)-Math.floor(i*30/fps);const state=await page.evaluate(n=>__r13.step(n),n);frames.push({frame:i,time:(i+1)/fps,...state});
  const png=await page.screenshot({type:'png',timeout:60000});if(!proc.stdin.write(png))await once(proc.stdin,'drain');
  if([0,2*fps,4*fps,7*fps,9*fps,10*fps,11*fps,12*fps,seconds*fps-1].includes(i))fs.writeFileSync(`${out}/${name}-${String(i).padStart(3,'0')}.png`,png);
  if(i%30===0){fs.writeFileSync(`${out}/progress.json`,JSON.stringify({name,frame:i,total:seconds*fps}));console.log(name+' frame '+i+'/'+seconds*fps);}
 }}finally{proc.stdin.end();}
 const [code]=await done;assert.equal(code,0,err);fs.writeFileSync(`${out}/${name}-frames.json`,JSON.stringify({fps,seconds,mode:'Actual browser frames, fixed simulation step; silent visual QA, not a device frame-rate benchmark',frames},null,2));return frames;
}
(async()=>{const browser=await({chromium,webkit})[engine].launch();let context,page;try{
 context=await browser.newContext({viewport:{width:1152,height:864},hasTouch:true});page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
 await page.route('**/game/app.mjs',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+harness});});await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>window.__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-hud-r14');await clickTarget(page,'#startGame',{touch:true});
 if(['normal','brake-detail'].includes(suite)){
  await page.waitForFunction(()=>__trainDriver.getState().station.canOpen);await clickTarget(page,'#stationAction');await page.waitForFunction(()=>__trainDriver.getState().phase==='ready-depart',null,{timeout:60000});
  await clickTarget(page,'#openCameraMenu');await clickTarget(page,suite==='brake-detail'?'[data-camera="detail"]':'[data-camera="platform"]');
 }
 await page.evaluate(()=>__r13.freeze());await page.waitForTimeout(200);
 if(['normal','brake-detail'].includes(suite)){
  const served=await page.evaluate(()=>__trainDriver.getState());assert.equal(served.stats.stops,1,'Real first station served with native door input before capture');
  await clickTarget(page,'#stationAction');let accelerated=false,braking=false,released=false;
  const frames=await movie(page,suite==='brake-detail'?'normal-brake-wheel-detail':'normal-start-brake-stop',20,async(i,t)=>{
   const state=await page.evaluate(()=>__r13.state());
   if(!accelerated&&state.phase==='running'){await clickTarget(page,'#accelerate');await clickTarget(page,'#accelerate');accelerated=true;}
   if(t>=9&&!braking){const r=await page.locator('#brake').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();braking=true;}
   if(braking&&!released&&state.velocity===0){await page.mouse.up();released=true;}
  });
  assert(accelerated&&braking&&released);assert(frames.some(x=>x.steam.starting&&x.steam.dynamics.cylinderActive>0),'Bilateral startup steam visible');
  assert(frames.some(x=>x.brake&&x.steam.dynamics.cylinderActive>0),'Cinematic braking steam visible through normal brake input');assert(frames.some(x=>x.brakeEffects.activeSparks>0),'Native braking creates bounded shoe/rim sparks');assert(frames.some(x=>x.friction?.active),'Native braking drives original spatial friction bus');assert.equal(frames.at(-1).brakeEffects.activeSparks,0);assert.equal(frames.at(-1).brakeEffects.activeHaze,0);
  assert.equal(frames.at(-1).velocity,0);assert.equal(frames.at(-1).throttle,0);assert.equal(frames.at(-1).brake,false);assert.equal(frames.at(-1).body.state.heave,0);assert.equal(frames.at(-1).steam.dynamics.lowerActive,0);
  checks.push({name:'normal-native-start-brake-stop',frames:frames.length,actualFirstStop:served.stats.stops,first:frames[0],last:frames.at(-1),accelerated,braking,released,fixtureStateWrites:false});
 }else if(['departure','approach','detail'].includes(suite)){
  await page.evaluate(kind=>{__r13.prepare(kind);__r13.camera(kind);},suite);
  if(suite==='departure'){
   await clickTarget(page,'#stationAction');let accelerated=false,coasting=false;
   const frames=await movie(page,'departure-load-coast',16,async(i,t)=>{const s=await page.evaluate(()=>__r13.state());if(!accelerated&&s.phase==='running'){await clickTarget(page,'#accelerate');await clickTarget(page,'#accelerate');accelerated=true;}if(t>=10&&!coasting){await clickTarget(page,'#decelerate');await clickTarget(page,'#decelerate');await clickTarget(page,'#decelerate');coasting=true;}});
   assert(frames.some(s=>s.steam.starting));assert(frames.some(s=>s.steam.working&&s.velocity>4));assert(frames.at(-1).throttle===0);assert(frames.at(-1).steam.dynamics.pulseCount>0);checks.push({name:'departure-load-coast',frames:frames.length,first:frames[0],last:frames.at(-1)});
  }else if(suite==='approach'){
   const r=await page.locator('#brake').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();let released=false,opened=false;
   const frames=await movie(page,'approach-stop-release',14,async()=>{const s=await page.evaluate(()=>__r13.state());if(!released&&s.velocity===0){await page.mouse.up();released=true;}if(!opened&&s.canOpen){await clickTarget(page,'#stationAction');opened=true;}});
   assert(opened);assert(frames.some(s=>s.steam.dynamics.platformActive>0));assert(frames.some(s=>s.steam.dynamics.cylinderActive>0));assert.equal(frames.at(-1).velocity,0);checks.push({name:'approach-stop-release',frames:frames.length,first:frames[0],last:frames.at(-1)});
  }else{
   const frames=await movie(page,'body-wheels-detail',6);const wheelY=frames[0].wheels.map(p=>p[1]);for(const f of frames)assert.deepEqual(f.wheels.map(p=>p[1]),wheelY);assert(frames.at(-1).wheelAngle!==frames[0].wheelAngle);checks.push({name:'body-wheels-detail',frames:frames.length,first:frames[0],last:frames.at(-1)});
  }
 }else{
  await page.evaluate(()=>{__r13.prepare('detail');__r13.camera('overview');__r13.step(120)});let s=await page.evaluate(()=>__r13.state());assert(s.steam.dynamics.upperActive>0);assert.equal(s.steam.dynamics.poolSize,160);assert.equal(s.steam.ordinaryBrakeOpensDrain,false);
  const moving=s;const brakeRect=await page.locator('#brake').boundingBox();await page.mouse.move(brakeRect.x+brakeRect.width/2,brakeRect.y+brakeRect.height/2);await page.mouse.down();await page.evaluate(()=>__r13.step(4));const brakingLive=await page.evaluate(()=>__r13.state());assert(brakingLive.brakeEffects.activeSparks>0);await page.mouse.up();await clickTarget(page,'#pause',{touch:true});const paused=await page.evaluate(()=>__r13.sync());await page.evaluate(()=>__r13.step(60));const still=await page.evaluate(()=>__r13.state());assert.equal(still.tick,paused.tick);assert.deepEqual(still.body,paused.body);assert.deepEqual(still.coachBodies,paused.coachBodies);assert.deepEqual(still.brakeEffects,paused.brakeEffects);assert.deepEqual(still.emitters,paused.emitters);assert.deepEqual(still.steam.dynamics.geometryBounds,paused.steam.dynamics.geometryBounds);await page.screenshot({path:out+'/paused-plume.png',timeout:60000});await clickTarget(page,'#pause',{touch:true});
  await page.evaluate(()=>{__r13.game().command('brake',true);__r13.step(900)});s=await page.evaluate(()=>__r13.state());assert.equal(s.velocity,0);assert.equal(s.steam.dynamics.lowerActive,0);assert.equal(s.steam.dynamics.upperActive,0);const stopped=s;await page.evaluate(()=>__r13.step(90));const later=await page.evaluate(()=>__r13.state());assert.equal(later.wheelAngle,stopped.wheelAngle);assert.deepEqual(later.wheels,stopped.wheels);
  await page.screenshot({path:out+'/stopped-settled.png',timeout:60000});await page.evaluate(()=>__r13.prepare('departure'));s=await page.evaluate(()=>__r13.state());assert.equal(s.phase,'ready-depart');assert.equal(s.steam.dynamics.poolSize,160);
  for(const camera of ['platform','front','rear','detail','overview']){await clickTarget(page,'#openCameraMenu');await clickTarget(page,`[data-camera="${camera}"]`);await page.evaluate(()=>__r13.sync());assert.equal(await page.evaluate(()=>__trainDriver.getState().cameraMode),camera);}
  await page.screenshot({path:out+'/camera-views-stable.png',timeout:60000});checks.push({moving,paused,stopped,later,reset:s,pauseStable:true,zeroSpeedWheelStable:true,allFiveCameras:true});
 }
 assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,engine,suite,base,checks,errors,bad},null,2));
 }catch(e){if(page)await page.screenshot({path:out+'/failure.png',timeout:60000}).catch(()=>{});fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(e),stack:e.stack,checks,errors,bad},null,2));throw e;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
