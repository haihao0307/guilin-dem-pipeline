const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const {clickTarget,clickControl,openSettings,closeSettings}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',suite=process.env.R11_SUITE||'crew';
const base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const out=`r11-${engine}-${suite}`;fs.mkdirSync(out,{recursive:true});
const harness=`
window.__r11={
 freeze:()=>{requestAnimationFrame=()=>0;},
 show:()=>{const v=game.view();draw(v,1,true);railAudio.update(v);journeyMusic.update(v);updateHUD(v);return __trainDriver.getState();},
 step:n=>{game.stepTicks(n);return __r11.show();},
 service:()=>{for(let i=0;i<1600&&game.phase!=='ready-depart';i++)game.stepTicks(1);return __r11.show();},
 camera:(position,target)=>{camera.position.fromArray(position);cameraTarget.fromArray(target);camera.lookAt(cameraTarget);viewControls.saveCurrent();return __r11.show();},
 orientation:()=>({position:camera.position.toArray(),forward:camera.getWorldDirection(new THREE.Vector3()).toArray(),up:new THREE.Vector3(0,1,0).transformDirection(camera.matrixWorld).toArray()}),
 missAndHit:()=>{game=new Session({line:'kcr1',seed:'R11-HIT'});game.command('start');game.command('throttle-up');game.command('throttle-up');game.command('throttle-up');for(let i=0;i<900&&!game.stats.stoneHits;i++)game.stepTicks(1);return __r11.show();},
 station:()=>world.stationProof().find(x=>x.index===0),
 preset:selectCamera
};`;
const approxArray=(a,b,tolerance=1e-6)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<tolerance,`${a} != ${b}`));};
(async()=>{
 const browser=await({chromium,webkit})[engine].launch({headless:process.env.TRAIN_HEADLESS!=='0'}),checks=[],errors=[],bad=[];let page,context;
 async function open(size={width:844,height:390}){
  context=await browser.newContext({viewport:size,hasTouch:true});
  await context.addInitScript(()=>{window.__audioQa={created:0,started:0,blurs:0,trustedBlurs:0};const proto=globalThis.BaseAudioContext?.prototype,create=proto?.createBufferSource,start=globalThis.AudioBufferSourceNode?.prototype.start;if(create)proto.createBufferSource=function(...args){__audioQa.created++;return create.apply(this,args);};if(start)AudioBufferSourceNode.prototype.start=function(...args){__audioQa.started++;return start.apply(this,args);};window.addEventListener('blur',event=>{__audioQa.blurs++;if(event.isTrusted)__audioQa.trustedBlurs++;});});
  page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)bad.push([r.status(),r.url()]);});
  await page.route('**/game/app.mjs',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+harness});});
  await page.goto(base,{waitUntil:'load'});await page.waitForFunction(()=>__trainDriver?.ready);
  assert.equal(await page.evaluate(()=>__trainDriver.version),process.env.TRAIN_EXPECTED_VERSION||'kcr-spatial-r11');
  assert.equal(await page.evaluate(()=>__trainDriver.getState().music.enabled),false);
  await clickTarget(page,'#startGame',{touch:true});await page.evaluate(()=>__r11.freeze());await page.waitForTimeout(300);
  await page.waitForFunction(()=>__trainDriver.getState().audio.samples.length===5,{},{polling:50,timeout:90000});
  await page.evaluate(()=>__r11.step(40));
 }
 try{
  if(suite==='lifecycle'){
   await open({width:1280,height:900});const nativeFocus=await context.newCDPSession(page);await nativeFocus.send('Emulation.setFocusEmulationEnabled',{enabled:false});await page.bringToFront();await clickControl(page,'crowdToggle',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');
   let s=await page.evaluate(()=>__r11.show());assert.equal(s.audio.loopCount,2);const before=await page.evaluate(()=>({...__audioQa}));
   const r=await page.locator('#brake').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();assert.equal(await page.evaluate(()=>__trainDriver.getState().brake),true);
   const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
   await page.waitForFunction(()=>document.hidden&&__trainDriver.getState().paused&&__trainDriver.getState().audio.state==='suspended',undefined,{timeout:15000,polling:100});
   const hidden=await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState,focus:document.hasFocus(),state:__r11.show(),telemetry:{...__audioQa}}));
   assert.equal(hidden.state.brake,false);assert(hidden.telemetry.trustedBlurs>0,'Real native window blur was observed');
   await page.waitForTimeout(250);const again=await page.evaluate(()=>__r11.show());assert.equal(again.elapsed,hidden.state.elapsed);assert.equal(again.audio.audioClock,hidden.state.audio.audioClock);
   await other.close();await page.bringToFront();await page.mouse.up();assert.equal(await page.evaluate(()=>document.hidden),false);assert.equal(await page.evaluate(()=>__trainDriver.getState().paused),true);
   await page.screenshot({path:out+'/returned-still-paused.png',timeout:60000});await clickTarget(page,'#resume',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');
   await page.waitForTimeout(150);s=await page.evaluate(()=>__r11.show());assert.equal(s.paused,false);assert.equal(s.audio.volume,.65);assert.equal(s.audio.muted,false);assert.equal(s.brake,false);assert(s.audio.audioClock>hidden.state.audio.audioClock);
   const after=await page.evaluate(()=>({...__audioQa}));assert.equal(after.created,before.created);assert.equal(after.started,before.started);
   checks.push({nativeHeadedLifecycle:true,hidden,restored:{audioClock:s.audio.audioClock,volume:s.audio.volume,muted:s.audio.muted,paused:s.paused,brake:s.brake,telemetry:after},sourcesPreserved:true});await context.close();context=null;
  }else if(suite==='spatial'){
   context=await browser.newContext({viewport:{width:1100,height:850}});page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'tests/spatial-audio-probe.html');
   await clickTarget(page,'#run');await page.waitForFunction(()=>!!window.__spatialAudioProbe,undefined,{timeout:120000,polling:100});
   const measured=await page.evaluate(()=>{const{pcm,...report}=__spatialAudioProbe;return report;});
   assert.equal(measured.passed,true,JSON.stringify(measured.checks));
   for(const name of ['near','far','left','right','turn0','turn90','turn180','turn270']){
    const b64=await page.evaluate(async name=>{const {stereoFloatWav}=await import('./spatial-audio-probe.mjs'),p=__spatialAudioProbe.pcm[name];const bytes=stereoFloatWav({sampleRate:p.sampleRate,length:p.channels[0].length,getChannelData:i=>p.channels[i]});let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);},name);
    fs.writeFileSync(`${out}/${name}.wav`,Buffer.from(b64,'base64'));
   }
   checks.push({actualStereoOutput:measured});await page.screenshot({path:out+'/measured-output.png',fullPage:true});
   const impactMeasured=await page.evaluate(async()=>{const module=await import('./spatial-audio-probe.mjs');const result=await module.runSpatialAudioProbe({source:'coach-impact',includePcm:['near','far']});window.__impactProbe=result;const{pcm,...report}=result;return report;});
   assert.equal(impactMeasured.passed,true,JSON.stringify(impactMeasured.checks));
   for(const name of ['near','far']){const b64=await page.evaluate(async name=>{const {stereoFloatWav}=await import('./spatial-audio-probe.mjs'),p=__impactProbe.pcm[name];const bytes=stereoFloatWav({sampleRate:p.sampleRate,length:p.channels[0].length,getChannelData:i=>p.channels[i]});let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);},name);fs.writeFileSync(`${out}/impact-${name}.wav`,Buffer.from(b64,'base64'));}
   checks.push({actualImpactOutput:impactMeasured});await context.close();context=null;
   await open();let s=await page.evaluate(()=>__r11.show());assert.equal(s.audio.spatial.pannerCount,12);assert.equal(s.audio.volume,.65);
   const stations=[];for(const [position,target] of [[[.6,1.6,2.5],[.6,.65,0]],[[26,15,31],[-8,1,0]],[[.6,1.6,2.5],[.6,1.6,10]],[[.6,1.6,2.5],[-6,1.6,2.5]]]){
    s=await page.evaluate(({position,target})=>__r11.camera(position,target),{position,target});const camera=await page.evaluate(()=>__r11.orientation());
    for(const key of ['position','forward','up'])approxArray(s.audio.spatial.listener[key],camera[key]);
    assert.equal(s.audio.spatial.pannerCount,12);assert(s.audio.voices.active<=s.audio.voices.limit);stations.push({camera,spatial:s.audio.spatial,loops:s.audio.loopCount});
   }
   assert(stations.every(x=>x.loops===stations[0].loops),'Changing camera does not allocate/restart loop sources');
   checks.push({cameraBinding:stations});
   await clickControl(page,'crowdToggle',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');s=await page.evaluate(()=>__r11.show());assert.equal(s.audio.loopCount,2);
   const persistent=await page.evaluate(()=>({...__audioQa})),presets=[];
   for(const id of ['platform','overview','front','rear','detail']){
    await clickTarget(page,'#openCameraMenu',{touch:true});await clickTarget(page,`[data-camera="${id}"]`,{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');
    s=await page.evaluate(()=>__r11.show());const pose=await page.evaluate(()=>__r11.orientation());for(const key of ['position','forward','up'])approxArray(s.audio.spatial.listener[key],pose[key]);
    const telemetry=await page.evaluate(()=>({...__audioQa}));assert.equal(telemetry.created,persistent.created);assert.equal(telemetry.started,persistent.started);assert.equal(s.audio.loopCount,2);presets.push({id,camera:pose,audioClock:s.audio.audioClock,telemetry});
   }
   await openSettings(page,{touch:true});await clickTarget(page,'#soundToggle',{touch:true});await page.locator('#volume').fill('35');await closeSettings(page,{touch:true});s=await page.evaluate(()=>__r11.show());assert.equal(s.audio.muted,true);assert.equal(s.audio.volume,.35);
   await openSettings(page,{touch:true});await clickTarget(page,'#soundToggle',{touch:true});await page.locator('#volume').fill('65');await closeSettings(page,{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');s=await page.evaluate(()=>__r11.show());assert.equal(s.audio.muted,false);assert.equal(s.audio.volume,.65);
   const extra=await context.newPage();await extra.goto('about:blank');await extra.bringToFront();await page.waitForTimeout(200);
   const background=await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState,focus:document.hasFocus(),telemetry:{...__audioQa},state:__trainDriver.getState()}));
   if(background.hidden){assert.equal(background.state.paused,true);assert.equal(background.state.audio.state,'suspended');}
   await extra.close();await page.bringToFront();if((await page.evaluate(()=>__trainDriver.getState())).paused)await clickTarget(page,'#resume',{touch:true});
   await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');await clickControl(page,'crowdToggle',{touch:true});await page.evaluate(()=>__r11.show());
   const afterPresets=await page.evaluate(()=>({...__audioQa}));assert.equal(afterPresets.created,persistent.created);assert.equal(afterPresets.started,persistent.started);
   checks.push({fiveNativePresets:presets,stableLoopSources:true,muteVolumeRestored:true,backgroundObservation:{hidden:background.hidden,visibility:background.visibility,focus:background.focus,telemetry:background.telemetry},nativeHiddenPauseVerified:background.hidden});
   s=await page.evaluate(()=>__r11.missAndHit());assert.equal(s.stats.stoneHits,1);assert.equal(s.audio.impactCues,1);
   const hit=s.events.find(e=>e.type==='stone-hit'),slot=s.audio.impactSlots['impact'+(hit.id%4)];assert.equal(slot.eventId,hit.id);approxArray(slot.worldPosition,hit.point);
   assert.equal(s.audio.characterVoices.available,false);assert.equal(s.audio.characterVoices.played,0);assert(s.audio.characterVoices.requested>0);
   const same=await page.evaluate(()=>__r11.show());assert.equal(same.audio.impactCues,s.audio.impactCues,'Repeated frame cannot replay a collision');
   await page.screenshot({path:out+'/actual-stone-hit.png',timeout:60000});checks.push({actualCollision:hit,impact:slot,characterVoices:s.audio.characterVoices,impactCues:s.audio.impactCues});
   await context.close();context=null;
  }else{
   for(const size of [{width:2048,height:1016},{width:844,height:390},{width:390,height:844}]){
    await open(size);if(size.width===390){await clickControl(page,'portraitView',{touch:true});await page.evaluate(()=>__r11.show());}
    let s=await page.evaluate(()=>__r11.show());assert.equal(s.station.canOpen,true);assert.equal(s.music.enabled,false);assert.equal(s.music.activeSources,0);
    assert.equal(s.proof.placeholderDriver.pose.facing,'platform');const station=await page.evaluate(()=>__r11.station());
    assert(station.attendant.position[2]>2.3);assert.equal(station.attendant.position[1],.82);
    for(const id of ['pause','accelerate','decelerate','brake','stationAction']){const r=await page.locator('#'+id).boundingBox();assert(r&&r.x>=0&&r.y>=0&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,id+' inside viewport');}
    await page.screenshot({path:`${out}/${size.width}-stopped-platform.png`,timeout:60000});
    await clickTarget(page,'#stationAction',{touch:true});s=await page.evaluate(()=>__r11.service());assert.equal(s.phase,'ready-depart');
    const beforeGuard=s.audio.guardCues;await clickTarget(page,'#stationAction',{touch:true});await page.evaluate(()=>__r11.show());s=await page.evaluate(()=>__r11.step(15));
    assert.equal(s.phase,'doors-closing');assert.equal(s.audio.guardCues,beforeGuard+1);const dispatch=await page.evaluate(()=>__r11.station());assert(dispatch.attendant.pose.raise>.5);
    await page.screenshot({path:`${out}/${size.width}-guard-whistle.png`,timeout:60000});
    if(size.width===2048){await page.evaluate(()=>__r11.camera([-3.8,2.6,5.3],[-1.6,1.35,2.65]));await page.screenshot({path:out+'/guard-hand-close.png',timeout:60000});await page.evaluate(()=>{__r11.preset('platform');return __r11.show();});}

    await clickTarget(page,'#pause',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='suspended');
    const paused=await page.evaluate(()=>__r11.show());const pausedCrew=await page.evaluate(()=>__r11.station());await page.waitForTimeout(200);const again=await page.evaluate(()=>__r11.show());
    assert.equal(again.elapsed,paused.elapsed);assert.equal(again.audio.audioClock,paused.audio.audioClock);assert.deepEqual(await page.evaluate(()=>__r11.station().attendant.pose),pausedCrew.attendant.pose);
    assert.deepEqual(again.proof.placeholderDriver.pose,paused.proof.placeholderDriver.pose);
    await clickTarget(page,'#resume',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().audio.state==='running');s=await page.evaluate(()=>__r11.step(80));assert(s.velocity>.18);assert.equal(s.proof.placeholderDriver.pose.facing,'forward');assert.equal(s.audio.guardCues,beforeGuard+1);
    await page.screenshot({path:`${out}/${size.width}-driving-forward.png`,timeout:60000});
    checks.push({size,stopped:station,dispatch,driving:s.proof.placeholderDriver,guardOnce:true,pauseFrozen:true});await context.close();context=null;
   }
   context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'r10/');await page.waitForFunction(()=>__trainDriver?.ready);assert.equal(await page.evaluate(()=>__trainDriver.version),'kcr-atmosphere-r10');
   assert.equal(await page.evaluate(()=>__trainDriver.getState().music.enabled),true);await clickTarget(page,'#startGame',{touch:true});await page.waitForFunction(()=>__trainDriver.getState().station.canOpen);
   await page.screenshot({path:out+'/frozen-r10.png',timeout:60000});checks.push({r10Playable:true,originalCueRetained:true});await context.close();context=null;
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,engine,suite,checks,errors,bad,physicalDeviceTest:false,listeningReview:false},null,2));
 }catch(error){const browserState=page?await page.evaluate(()=>({hidden:document.hidden,visibility:document.visibilityState,focus:document.hasFocus(),telemetry:window.__audioQa||null,state:window.__trainDriver?.getState?.()||null})).catch(()=>null):null;fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),stack:error.stack,checks,errors,bad,browserState},null,2));if(page)await page.screenshot({path:out+'/failure.png',timeout:20000}).catch(()=>{});throw error;}
 finally{if(context)await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1});
