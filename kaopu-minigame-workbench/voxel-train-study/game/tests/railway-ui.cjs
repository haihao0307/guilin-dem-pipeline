const assert=require('node:assert/strict'),fs=require('node:fs'),{chromium,webkit}=require('playwright');
const engine=process.env.TRAIN_BROWSER||'chromium',out='railway-ui-'+engine,base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const VIEW_KEY='kaopu.train-driver.views.v1',MODES=['landscape','portrait'];
fs.mkdirSync(out,{recursive:true});

(async()=>{
 const {VIEW_REVISION,DEFAULT_VIEWS}=await import('../view-profile-storage.mjs');
 const recommended=mode=>({...structuredClone(DEFAULT_VIEWS[mode]),manual:false,locked:false});
 const profile=view=>Object.fromEntries(['position','target','zoom','manual','locked'].map(key=>[key,view[key]]));
 const browser=await({chromium,webkit})[engine].launch(),context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true}),page=await context.newPage(),errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/game/app.mjs*',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:await response.text()+'\n'+fs.readFileSync(__dirname+'/browser-harness.mjs','utf8')});
 });
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
 const assertToolsClear=async label=>{
  const overlap=await page.evaluate(()=>{
   const a=document.querySelector('.view-tools').getBoundingClientRect(),b=document.querySelector('.masthead nav').getBoundingClientRect();
   return Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  });
  assert.equal(overlap,0,label);
  return overlap;
 };
 try{
  await page.goto(base);await page.waitForFunction(()=>window.__trainDriver?.test);await page.locator('#startGame').click();await freeze();
  assert.equal(await page.locator('.masthead h1').isVisible(),false);
  assert.equal(await page.locator('#mapStations>g').count(),6);
  await assertView('landscape',recommended('landscape'),'Fresh recommended landscape');
  assert.deepEqual((await stored()).profiles.portrait,recommended('portrait'));
  assert.deepEqual((await stored()).backups,{});
  for(const size of [{width:844,height:390,layout:'landscape'},{width:700,height:390,layout:'landscape'},{width:390,height:844,layout:'landscape'},{width:390,height:700,layout:'portrait'},{width:320,height:690,layout:'portrait'}]){
   await page.setViewportSize({width:size.width,height:size.height});await page.locator('#'+size.layout+'View').click();await freeze();
   await assertView(size.layout,recommended(size.layout),'Recommended '+JSON.stringify(size));
   for(const id of ['landscapeView','portraitView','lockView','resetView','cameraView','toggleHints','fullScreen','pause','accelerate','decelerate','brake','stationAction'])await inBounds(id);
   const distanceFont=await page.locator('#stationDistance').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),minimumDistanceFont=size.layout==='landscape'?32:size.width===320?28:30;
   assert(distanceFont>=minimumDistanceFont,JSON.stringify({size,distanceFont,minimumDistanceFont}));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   const overlap=await assertToolsClear('View and game controls must not overlap');
   const layout=await page.evaluate(()=>{
    const main=document.getElementById('driverGame'),root=main.getBoundingClientRect(),rotated=__trainDriver.getState().viewSettings.rotated;
    const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return rotated?{x:r.y-root.y,y:root.right-r.right,width:r.height,height:r.width}:{x:r.x-root.x,y:r.y-root.y,width:r.width,height:r.height};};
    return{root:{width:main.clientWidth,height:main.clientHeight},scene:rect('sceneWrap'),left:rect('leftHud'),right:rect('instrumentPanel')};
   });
   for(const [actual,expected] of [[layout.scene.x,0],[layout.scene.y,0],[layout.scene.width,layout.root.width],[layout.scene.height,layout.root.height]])assert(Math.abs(actual-expected)<=1,'The scene must fill the logical viewport: '+JSON.stringify(layout));
   assert(layout.left.x+layout.left.width<layout.right.x,'Auxiliary HUD must remain left of driving instruments: '+JSON.stringify(layout));
   let heroMapOverlap=null;
   if(size.layout==='landscape'&&size.width>size.height){
    const hero=await page.evaluate(()=>__trainDriver.test.heroRect()),map=await page.locator('#routeMap').boundingBox();
    assert(map,'Route map must be visible');
    heroMapOverlap=Math.max(0,Math.min(hero.right,map.x+map.width)-Math.max(hero.left,map.x))*Math.max(0,Math.min(hero.bottom,map.y+map.height)-Math.max(hero.top,map.y));
    assert.equal(heroMapOverlap,0,'Recommended train framing must stay clear of the route map: '+JSON.stringify({size,hero,map}));
   }
   await page.screenshot({path:out+'/'+size.width+'-'+size.height+'-'+size.layout+'.png',timeout:30000});
   checks.push({size,distanceFont,minimumDistanceFont,controlsInBounds:true,toolbarOverlap:overlap,heroMapOverlap,...layout});
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
   await page.locator('#'+mode+'View').click();await freeze();
   await assertView(mode,recommended(mode),'Unrestored '+mode+' uses the recommendation');
   assert.equal(await page.locator('#restoreView').isVisible(),true);
   await inBounds('restoreView');
   await assertToolsClear('Saved-view return must not overlap the game toolbar on the small screen');
   // Recommending an already-default camera must not overwrite its pending backup.
   await page.locator('#resetView').click();await freeze();
   assert.deepEqual((await stored()).backups[mode],legacy.profiles[mode]);
   await page.locator('#restoreView').click();await freeze();
   await assertView(mode,legacy.profiles[mode],'Restored '+mode+' is exact');
   assert.equal(await page.locator('#restoreView').isVisible(),false);
   assert.equal(Object.hasOwn((await stored()).backups,mode),false);
   assert.deepEqual((await stored()).archivedBackups,expectedArchives);
   const restored=await stored();
   await reopen();
   assert.deepEqual(await stored(),restored,'A restored profile must survive reopening without another migration');
   await assertView(mode,legacy.profiles[mode],'Reopened restored '+mode);
   await resume();
   await assertView(mode,legacy.profiles[mode],'Continuing the saved game preserves restored '+mode);
   // The new recommendation remains reversible after using an old locked view.
   await page.locator('#resetView').click();await freeze();
   await assertView(mode,recommended(mode),'Explicit recommendation for '+mode);
   assert.deepEqual((await stored()).backups[mode],legacy.profiles[mode]);
   assert.equal(await page.locator('#restoreView').isVisible(),true);
   await inBounds('restoreView');
   await assertToolsClear('Recommended-view return must stay clear of the game toolbar');
   await page.locator('#restoreView').click();await freeze();
   await assertView(mode,legacy.profiles[mode],'Explicit recommendation undo for '+mode);
  }

  // Save later adjustments through real pointer/wheel/lock input, rather than a
  // fixture write. Neither subsequent visits nor layout changes may replace them.
  const adjusted={};
  for(const mode of MODES){
   await page.setViewportSize(mode==='landscape'?{width:844,height:390}:{width:390,height:700});
   await page.locator('#'+mode+'View').click();await freeze();
   await page.locator('#lockView').click();
   assert.equal((await state()).viewSettings.locked,false);
   const before=profile((await state()).viewSettings),scene=await page.locator('#gameScene').boundingBox(),x=scene.x+scene.width*.57,y=scene.y+scene.height*.55;
   await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y-20,{steps:5});await page.mouse.up();
   await page.mouse.wheel(0,-100);
   await page.waitForFunction(zoom=>__trainDriver.getState().viewSettings.zoom>zoom,before.zoom,{polling:50});
   await page.locator('#lockView').click();await freeze();
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
   await page.locator('#'+mode+'View').click();await freeze();
   await assertView(mode,adjusted[mode],'Independent adjusted '+mode+' remains saved');
  }
  assert.deepEqual((await stored()).backups,{});
  assert.deepEqual((await stored()).archivedBackups,expectedArchives);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/result.json',JSON.stringify({status:'passed',engine,url:base,frameRevision:VIEW_REVISION,checks,oneTimeMigration:true,oldLockedViewsPreserved:true,earlierBackupsRetained:true,reopenDoesNotOverwrite:true,restoreExact:true,restoredViewsSurviveReopen:true,recommendedViewCanBeUndone:true,newUserAdjustmentsPreserved:true,errors},null,2));
 }catch(error){
  fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(error),checks,errors,state:await state().catch(()=>null),stored:await stored().catch(()=>null)},null,2));
  try{await page.screenshot({path:out+'/failure.png',timeout:5000});}catch{}
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
