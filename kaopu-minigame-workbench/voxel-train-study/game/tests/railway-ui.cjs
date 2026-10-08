const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright');
const {clickControl,openSettings,closeSettings}=require('./browser-controls.cjs');
const engine=process.env.TRAIN_BROWSER||'chromium',out='railway-ui-'+engine,base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const VIEW_KEY='kaopu.train-driver.views.v1',MODES=['landscape','portrait'];
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const {VIEW_REVISION,DEFAULT_VIEWS}=await import('../view-profile-storage.mjs');
 const recommended=mode=>({...structuredClone(DEFAULT_VIEWS[mode]),manual:false,locked:false});
 const profile=view=>({...Object.fromEntries(['position','target','zoom','manual','locked'].map(key=>[key,view[key]])),...(Object.hasOwn(view,'projection')?{projection:structuredClone(view.projection)}:{})});
 const browser=await({chromium,webkit})[engine].launch(),context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true}),page=await context.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/game/app.mjs*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:await response.text()+'\n'+fs.readFileSync(__dirname+'/browser-harness.mjs','utf8')});
 });
 const control=id=>clickControl(page,id);
 const state=()=>page.evaluate(()=>__trainDriver.getState());
 const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),VIEW_KEY);
 const freeze=async()=>{
  await page.evaluate(()=>{window.requestAnimationFrame=()=>0;});
  await page.waitForTimeout(150);
  await page.evaluate(()=>{const g=__trainDriver.test.session();g.paused=false;__trainDriver.test.stepTicks(0);__trainDriver.test.render();});
 };
 const reopen=async()=>{await page.reload();await page.waitForFunction(()=>window.__trainDriver?.test);};
 const resume=async()=>{await page.locator('#continueSaved').click();await freeze();};
 const assertView=async(mode,expected,label)=>{
  const current=(await state()).viewSettings;
  assert.equal(current.layout,mode,label+' layout');
  assert.equal(current.frameRevision,VIEW_REVISION,label+' revision');
  assert.deepEqual(profile(current),expected,label+' rendered camera and flags');
  assert.deepEqual(current.profiles[mode],expected,label+' runtime profile');
  assert.deepEqual((await stored()).profiles[mode],expected,label+' persisted profile');
 };
 const inBounds=async id=>{
  const size=page.viewportSize(),r=await page.locator('#'+id).boundingBox();
  assert(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,JSON.stringify({id,r,size}));
 };
 const scrollSettingsControl=async target=>{
  // Reopened menus retain their scroll offset. Minimal scrolling can leave a
  // subpixel edge clipped behind the fixed header, especially when rotated.
  // Center the real scroll container before checking the entire target frame.
  await target.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 };
 const assertToolsClear=async label=>{
  const opened=await openSettings(page),checks=[];
  for(const id of ['landscapeView','portraitView','lockView','resetView','restoreView','cameraView','toggleHints','fullScreen']){
   if(id==='restoreView'&&!await page.locator('#restoreView').isVisible())continue;
   const target=page.locator('#'+id);await scrollSettingsControl(target);await inBounds(id);
   const check=await target.evaluate(el=>{
    const a=el.getBoundingClientRect(),scroll=el.closest('.settings-scroll'),port=scroll.getBoundingClientRect(),header=document.querySelector('.settings-header').getBoundingClientRect(),hit=document.elementFromPoint(a.x+a.width/2,a.y+a.height/2);
    const box=r=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height});
    const area=b=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    const collisions=[...document.querySelectorAll('#settingsScreen button')].filter(other=>other!==el&&!other.closest('[hidden]')).map(other=>({id:other.id,area:area(other.getBoundingClientRect())})).filter(other=>other.area>0);
    return{id:el.id,reachable:hit===el||el.contains(hit),fullyInsideScrollport:a.left>=port.left&&a.top>=port.top&&a.right<=port.right&&a.bottom<=port.bottom,headerOverlap:area(header),collisions,target:box(a),scrollport:box(port),header:box(header),scrollTop:scroll.scrollTop};
   });
   assert(check.reachable,label+': settings tool must receive input '+JSON.stringify(check));
   assert(check.fullyInsideScrollport,label+': the full target frame must be inside the settings scrollport '+JSON.stringify(check));
   assert.equal(check.headerOverlap,0,label+': settings header must not cover '+JSON.stringify(check));
   assert.deepEqual(check.collisions,[],label+': settings buttons must not overlap '+id);
   checks.push(check);
  }
  if(opened)await closeSettings(page);
  return checks;
 };
 const assertRestoreVisible=async expected=>{
  const opened=await openSettings(page);
  assert.equal(await page.locator('#restoreView').isVisible(),expected,'Saved-view availability is checked inside the open settings dialog');
  if(expected){await scrollSettingsControl(page.locator('#restoreView'));await inBounds('restoreView');}
  if(opened)await closeSettings(page);
 };
 try{
  await page.goto(base);await page.waitForFunction(()=>window.__trainDriver?.test);await page.locator('#startGame').click();await freeze();
  assert.equal(await page.locator('.masthead h1').isVisible(),false);
  assert.equal(await page.locator('#mapStations>g').count(),6);
  await assertView('landscape',recommended('landscape'),'Fresh recommended landscape');
  assert.deepEqual((await stored()).profiles.portrait,recommended('portrait'));
  assert.deepEqual((await stored()).backups,{});
  for(const size of [{width:844,height:390,layout:'landscape'},{width:700,height:390,layout:'landscape'},{width:390,height:844,layout:'landscape'},{width:390,height:700,layout:'portrait'},{width:320,height:690,layout:'portrait'}]){
   await page.setViewportSize({width:size.width,height:size.height});await control(size.layout+'View');await freeze();
   await assertView(size.layout,recommended(size.layout),'Recommended '+JSON.stringify(size));
   for(const id of ['pause','openSettings','accelerate','decelerate','brake','stationAction'])await inBounds(id);
   const distanceFont=await page.locator('#stationDistance').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),minimumDistanceFont=size.layout==='landscape'?32:size.width===320?28:30;
   assert(distanceFont>=minimumDistanceFont,JSON.stringify({size,distanceFont,minimumDistanceFont}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const settingsTools=await assertToolsClear('Settings controls stay visible and separate');
   const layout=await page.evaluate(()=>{
    const main=document.getElementById('driverGame'),root=main.getBoundingClientRect(),rotated=__trainDriver.getState().viewSettings.rotated;
    const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return rotated?{x:r.y-root.y,y:root.right-r.right,width:r.height,height:r.width}:{x:r.x-root.x,y:r.y-root.y,width:r.width,height:r.height};};
    return{root:{width:main.clientWidth,height:main.clientHeight},scene:rect('#sceneWrap'),left:rect('#leftHud'),right:rect('#instrumentPanel'),hud:{station:rect('.station-totem'),route:rect('#routeMap'),tools:rect('.essential-tools'),routeInstrument:rect('#instrumentPanel .route-hud'),speed:rect('#instrumentPanel .speed-display')}};
   });
   for(const [actual,expected] of [[layout.scene.x,0],[layout.scene.y,0],[layout.scene.width,layout.root.width],[layout.scene.height,layout.root.height]])assert(Math.abs(actual-expected)<=1,'The scene must fill the logical viewport: '+JSON.stringify(layout));
   const hudCollisions=[];
   for(const left of ['station','route','tools'])for(const right of ['routeInstrument','speed']){
    const a=layout.hud[left],b=layout.hud[right],area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
    if(area>0)hudCollisions.push({left,right,area});
   }
   assert.deepEqual(hudCollisions,[],'Station, route and main controls must stay clear of each instrument in two dimensions: '+JSON.stringify(layout));
   let heroMapOverlap=null;
   if(size.layout==='landscape'&&size.width>size.height){
    const hero=await page.evaluate(()=>__trainDriver.test.heroRect()),map=await page.locator('#routeMap').boundingBox();
    assert(map,'Route map must be visible');
    heroMapOverlap=Math.max(0,Math.min(hero.right,map.x+map.width)-Math.max(hero.left,map.x))*Math.max(0,Math.min(hero.bottom,map.y+map.height)-Math.max(hero.top,map.y));
    assert.equal(heroMapOverlap,0,'Recommended train framing must stay clear of the route map: '+JSON.stringify({size,hero,map}));
   }
   await page.screenshot({path:out+'/'+size.width+'-'+size.height+'-'+size.layout+'.png',timeout:30000});
   checks.push({size,distanceFont,minimumDistanceFont,controlsInBounds:true,settingsTools,hudCollisions,heroMapOverlap,...layout});
  }

  // An old release's locked views migrate once to this release's defaults. Every
  // camera component and flag remains available through the real “上次” control.
  const legacy={version:1,layout:'landscape',profiles:{
   landscape:{position:[19,24,38],target:[-8.8,-.8,1],zoom:1.21,manual:true,locked:true},
   portrait:{position:[30,22,17],target:[-7,-.5,1],zoom:1.31,manual:true,locked:true}
  },backups:{
   landscape:{position:[18,25,39],target:[-8,0,1],zoom:.9,manual:true,locked:false},
   portrait:{position:[29,21,16],target:[-6,.5,0],zoom:1.12,manual:false,locked:true}
  },archivedBackups:{
   landscape:[{position:[17,26,40],target:[-9,1,2],zoom:1.02,manual:false,locked:false}],
   portrait:[{position:[28,20,15],target:[-5,1.5,-1],zoom:.97,manual:true,locked:false}]
  }};
  await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:VIEW_KEY,data:legacy});
  await reopen();
  await assertView('landscape',recommended('landscape'),'First migration uses the new framing');
  const migrated=await stored(),expectedArchives=Object.fromEntries(MODES.map(mode=>[mode,[...legacy.archivedBackups[mode],legacy.backups[mode]]]));
  assert.equal(migrated.frameRevision,VIEW_REVISION);
  assert.deepEqual(migrated.profiles,Object.fromEntries(MODES.map(mode=>[mode,recommended(mode)])));
  assert.deepEqual(migrated.backups,legacy.profiles,'Both old profiles must be backed up without changing any field');
  assert.deepEqual(migrated.archivedBackups,expectedArchives,'Earlier backups and archive entries must survive migration');
  await reopen();
  assert.deepEqual(await stored(),migrated,'Reopening must not repeat migration or overwrite the old backups');
  await assertView('landscape',recommended('landscape'),'Second visit keeps the new framing');
  await resume();

  for(const mode of MODES){
   await control(mode+'View');await freeze();
   await assertView(mode,recommended(mode),'Unrestored '+mode+' uses the recommendation');
   await assertRestoreVisible(true);
   await assertToolsClear('Saved-view return remains reachable inside settings on the small screen');
   // Recommending an already-default camera must not overwrite its pending backup.
   await control('resetView');await freeze();
   assert.deepEqual((await stored()).backups[mode],legacy.profiles[mode]);
   await control('restoreView');await freeze();
   await assertView(mode,legacy.profiles[mode],'Restored '+mode+' is exact');
   await assertRestoreVisible(false);
   assert.equal(Object.hasOwn((await stored()).backups,mode),false);
   assert.deepEqual((await stored()).archivedBackups,expectedArchives);
   const restored=await stored();
   await reopen();
   assert.deepEqual(await stored(),restored,'A restored profile must survive reopening without another migration');
   await assertView(mode,legacy.profiles[mode],'Reopened restored '+mode);
   await resume();
   await assertView(mode,legacy.profiles[mode],'Continuing the saved game preserves restored '+mode);
   // The new recommendation remains reversible after using an old locked view.
   await control('resetView');await freeze();
   await assertView(mode,recommended(mode),'Explicit recommendation for '+mode);
   assert.deepEqual((await stored()).backups[mode],legacy.profiles[mode]);
   await assertRestoreVisible(true);
   await assertToolsClear('Recommended-view return remains reachable inside settings');
   await control('restoreView');await freeze();
   await assertView(mode,legacy.profiles[mode],'Explicit recommendation undo for '+mode);
  }

  // Save later adjustments through real pointer/wheel/lock input, rather than a
  // fixture write. Neither subsequent visits nor layout changes may replace them.
  const adjusted={};
  for(const mode of MODES){
   await page.setViewportSize(mode==='landscape'?{width:844,height:390}:{width:390,height:700});
   await control(mode+'View');await freeze();
   await control('lockView');
   assert.equal((await state()).viewSettings.locked,false);
   const before=profile((await state()).viewSettings),scene=await page.locator('#gameScene').boundingBox(),x=scene.x+scene.width*.57,y=scene.y+scene.height*.55;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y-20,{steps:5});await page.mouse.up();
   await page.mouse.wheel(0,-100);
   await page.waitForFunction(zoom=>__trainDriver.getState().viewSettings.zoom>zoom,before.zoom,{polling:50});
   await control('lockView');await freeze();
   adjusted[mode]=profile((await state()).viewSettings);
   assert.notDeepEqual(adjusted[mode].position,before.position,'Pointer input must create a new '+mode+' view');
   assert(adjusted[mode].zoom>before.zoom,'Wheel input must change '+mode+' zoom');
   assert.equal(adjusted[mode].manual,true);assert.equal(adjusted[mode].locked,true);
   await assertView(mode,adjusted[mode],'New user-adjusted '+mode);
   const changed=await stored();
   await reopen();
   assert.deepEqual(await stored(),changed,'A new user adjustment must not be overwritten on reopening');
   await assertView(mode,adjusted[mode],'Reopened user-adjusted '+mode);
   await resume();
  }
  for(const mode of MODES){
   await control(mode+'View');await freeze();
   await assertView(mode,adjusted[mode],'Independent adjusted '+mode+' remains saved');
  }
  assert.deepEqual((await stored()).backups,{});
  assert.deepEqual((await stored()).archivedBackups,expectedArchives);

  // Legacy automatic profiles are real saved frames too. The positions/zoom
  // include an R04-style landscape; targets are explicit synthetic fixtures.
  const legacyAutomatic={version:1,layout:'landscape',profiles:{
   landscape:{position:[4,20,32],target:[-8.8,-.8,1],zoom:1.14,manual:false,locked:false},
   portrait:{position:[30,22,17],target:[-7,-.5,1],zoom:1.02,manual:false,locked:false}
  }};
  const assertAutomatic=async(mode,label)=>{
   const current=(await state()).viewSettings,expected=legacyAutomatic.profiles[mode];
   assert.equal(current.layout,mode,label+' layout');
   assert.equal(current.frameRevision,VIEW_REVISION,label+' revision');
   // Lerp/snap arithmetic may differ by a last floating-point bit. Only the
   // rendered vectors have this tolerance; saved vectors and all flags are exact.
   for(const field of ['position','target'])for(let i=0;i<3;i++)assert(Math.abs(current[field][i]-expected[field][i])<1e-9,label+' '+field+'['+i+']: '+JSON.stringify(current[field]));
   for(const field of ['zoom','manual','locked'])assert.equal(current[field],expected[field],label+' '+field);
   assert.equal(Object.hasOwn(current,'projection'),Object.hasOwn(expected,'projection'),label+' projection metadata presence');
   if(Object.hasOwn(expected,'projection'))assert.deepEqual(current.projection,expected.projection,label+' projection metadata');
   assert.deepEqual(current.profiles[mode],expected,label+' runtime automatic baseline');
   assert.deepEqual((await stored()).profiles[mode],expected,label+' persisted automatic baseline');
  };
  const assertAutomaticProfiles=async label=>{
   assert.deepEqual((await state()).viewSettings.profiles,legacyAutomatic.profiles,label+' runtime profiles');
   assert.deepEqual((await stored()).profiles,legacyAutomatic.profiles,label+' persisted profiles');
  };
  await page.evaluate(({key,data})=>localStorage.setItem(key,JSON.stringify(data)),{key:VIEW_KEY,data:legacyAutomatic});
  await reopen();
  await assertView('landscape',recommended('landscape'),'Old automatic profiles still migrate to the new recommendation once');
  assert.deepEqual((await stored()).backups,legacyAutomatic.profiles,'Automatic profiles must be backed up with both flags still false');
  await resume();
  for(const mode of MODES){
   await control(mode+'View');await freeze();
   await assertView(mode,recommended(mode),'Unrestored automatic '+mode+' starts with the new recommendation');
   await control('restoreView');await freeze();
   await assertAutomatic(mode,'Restored automatic '+mode+' survives the actual snap draw');
   await assertRestoreVisible(false);
   // An explicitly requested new frame must remain reversible for old automatic
   // profiles, even though neither manual nor locked is set.
   await control('resetView');await freeze();
   await assertView(mode,recommended(mode),'Automatic '+mode+' can select the new recommendation');
   assert.deepEqual((await stored()).backups[mode],legacyAutomatic.profiles[mode],'Recommending again must retain the old automatic frame');
   await assertRestoreVisible(true);
   await control('restoreView');await freeze();
   await assertAutomatic(mode,'Automatic '+mode+' recommendation undo');
   const automaticRestored=await stored();
   await reopen();await freeze();
   assert.deepEqual(await stored(),automaticRestored,'Reopening cannot overwrite the restored automatic profile');
   await assertAutomatic(mode,'Automatic '+mode+' survives initial page draw');
   // Freeze before Continue so its synchronous reset is checked before a later
   // draw could conceal a jump to the global recommendation.
   await page.locator('#continueSaved').click();
   await assertAutomatic(mode,'Continue immediately preserves automatic '+mode);
   await freeze();
   await assertAutomatic(mode,'Continued automatic '+mode+' survives rendering');
  }
  await assertAutomaticProfiles('Both restored automatic frames are independent');
  await page.setViewportSize({width:844,height:390});
  await control('landscapeView');await freeze();
  const beforeService=await page.evaluate(()=>__trainDriver.test.session().phase);
  const serviceLocked=await page.evaluate(()=>{const g=__trainDriver.test.session();g.phase='boarding';__trainDriver.test.render();return g.serviceLocked();});
  assert.equal(serviceLocked,true,'The service fixture must exercise the real automatic close-camera branch');
  const assertAutomaticClose=async label=>{
   const current=(await state()).viewSettings;
   assert.equal((await state()).cameraMode,'carriage',label+' camera mode');
   for(const [field,expected] of [['position',[-2,13,20]],['target',[-14.2,1.2,1.4]]])for(let i=0;i<3;i++)assert(Math.abs(current[field][i]-expected[i])<1e-9,label+' '+field);
   assert.equal(current.zoom,legacyAutomatic.profiles.landscape.zoom,label+' keeps the saved zoom');
   assert.equal(current.manual,false,label+' is still automatic');assert.equal(current.locked,false,label+' is still unlocked');
   assert.equal(Object.hasOwn(current,'projection'),false,label+' keeps legacy projection metadata absent');
   await assertAutomaticProfiles(label+' does not persist the temporary close-up');
  };
  await assertAutomaticClose('Automatic boarding close-up');
  // Layout changes during service must never capture the transient close-up as
  // the landscape wide baseline. Portrait keeps its own automatic frame.
  await control('portraitView');await freeze();
  await assertAutomatic('portrait','Portrait remains at its own frame during boarding');
  await assertAutomaticProfiles('Switching out of the close-up preserves both baselines');
  await control('landscapeView');await freeze();
  await assertAutomaticClose('Returning to landscape during boarding');
  await page.evaluate(()=>{__trainDriver.test.session().phase='doors-closing';__trainDriver.test.render();});
  await assertAutomatic('landscape','Closing the doors returns to the restored old wide frame');
  assert.equal((await state()).cameraMode,'wide');
  await page.evaluate(phase=>{__trainDriver.test.session().phase=phase;__trainDriver.test.render();},beforeService);
  await assertAutomatic('landscape','Leaving service retains the restored old wide frame');
  await assertAutomaticProfiles('Service transitions never overwrite the saved automatic frames');
  for(const mode of MODES){
   await control(mode+'View');await freeze();
   await page.evaluate(()=>__trainDriver.test.start({seed:'AUTOMATIC-VIEW-RESTART',durationMinutes:10}));
   await assertAutomatic(mode,'Restart immediately preserves automatic '+mode);
   await freeze();
   await assertAutomatic(mode,'Restarted automatic '+mode+' survives rendering');
  }
  const afterAutomaticService=await stored();
  await reopen();await freeze();
  assert.deepEqual(await stored(),afterAutomaticService,'Reopening after service must retain the automatic baselines');
  await assertAutomatic('portrait','Automatic portrait remains saved after service and restart');
  await assertAutomaticProfiles('Both automatic profiles remain exact after a later reopen');
  assert.deepEqual((await stored()).backups,{});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/result.json',JSON.stringify({status:'passed',engine,url:base,frameRevision:VIEW_REVISION,checks,oneTimeMigration:true,oldLockedViewsPreserved:true,earlierBackupsRetained:true,reopenDoesNotOverwrite:true,restoreExact:true,restoredViewsSurviveReopen:true,recommendedViewCanBeUndone:true,newUserAdjustmentsPreserved:true,automaticProfilesRestoreExact:true,automaticProfilesSurviveReopen:true,automaticRecommendationReversible:true,automaticServiceCloseAndReturn:true,automaticServiceLayoutSwitchSafe:true,automaticRestartPreserves:true,errors},null,2));
 }catch(error){
  fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),checks,errors,state:await state().catch(()=>null),stored:await stored().catch(()=>null)},null,2));
  try{await page.screenshot({path:out+'/failure.png',timeout:5000});}catch{}
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
