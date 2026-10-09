// Headed Chromium/X11 browser accelerators change the real browser zoom.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const out='r14-native-zoom',base=process.env.TRAIN_GAME_URL||'http://127.0.0.1:8765/kaopu-minigame-workbench/voxel-train-study/game/';fs.mkdirSync(out,{recursive:true});
const harness=`\nwindow.__r12Zoom={freeze(){requestAnimationFrame=()=>0;},ready(){game=new Session({line:'kcr1',seed:'KCR-0620'});game.command('start');game.activateStation(2);game.distance=game.station.target-.2;game.velocity=0;game.stopStable=1;$('startScreen').hidden=true;setPaused(false);resize();draw(game.view(),1,true);updateHUD(game.view());},state:()=>game.view()};`;
(async()=>{const browser=await chromium.launch({headless:false,args:['--window-size=2048,1120','--window-position=0,0']});let page;const checks=[],errors=[];try{
const context=await browser.newContext({viewport:null});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
await page.route('**/game/app.mjs',async route=>{const r=await route.fetch();await route.fulfill({response:r,body:await r.text()+harness})});await page.goto(base);await page.waitForFunction(()=>window.__trainDriver?.ready,{timeout:60000});await page.evaluate(()=>__r12Zoom.freeze());await page.waitForTimeout(200);
const wins=execFileSync('xdotool',['search','--onlyvisible','--class','chromium'],{encoding:'utf8'}).trim().split(/\s+/);assert(wins.length,'Visible Chromium window');const win=wins.at(-1);execFileSync('xdotool',['windowfocus','--sync',win]);
const key=(key)=>execFileSync('xdotool',['key','--clearmodifiers',key]);key('ctrl+0');
for(const goal of [1,1.25,1.5]){
if(goal>1){key('ctrl+plus');if(goal===1.25)key('ctrl+plus');}
await page.waitForFunction(goal=>Math.abs(devicePixelRatio-goal)<.02,goal,{timeout:5000});await page.evaluate(()=>__r12Zoom.ready());
const geometry=await page.evaluate(()=>({dpr:devicePixelRatio,viewport:[innerWidth,innerHeight],outer:[outerWidth,outerHeight],buttons:Object.fromEntries(['pause','accelerate','decelerate','brake','stationAction'].map(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height*.67;return[id,{x,y,rect:[r.x,r.y,r.width,r.height],hit:document.elementFromPoint(x,y)?.closest('button')?.id,disabled:el.disabled}]}))}));
for(const [id,p]of Object.entries(geometry.buttons)){assert.equal(p.hit,id);assert(p.x>0&&p.x<geometry.viewport[0]&&p.y>0&&p.y<geometry.viewport[1]);}
const p=geometry.buttons.stationAction;await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(200);await page.mouse.up();assert.equal(await page.evaluate(()=>__r12Zoom.state().phase),'doors-opening');
await page.screenshot({path:`${out}/native-zoom-${Math.round(goal*100)}.png`,timeout:60000});checks.push({goal,geometry,doorOpened:true});
}
assert.deepEqual(errors,[]);fs.writeFileSync(out+'/result.json',JSON.stringify({pass:true,checks,errors},null,2));
}catch(e){if(page)await page.screenshot({path:out+'/failure.png',timeout:60000}).catch(()=>{});fs.writeFileSync(out+'/failure.json',JSON.stringify({error:String(e),stack:e.stack,checks,errors},null,2));throw e;}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
