/* R09 real browser evidence: preserve R08 throttle boxes and visible rings, clear
 * gaps, viewport containment, edge hit tests, native throttle/brake/platform
 * input. Run with TRAIN_BROWSER=chromium|webkit and TRAIN_GAME_URL=<game URL>.
 * This fixture is test-only; it is never imported by the shipped game. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright');
const {clickControl, clickTarget, controlGeometry, assertControlGeometry} = require('./browser-controls.cjs');
const engine = process.env.TRAIN_BROWSER || 'chromium';
const base = process.env.TRAIN_GAME_URL || 'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';
const out = process.env.R09_CONTROLS_OUT || `r09-controls-${engine}`;
const marker = '/* R09 · The first driving control';
const ids = ['pause', 'accelerate', 'decelerate', 'brake', 'stationAction'];
const cameraNames = ['platform', 'overview', 'front', 'rear', 'detail'];
const pinnedBaseline = fs.readFileSync(path.join(__dirname, '../r08/game.css'), 'utf8');
const cases = [
  {name:'desktop-2048', width:2048, height:1016},
  {name:'desktop-2560', width:2560, height:1336, dpr:2},
  {name:'desktop-1440', width:1440, height:900},
  {name:'tablet-1024', width:1024, height:768, touch:true},
  {name:'landscape-844', width:844, height:390, touch:true},
  {name:'landscape-768-tall', width:768, height:768, touch:true},
  {name:'landscape-600', width:600, height:360, touch:true},
  {name:'landscape-568', width:568, height:320, touch:true},
  {name:'forced-landscape-390', width:390, height:844, touch:true},
  {name:'forced-landscape-320', width:320, height:690, touch:true},
  {name:'portrait-390', width:390, height:844, touch:true, portrait:true},
  {name:'portrait-375', width:375, height:667, touch:true, portrait:true},
  {name:'portrait-359', width:359, height:690, touch:true, portrait:true},
  {name:'portrait-360', width:360, height:690, touch:true, portrait:true},
  {name:'portrait-320', width:320, height:690, touch:true, portrait:true},
  {name:'portrait-desktop', width:1024, height:900, portrait:true}
];
// Rendering can otherwise make input waits slow in software WebGL. Stop the
// frame loop only after genuine start/layout actions and a stable first stop.
const harness = `\nwindow.__r09Controls = {
  freeze: () => { window.requestAnimationFrame = () => 0; },
  refresh: () => { updateHUD(game.view()); return game.view(); },
  step: n => { game.stepTicks(n); const v=game.view(); events(v); draw(v,1,true); updateHUD(v); return v; },
  state: () => game.view()
};\n`;
fs.mkdirSync(out, {recursive:true});
const checks = [], errors = [];
function near(actual, expected, message, tolerance=.08) {
  assert(Math.abs(actual-expected)<=tolerance, `${message}: ${actual} versus ${expected}`);
}
function separation(a, b) {
  return Math.max(b.x-a.x-a.width, a.x-b.x-b.width, b.y-a.y-a.height, a.y-b.y-b.height);
}
async function measure(page) {
  return page.evaluate(ids => {
    function rect(el) {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}
    const buttons=Object.fromEntries(ids.map(id=>{
      const el=document.getElementById(id), s=getComputedStyle(el), ring=getComputedStyle(el,'::after');
      const icon=el.querySelector('.rail-control-icon');
      return [id,{...rect(el),cssWidth:parseFloat(s.width),cssHeight:parseFloat(s.height),
        transform:s.transform,ring:{width:parseFloat(ring.width)+parseFloat(ring.borderLeftWidth)+parseFloat(ring.borderRightWidth),height:parseFloat(ring.height)+parseFloat(ring.borderTopWidth)+parseFloat(ring.borderBottomWidth)},icon:icon?rect(icon):null}];
    }));
    return {buttons,root:rect(document.getElementById('driverGame')),panel:rect(document.getElementById('drivePanel')),
      panelCssHeight:parseFloat(getComputedStyle(document.getElementById('drivePanel')).height),
      layout:document.getElementById('driverGame').dataset.layout,
      rotated:document.getElementById('driverGame').dataset.rotated,
      viewport:[innerWidth,innerHeight]};
  },ids);
}
async function setSheet(page, css) {
  await page.evaluate(css => {
    document.querySelector('link[rel=stylesheet][href*="game.css"]').disabled=true;
    let el=document.getElementById('r09-geometry-sheet');
    if(!el){el=document.createElement('style');el.id='r09-geometry-sheet';document.head.append(el);}
    el.textContent=css;
  },css);
}
async function edgeEvidence(page, id) {
  return page.evaluate(id => {
    const el=document.getElementById(id),r=el.getBoundingClientRect();
    // Screen-space cardinal edges also work when the entire game is rotated.
    const points=[['left',r.left+3,r.top+r.height/2],['right',r.right-3,r.top+r.height/2],
      ['top',r.left+r.width/2,r.top+3],['bottom',r.left+r.width/2,r.bottom-3]];
    return points.map(([edge,x,y])=>{const hit=document.elementFromPoint(x,y);return {edge,x,y,hit:hit?.closest('button')?.id||hit?.id||null,reachable:hit===el||el.contains(hit)};});
  },id);
}
async function nativeAt(page, point, touch) {
  if(touch) await page.touchscreen.tap(point.x,point.y);
  else await page.mouse.click(point.x,point.y);
}
(async()=>{
  assert(['chromium','webkit'].includes(engine),'Unsupported TRAIN_BROWSER');
  const launchOptions = process.env.TRAIN_BROWSER_EXECUTABLE ? {executablePath:process.env.TRAIN_BROWSER_EXECUTABLE} : {};
  const browser=await({chromium,webkit})[engine].launch(launchOptions);
  let context,page,currentCase;
  try {
    for(const spec of cases) {
      currentCase=spec.name;
      context=await browser.newContext({viewport:{width:spec.width,height:spec.height},deviceScaleFactor:spec.dpr||1,hasTouch:!!spec.touch});
      page=await context.newPage();
      page.setDefaultTimeout(30000);
      page.on('pageerror',e=>errors.push({case:spec.name,message:e.message}));
      await page.route('**/game/app.mjs',async route=>{
        const response=await route.fetch();
        await route.fulfill({response,body:(await response.text())+harness});
      });
      await page.goto(base,{waitUntil:'load'});
      await page.waitForFunction(()=>window.__trainDriver?.ready,{timeout:60000});
      // Read the CSS actually served at the tested URL, so evidence also applies
      // when this script is pointed at the deployed Pages build.
      const candidate=await page.evaluate(async()=>{
        const href=document.querySelector('link[rel=stylesheet][href*="game.css"]').href;
        const r=await fetch(href,{cache:'no-store'});if(!r.ok)throw new Error('Cannot read served CSS: '+r.status);return r.text();
      });
      const boundary=candidate.indexOf(marker);
      assert(boundary>0,'R09 CSS marker missing from served build');
      const baseline=candidate.slice(0,boundary);
      assert.equal(baseline.trimEnd(),pinnedBaseline.trimEnd(),'The comparison prefix must match the preserved R08 CSS');
      await clickTarget(page,'#startGame',{touch:!!spec.touch});
      if(spec.portrait) await clickControl(page,'portraitView',{touch:!!spec.touch});
      await page.waitForFunction(()=>__trainDriver.getState().station.canOpen,{timeout:60000,polling:50});
      await page.evaluate(()=>__r09Controls.freeze());
      await page.waitForTimeout(250);
      await page.evaluate(()=>__r09Controls.refresh());
      await setSheet(page,baseline);
      const before=await measure(page);
      await setSheet(page,candidate);
      const after=await measure(page);
      const ratios={};
      for(const id of ['accelerate','decelerate']) {
        const a=before.buttons[id],b=after.buttons[id];
        for(const dimension of ['width','height']) {
          near(b[dimension],a[dimension],`${spec.name}/${id}/${dimension} screen rectangle`);
          near(b.ring[dimension],a.ring[dimension],`${spec.name}/${id}/${dimension} visible ring`,1.1);
          near(b.icon[dimension],a.icon[dimension],`${spec.name}/${id}/${dimension} SVG`);
        }
        near(b.cssWidth,a.cssWidth,`${spec.name}/${id}/CSS width`);
        near(b.cssHeight,a.cssHeight,`${spec.name}/${id}/CSS height`);
        assert.equal(b.transform,'none','Do not use scale() to fake a larger touch target');
        ratios[id]={width:b.width/a.width,height:b.height/a.height,cssWidth:b.cssWidth/a.cssWidth,cssHeight:b.cssHeight/a.cssHeight};
      }
      assert.equal(await page.locator('#drivePanel button').first().getAttribute('id'), 'pause', 'Pause is the first driving control in DOM order');
      assert.equal(await page.locator('#pause').count(), 1, 'Exactly one pause toggle');
      assert.equal(await page.locator('#pauseIcon').count(), 1, 'Stable pause icon span');
      assert.equal(await page.locator('#pauseLabel').count(), 1, 'Stable pause label span');
      assert(after.buttons.pause.cssWidth >= 64 && after.buttons.pause.cssHeight >= 99, 'Pause is a large full-height driving target');
      const pauseRing=after.buttons.pause.ring;
      near(pauseRing.width,pauseRing.height,'Pause visual is a circle');
      assert.equal(await page.locator('#pause').evaluate(el=>getComputedStyle(el,'::after').borderRadius),'50%','Pause has a circular visible ring');
      assert.equal(await page.locator('#cameraPositions').isVisible(),false,'Camera strip is absent from the driving scene');
      assert.equal(await page.locator('#cameraPositions').evaluate(el=>!!el.closest('#settingsScreen')),true,'Five camera choices live in settings');
      const menuOpener=await controlGeometry(page.locator('#openCameraMenu'));
      assertControlGeometry(menuOpener);
      assert(menuOpener.width>=44&&menuOpener.height>=44,'Camera menu shortcut has a 44px target');
      const cameraGeometry={};
      const gaps=[];
      for(let i=0;i<ids.length;i++) {
        const geometry=await controlGeometry(page.locator('#'+ids[i]));
        assertControlGeometry(geometry);
        assert(geometry.width>=44&&geometry.height>=44,`${ids[i]} minimum touch dimensions`);
        for(let j=i+1;j<ids.length;j++) {
          const gap=separation(after.buttons[ids[i]],after.buttons[ids[j]]);
          assert(gap>=7.9,`${spec.name}: controls overlap or lose their 8px clear gap: ${ids[i]} / ${ids[j]} = ${gap}`);
          gaps.push({pair:[ids[i],ids[j]],gap});
        }
      }
      if(spec.portrait) {
        assert(after.buttons.brake.y>=after.buttons.accelerate.y+after.buttons.accelerate.height+11.9,'Portrait uses two separate rows');
        near(after.buttons.pause.y, after.buttons.accelerate.y, 'Pause starts first row');
        assert(after.buttons.pause.x+after.buttons.pause.width+7.9<=after.buttons.accelerate.x,'Pause precedes accelerate visually');
        assert(after.panelCssHeight<=192.1,'Portrait controls must remain a shallow transparent two-row panel');
      } else assert(after.panelCssHeight<=183.1,'Landscape controls remain one row');
      const edges={},clicks=[];
      edges.pause=await edgeEvidence(page,'pause');
      for(const point of edges.pause) {
        assert(point.reachable, `${spec.name}/pause/${point.edge} is reachable`);
        await nativeAt(page,point,!!spec.touch);
        assert.equal(await page.evaluate(()=>__r09Controls.state().paused),true,'Native Pause edge pauses');
        assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'true','Paused state is announced');
        assert.equal(await page.locator('#pauseLabel').textContent(),'继续','Same button becomes Continue');
        assertControlGeometry(await controlGeometry(page.locator('#pause')));
        const elapsed=await page.evaluate(()=>__r09Controls.step(12).elapsed);
        await page.waitForTimeout(50);
        assert.equal(await page.evaluate(()=>__r09Controls.step(12).elapsed),elapsed,'Paused simulation time stays frozen');
        await nativeAt(page,point,!!spec.touch);
        assert.equal(await page.evaluate(()=>__r09Controls.state().paused),false,'Same native edge resumes');
        assert.equal(await page.locator('#pause').getAttribute('aria-pressed'),'false','Resumed state is announced');
        assert.equal(await page.locator('#pauseLabel').textContent(),'暂停','Pause label restored');
      }
      await page.evaluate(()=>__r09Controls.refresh());
      for(const id of ['accelerate','decelerate']) {
        edges[id]=await edgeEvidence(page,id);
        for(const point of edges[id]) {
          assert(point.reachable,`${spec.name}/${id}/${point.edge} intercepted by ${point.hit}`);
          const old=await page.evaluate(()=>__r09Controls.state().throttle);
          await nativeAt(page,point,!!spec.touch);
          const next=await page.evaluate(()=>__r09Controls.refresh().throttle);
          assert.equal(next,old+(id==='accelerate'?1:-1),`${spec.name}/${id}/${point.edge} native input changes throttle exactly once`);
          clicks.push({id,edge:point.edge,from:old,to:next,input:spec.touch?'touch':'mouse'});
          await clickTarget(page,id==='accelerate'?'#decelerate':'#accelerate',{touch:!!spec.touch});
          assert.equal(await page.evaluate(()=>__r09Controls.refresh().throttle),old,'Opposite control restores throttle');
        }
      }
      for(const id of ['brake','stationAction']) {
        edges[id]=await edgeEvidence(page,id);
        assert(edges[id].every(point=>point.reachable), `${spec.name}/${id}: every border edge remains reachable`);
      }
      const cameraClicks=[];
      for(const name of cameraNames) {
        await clickTarget(page,'#openCameraMenu',{touch:!!spec.touch});
        await page.locator('#settingsScreen').waitFor({state:'visible'});
        for(const other of cameraNames) {
          const g=await controlGeometry(page.locator(`[data-camera="${other}"]`));
          assertControlGeometry(g);
          assert(g.width>=44&&g.height>=44, `${spec.name}/${other}: camera target >=44 CSS pixels`);
          cameraGeometry[other]=g;
        }
        await clickTarget(page, `[data-camera="${name}"]`, {touch:!!spec.touch});
        await page.locator('#settingsScreen').waitFor({state:'hidden'});
        assert.equal(await page.locator(`[data-camera="${name}"]`).getAttribute('aria-pressed'),'true',`${name}: native camera tap selects viewpoint`);
        assert.equal(await page.evaluate(()=>__r09Controls.state().paused),false,'Selecting a camera returns to driving');
        assert.equal(await page.locator('#cameraPositions').isVisible(),false,'Camera choices hide after selection');
        cameraClicks.push(name);
      }
      const brake=await controlGeometry(page.locator('#brake'));
      await page.mouse.move(brake.x,brake.y);await page.mouse.down();
      assert.equal(await page.evaluate(()=>__r09Controls.refresh().brake),true,'Native held brake engages');
      await page.mouse.up();
      assert.equal(await page.evaluate(()=>__r09Controls.refresh().brake),false,'Native brake release clears');
      const beforePlatform=await page.evaluate(()=>__r09Controls.state().phase);
      await page.screenshot({path:path.join(out,spec.name+'-controls.png'),timeout:60000,animations:'disabled'});
      await clickTarget(page,'#stationAction',{touch:!!spec.touch});
      assert.equal(await page.evaluate(()=>__r09Controls.refresh().phase),'doors-opening','Native platform action opens doors');
      const evidence={case:spec,before,after,ratios,gaps,edges,clicks,cameraGeometry,cameraClicks,pause:true,brake:true,platform:{from:beforePlatform,to:'doors-opening'}};
      checks.push(evidence);
      fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:false,inProgress:true,engine,checks,errors},null,2));
      console.log(spec.name+': '+['accelerate','decelerate'].map(id=>{
        const a=before.buttons[id],b=after.buttons[id];return `${id} ${a.cssWidth.toFixed(2)}×${a.cssHeight.toFixed(2)} → ${b.cssWidth.toFixed(2)}×${b.cssHeight.toFixed(2)}`;
      }).join('; '));
      await context.close();context=null;
    }
    assert.deepEqual(errors,[],'No page runtime errors');
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({pass:true,engine,checks,errors},null,2));
  } catch(error) {
    if(page) await page.screenshot({path:path.join(out,'failure.png'),timeout:60000}).catch(()=>{});
    fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({pass:false,engine,case:currentCase,error:String(error),stack:error.stack,checks,errors},null,2));
    throw error;
  } finally {if(context)await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
