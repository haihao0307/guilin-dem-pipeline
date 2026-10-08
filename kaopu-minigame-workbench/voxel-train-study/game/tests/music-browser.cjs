/* R10 real-browser music regression. No audio, clock, Session or network mocks.
 * TRAIN_BROWSER=chromium|webkit TRAIN_GAME_URL=<served game URL> node this-file
 * Optional: TRAIN_BROWSER_EXECUTABLE, TRAIN_MUSIC_OUT, TRAIN_HEADLESS=0.
 * --validate-only parses the injected fixture and checks local inputs; it does
 * not launch a browser and must never be reported as real-browser validation.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {clickTarget, openSettings, closeSettings, controlGeometry, assertControlGeometry} = require('./browser-controls.cjs');

// Test-only lexical access appended to the served production app. It retains
// the original Session and both real WebAudio engines. After a trusted Start
// click, only the costly draw loop stops; the audio clock is never overridden.
// Timed refreshes keep the genuine event-duck/recovery logic running. The small
// controller below advances normal Session commands/ticks, never positions,
// station indices, phases, route state, audio buffers or context timestamps.
const harness = `
;(() => {
  const telemetry = {trustedStarts:0, trustedContinues:0, whistleAttempts:0, whistlesPlayed:0};
  let pump = null;
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    if (event.target.closest('#startGame')) telemetry.trustedStarts++;
    if (event.target.closest('#continueSaved')) telemetry.trustedContinues++;
  });
  const originalWhistle = railAudio.whistle;
  railAudio.whistle = (...args) => {
    telemetry.whistleAttempts++;
    const played = originalWhistle(...args);
    if (played) telemetry.whistlesPlayed++;
    return played;
  };
  function audioRefresh() {
    const view = game.view(); railAudio.update(view); journeyMusic.update(view);
    return view;
  }
  function refresh() { const view=audioRefresh(); events(view); updateHUD(view); return __trainDriver.getState(); }
  function tickOnce() {
    if (game.paused) throw new Error('Fixture may not advance a paused Session');
    game.stepTicks(1);
  }
  function driveInput() {
    const view=game.view(), remaining=view.station.remaining, stop=view.brakingDistance+1.1;
    if (game.serviceLocked()) return;
    if (remaining<=stop && view.velocity>.08) game.command('brake',true);
    else if (view.velocity<.3 && remaining<=6 && remaining>=-6) game.command('brake',true);
    else if (view.velocity<14 && remaining>stop) {
      if(game.brake) game.command('brake',false);
      if(game.throttle<3) game.command('throttle-up');
    } else if(view.velocity>14.7 && game.throttle>0) game.command('throttle-down');
  }
  function reached(goal) {
    const view=game.view();
    if(goal==='ready-depart') return game.phase==='ready-depart';
    if(goal==='cruise') return view.station.index===1 && view.velocity>=6 && view.distance>60 && view.station.remaining>150;
    if(goal==='approach') return view.station.index===1 && view.station.remaining<=80 && view.velocity>.35;
    if(goal==='approach-steam') return view.events.some(event=>event.type==='approach-steam'&&event.station===1);
    if(goal==='arrived') return view.station.index===1 && view.station.canOpen;
    if(goal==='past-yaumati') return view.station.index>=2;
    throw new Error('Unknown fixture goal: '+goal);
  }
  window.__musicQA = {
    telemetry:()=>({...telemetry}),
    refresh,
    freeze:()=>{
      if(!game.started || !(telemetry.trustedStarts || telemetry.trustedContinues)) throw new Error('Trusted Start/Continue must happen before freezing RAF');
      window.requestAnimationFrame=()=>0;
      if(pump===null) pump=setInterval(audioRefresh,50);
      return refresh();
    },
    step:n=>{for(let i=0;i<n;i++)tickOnce();return refresh();},
    drive:(goal,limit=12000)=>{
      for(let i=0;i<limit;i++){
        if(reached(goal))return refresh();
        if(goal==='past-yaumati'){
          const view=game.view();
          if(view.station.canOpen&&!game.serviceLocked())game.command('station-action');
          else if(game.phase==='ready-depart'&&!(view.timetable?.dwellRemaining>0))game.command('station-action');
        }
        driveInput();tickOnce();
      }
      throw new Error('Original Session did not reach '+goal+'; station='+game.stationIndex+' phase='+game.phase+' distance='+game.distance);
    },
    savedPacket:()=>({key:SAVE_KEY,value:{version:1,packet:game.replayPacket(),signature:game.signature(),station:game.stationIndex}}),
    verifyReplay:()=>replay(game.replayPacket()).signature()===game.signature(),
    stopPump:()=>{clearInterval(pump);pump=null;}
  };
})();
`;

function validateLocalInputs() {
  new vm.Script(harness, {filename:'music-browser injected harness'});
  const gameDir = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir,'music/manifest.json'),'utf8'));
  const asset = fs.readFileSync(path.join(gameDir,'music',manifest.file));
  assert.equal(asset.length,manifest.bytes,'Local MP3 byte count');
  assert.equal(createHash('sha256').update(asset).digest('hex'),manifest.sha256,'Local MP3 hash');
  const app=fs.readFileSync(path.join(gameDir,'app.mjs'),'utf8');
  assert(app.includes("import {createJourneyMusic} from './music.mjs'"),'Music import exists');
  for(const call of ['journeyMusic.update(view)','journeyMusic.setPaused(game.paused)','music:journeyMusic.getState()'])assert(app.includes(call),call);
  assert(fs.readFileSync(path.join(gameDir,'index.html'),'utf8').includes('href="./music/README.md"'),'Credits link resolves to the supplied document');
  return manifest;
}

async function run() {
  const manifest=validateLocalInputs();
  const {chromium,webkit}=require('playwright');
  const engine=process.env.TRAIN_BROWSER||'chromium';
  assert(['chromium','webkit'].includes(engine),'TRAIN_BROWSER must be chromium or webkit');
  const base=new URL(process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  const appPath=new URL('app.mjs',base).pathname;
  const mp3Path=new URL('music/'+manifest.file,base).pathname;
  const out=process.env.TRAIN_MUSIC_OUT||'r10-music-'+engine;
  fs.mkdirSync(out,{recursive:true});
  const launch={headless:process.env.TRAIN_HEADLESS!=='0'};
  if(process.env.TRAIN_BROWSER_EXECUTABLE)launch.executablePath=process.env.TRAIN_BROWSER_EXECUTABLE;
  const browser=await({chromium,webkit})[engine].launch(launch);
  const checks=[],errors=[],badResponses=[],assetReads=[],assetJobs=[];
  let page,context,phase='startup';
  const state=()=>page.evaluate(()=>__trainDriver.getState());
  async function waitState(expression,arg,timeout=30000){await page.waitForFunction(expression,arg,{polling:50,timeout});}
  async function record(name){const value=await state();checks.push({name,state:value,telemetry:await page.evaluate(()=>__musicQA.telemetry())});return value;}
  async function open(saved){
    context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true});
    if(saved)await context.addInitScript(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),saved);
    page=await context.newPage();page.setDefaultTimeout(45000);
    page.on('pageerror',error=>errors.push({phase,message:error.message}));
    page.on('response',response=>{
      if(response.status()>=400)badResponses.push({phase,status:response.status(),url:response.url()});
      if(new URL(response.url()).pathname===mp3Path){
        assetJobs.push(response.body().then(body=>assetReads.push({status:response.status(),url:response.url(),bytes:body.length,sha256:createHash('sha256').update(body).digest('hex')})));
      }
    });
    await page.route(url=>url.pathname===appPath,async route=>{
      const response=await route.fetch();
      assert.equal(response.status(),200,'Served app.mjs is available');
      await route.fulfill({response,body:(await response.text())+harness});
    });
    await page.goto(base.href,{waitUntil:'domcontentloaded',timeout:120000});
    await waitState(()=>!!window.__trainDriver?.ready&&!!window.__musicQA,undefined,120000);
    return page;
  }
  async function freezeAfterGesture(){
    await page.evaluate(()=>__musicQA.freeze());
    // Let the one previously queued production frame drain. Polling is timer-
    // based; it does not require fresh animation frames from software WebGL.
    await waitState(()=>{
      const frames=__trainDriver.getState().frames;
      if(window.__musicStableFrames===frames)window.__musicStablePolls=(window.__musicStablePolls||0)+1;
      else{window.__musicStableFrames=frames;window.__musicStablePolls=0;}
      return window.__musicStablePolls>=3;
    });
  }
  async function loaded(){await waitState(()=>{const s=__trainDriver.getState();return s.music.loaded&&s.music.state==='running'&&s.audio.samples.length===5&&s.audio.state==='running';},undefined,90000);}
  async function serviceKowloon(){
    await page.evaluate(()=>__musicQA.step(40));
    let s=await state();assert.equal(s.station.index,0);assert(s.station.canOpen,'Kowloon stop settles using original Session ticks');
    const previousStarts=s.music.sourceStarts;
    await clickTarget(page,'#stationAction',{touch:true});
    s=await state();assert.equal(s.phase,'doors-opening');assert.equal(s.music.sourceStarts,previousStarts);
    s=await page.evaluate(()=>__musicQA.drive('ready-depart'));
    assert.equal(s.station.index,0);assert.equal(s.music.activeSources,0);
    await clickTarget(page,'#stationAction',{touch:true});
    s=await page.evaluate(()=>__musicQA.step(40));
    assert.equal(s.station.index,1);assert.equal(s.phase,'running');
    await waitState(()=>__trainDriver.getState().music.activeSources===1);
    return state();
  }
  async function setRange(selector,value){
    await clickTarget(page,selector,{touch:true});
    const tapped=Number(await page.locator(selector).inputValue());
    if(selector==='#musicVolume')assert.equal((await state()).music.volume,tapped/100,'Real touch slider changes the music gain');
    await page.locator(selector).focus();
    assert.equal(await page.locator(selector).evaluate(el=>document.activeElement===el),true,'Keyboard follows the selected slider');
    await page.keyboard.press('Home');
    for(let i=0;i<value;i++)await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator(selector).inputValue(),String(value),'Native slider keyboard input');
  }
  try {
    phase='trusted-start-and-real-decode';await open();
    let s=await state();
    assert.equal(s.music.state,'locked');assert.equal(s.music.volume,.32);assert.equal(s.audio.volume,.65);
    assert.equal(s.audio.crowdEnabled,false);assert.equal(s.music.activeSources,0);
    await clickTarget(page,'#startGame',{touch:true});await freezeAfterGesture();await loaded();
    s=await record(phase);assert.equal(s.music.stage,'waiting-departure');assert.equal(s.music.sourceStarts,0);
    assert.equal((await page.evaluate(()=>__musicQA.telemetry())).trustedStarts,1);
    assert(Math.abs(s.music.duration-manifest.renderedDurationSeconds)<.1,'Actual browser-decode duration');
    assert.deepEqual(s.music.errors,{});assert.deepEqual(s.audio.errors,{});

    phase='original-session-first-departure';s=await serviceKowloon();
    assert.equal(s.music.sourceStarts,1);assert.equal(s.music.cueStarted,true);
    await page.evaluate(()=>__musicQA.drive('cruise'));
    await waitState(()=>__trainDriver.getState().music.position>=4);
    s=await page.evaluate(()=>__musicQA.refresh());assert.equal(s.music.activeSources,1);
    const audioBefore=s.audio.chuffs;
    await page.evaluate(()=>{__musicQA.step(6);return __musicQA.step(6);});
    s=await record(phase);assert(s.audio.chuffs>audioBefore,'Original locomotive chuffs still advance');
    assert.equal(s.audio.crowdEnabled,false);assert(s.music.gainTarget>.30,'Music recovered after departure cues');

    phase='native-whistle-and-brake-duck';
    await clickTarget(page,'#whistle',{touch:true});
    s=await state();assert(s.events.some(event=>event.type==='whistle'));
    assert(s.music.duckFactor<=.21);assert(s.music.duckReasons.includes('whistle'));
    assert((await page.evaluate(()=>__musicQA.telemetry())).whistlesPlayed>=1,'The original real SFX whistle actually started');
    await waitState(()=>__trainDriver.getState().music.duckFactor===1);
    const brake=await controlGeometry(page.locator('#brake'));assertControlGeometry(brake);
    await page.mouse.move(brake.x,brake.y);await page.mouse.down();
    s=await page.evaluate(()=>__musicQA.step(6));assert.equal(s.brake,true);assert(s.music.duckFactor<=.34);
    await page.mouse.up();await page.evaluate(()=>__musicQA.drive('cruise'));await record(phase);

    phase='native-pause-freeze-resume';
    await clickTarget(page,'#pause',{touch:true});
    await waitState(()=>{const s=__trainDriver.getState();return s.paused&&s.music.state==='suspended'&&s.audio.state==='suspended';});
    const frozen=await state();await page.waitForTimeout(350);s=await state();
    for(const key of ['tick','elapsed'])assert.equal(s[key],frozen[key],key+' frozen');
    assert.equal(s.music.audioClock,frozen.music.audioClock);assert.equal(s.music.position,frozen.music.position);
    assert.equal(s.audio.audioClock,frozen.audio.audioClock);
    await clickTarget(page,'#resume',{touch:true});
    await waitState(()=>{const s=__trainDriver.getState();return !s.paused&&s.music.state==='running'&&s.audio.state==='running';});
    s=await record(phase);assert.equal(s.music.sourceStarts,1);assert.equal(s.music.activeSources,1);
    assert(s.music.position>=frozen.music.position&&s.music.position-frozen.music.position<1,'Resume preserves the playhead without wall-clock catchup');

    phase='settings-pause-independent-controls';
    assert.equal((await state()).paused,false,'Open settings from the supported running state');
    await openSettings(page,{touch:true});
    await waitState(()=>{const s=__trainDriver.getState();return s.paused&&s.music.state==='suspended'&&s.audio.state==='suspended';});
    const menuFrozen=await state();
    await setRange('#musicVolume',100);s=await state();assert.equal(s.music.volume,1);assert.equal(s.audio.volume,.65);
    await setRange('#musicVolume',32);
    for(let cycle=0;cycle<2;cycle++){
      await clickTarget(page,'#musicToggle',{touch:true});s=await state();assert.equal(s.music.enabled,false);
      await clickTarget(page,'#musicToggle',{touch:true});s=await state();assert.equal(s.music.enabled,true);
      assert.equal(s.music.state,'suspended');assert.equal(s.music.position,menuFrozen.music.position);
      assert.equal(s.music.audioClock,menuFrozen.music.audioClock);assert.equal(s.audio.audioClock,menuFrozen.audio.audioClock);
      assert.equal(s.music.sourceStarts,1);assert.equal(s.music.activeSources,1);
    }
    await clickTarget(page,'#soundToggle',{touch:true});s=await state();assert.equal(s.audio.muted,true);assert.equal(s.music.enabled,true);
    await clickTarget(page,'#soundToggle',{touch:true});s=await state();assert.equal(s.audio.muted,false);assert.equal(s.audio.state,'suspended');
    assert.equal(s.audio.crowdEnabled,false);assert.equal(s.music.volume,.32);
    await closeSettings(page,{touch:true});
    await waitState(()=>{const s=__trainDriver.getState();return !s.paused&&s.music.state==='running'&&s.audio.state==='running';});
    s=await record(phase);assert.equal(s.music.sourceStarts,1);assert.equal(s.music.activeSources,1);
    assert(s.music.position>=menuFrozen.music.position&&s.music.position-menuFrozen.music.position<1,'Closing settings automatically resumes without wall-clock catchup');

    phase='station-approach-steam-and-settlement';
    await page.waitForTimeout(1600);
    s=await page.evaluate(()=>__musicQA.drive('approach'));
    assert(s.station.remaining<=80);assert(s.music.duckFactor<.63);
    s=await page.evaluate(()=>__musicQA.drive('approach-steam'));
    assert(s.music.duckReasons.includes('steam'));assert(s.music.duckFactor<=.25);
    s=await page.evaluate(()=>__musicQA.drive('arrived'));
    assert(s.station.canOpen);assert.equal(s.music.stage,'settling');
    await clickTarget(page,'#stationAction',{touch:true});
    s=await state();assert(s.music.duckReasons.includes('doors'));const arrivalGain=s.music.gainTarget;
    await page.evaluate(()=>__musicQA.drive('ready-depart'));
    await page.waitForTimeout(4800);s=await state();assert(s.music.gainTarget>arrivalGain,'Quiet station recovery follows the doors/steam cues');
    await waitState(()=>__trainDriver.getState().music.finished,undefined,20000);
    s=await record(phase);assert.equal(s.music.activeSources,0);assert.equal(s.music.completedReason,'first-leg-settled');
    await clickTarget(page,'#stationAction',{touch:true});s=await page.evaluate(()=>__musicQA.step(40));
    assert.equal(s.station.index,2);assert.equal(s.music.activeSources,0);
    assert.equal(await page.evaluate(()=>__musicQA.verifyReplay()),true,'The saved scenario is reproducible by the original replay engine');
    const laterSave=await page.evaluate(()=>__musicQA.savedPacket());

    phase='native-restart-and-disabled-scope';
    assert.equal((await state()).paused,false,'Restart settings open from running');
    await openSettings(page,{touch:true});await clickTarget(page,'#restart',{touch:true});
    await page.locator('#settingsScreen').waitFor({state:'hidden'});
    s=await state();assert.equal(s.station.index,0);assert.equal(s.music.position,0);assert.equal(s.music.cueStarted,false);
    assert.equal(s.music.activeSources,0);assert.equal(s.music.stage,'waiting-departure');
    s=await serviceKowloon();assert.equal(s.music.sourceStarts,2);assert.equal(s.music.activeSources,1);
    assert.equal(s.paused,false,'Disable-music settings open from running');
    await openSettings(page,{touch:true});await clickTarget(page,'#musicToggle',{touch:true});await closeSettings(page,{touch:true});
    await waitState(()=>__trainDriver.getState().music.state==='suspended');
    s=await state();assert.equal(s.paused,false);assert.equal(s.audio.state,'running');
    s=await page.evaluate(()=>__musicQA.drive('past-yaumati'));
    assert.equal(s.station.index,2);assert.equal(s.music.finished,true);assert.equal(s.music.activeSources,0);
    assert.equal(s.paused,false,'Later-station settings open from running');
    await openSettings(page,{touch:true});await clickTarget(page,'#musicToggle',{touch:true});await closeSettings(page,{touch:true});
    s=await record(phase);assert.equal(s.music.sourceStarts,2);assert.equal(s.music.activeSources,0);
    assert.equal(s.music.enabled,true);assert.equal(s.audio.crowdEnabled,false);
    await page.evaluate(()=>__musicQA.stopPump());await context.close();

    phase='actual-continue-of-original-later-save';await open(laterSave);
    assert(await page.locator('#continueSaved').isVisible());
    await clickTarget(page,'#continueSaved',{touch:true});await freezeAfterGesture();await loaded();
    s=await record(phase);assert.equal(s.station.index,2);assert.equal(s.music.finished,true);
    assert.equal(s.music.sourceStarts,0);assert.equal(s.music.activeSources,0);assert.equal(s.music.cueStarted,false);
    assert.equal((await page.evaluate(()=>__musicQA.telemetry())).trustedContinues,1);
    assert.equal(s.audio.crowdEnabled,false);assert.equal(s.audio.muted,false);assert.equal(s.audio.volume,.65);
    assert.deepEqual(s.music.errors,{});assert.deepEqual(s.audio.errors,{});
    const credit=await page.locator('a[href="./music/README.md"]').getAttribute('href');
    assert.equal((await page.request.get(new URL(credit,base).href)).status(),200,'Credits target is served');
    await page.evaluate(()=>__musicQA.stopPump());
    await Promise.all(assetJobs);
    assert.equal(assetReads.length,2,'One genuine MP3 request per fresh page; toggles/restarts reuse the decoded asset');
    for(const asset of assetReads){assert.equal(asset.status,200);assert.equal(asset.bytes,manifest.bytes);assert.equal(asset.sha256,manifest.sha256);}
    assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);
    const report={pass:true,engine,viewport:[844,390],nativeUserGestures:true,realWebAudio:true,originalSession:true,playbackNotAuditioned:true,assetReads,checks,errors,badResponses};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({pass:true,engine,checks:checks.map(check=>check.name),report:path.join(out,'result.json')}));
  }catch(error){
    const finalState=page?await state().catch(()=>null):null;
    fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({pass:false,engine,phase,error:String(error),stack:error.stack,checks,errors,badResponses,assetReads,finalState},null,2));
    if(page)await page.screenshot({path:path.join(out,'failure.png'),timeout:15000}).catch(()=>{});
    throw error;
  }finally{await context?.close().catch(()=>{});await browser.close();}
}

if(require.main===module){
  if(process.argv.includes('--validate-only')){
    const manifest=validateLocalInputs();
    console.log(JSON.stringify({syntaxAndLocalInputs:true,browserRun:false,asset:manifest.file,bytes:manifest.bytes}));
  }else run().catch(error=>{console.error(error);process.exitCode=1;});
}
module.exports={harness,validateLocalInputs};
