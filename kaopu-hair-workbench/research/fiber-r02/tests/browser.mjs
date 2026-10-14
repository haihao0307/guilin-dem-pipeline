import {chromium} from 'playwright';import fs from 'node:fs';import crypto from 'node:crypto';
const url=process.argv[2], label=process.argv[3]||'candidate';if(!url)throw Error('URL required');
fs.mkdirSync('evidence',{recursive:true});const results=[],errors=[];
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});const page=await context.newPage();
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,data={})=>{results.push({name,pass,...data});console.log(pass?'PASS':'FAIL',name);if(!pass)throw Error(name);};
async function settled(n=4){await page.waitForFunction(n=>window.HAIR_LAB&&HAIR_LAB.snapshot().samples>=n,n,{timeout:180000});}
async function image(name){await settled(8);await page.screenshot({path:`evidence/${label}-${name}.jpg`,type:'jpeg',quality:85});const src=await page.evaluate(()=>HAIR_LAB.capture());const b=Buffer.from(src.split(',')[1],'base64');check(name+' real canvas nonempty',b.length>10000,{bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});return crypto.createHash('sha256').update(b).digest('hex');}
try{
 let t=Date.now();await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await settled();let initial=await page.evaluate(()=>HAIR_LAB.snapshot());check('R02 runtime',initial.version==='HAIR-FIBER-R02',{snapshot:initial,navigationReadyMS:Date.now()-t});
 const chestnut=await image('chestnut');const signature=initial.signature;
 for(const preset of['black','honey','silver']){await page.locator(`[data-material=${preset}]`).click();await settled();const snap=await page.evaluate(()=>HAIR_LAB.snapshot());check(preset+' keeps same geometry',snap.signature===signature&&snap.count===10000);const img=await image(preset);check(preset+' changes real render',img!==chestnut);}
 await page.locator('[data-material=chestnut]').click();await page.selectOption('#lighting','back');await image('backlight');
 await page.selectOption('#lighting','studio');await page.click('#macro');await image('macro');
 await page.click('#full');await page.locator('details').evaluate(e=>e.open=true);await page.selectOption('#mode','1');await settled();const r=await page.evaluate(()=>HAIR_LAB.capture());await page.selectOption('#mode','2');await settled();const tr=await page.evaluate(()=>HAIR_LAB.capture());check('reflection and transmission separable',r!==tr);
 await page.selectOption('#mode','0');await page.evaluate(()=>HAIR_LAB.setParam('shadowStrength',0));await settled();const noShadow=await page.evaluate(()=>HAIR_LAB.capture());await page.evaluate(()=>HAIR_LAB.setParam('shadowStrength',.52));await settled();check('deep opacity affects real render',noShadow!==await page.evaluate(()=>HAIR_LAB.capture()));
 await page.click('#reset');await settled();await page.click('#save');check('recipe written locally',await page.evaluate(()=>JSON.parse(localStorage.getItem('kaopu.hair.fiber-r02')).schema==='kaopu/hair-optics-specimen@1'));
 await page.locator('details').evaluate(e=>e.open=false);const c=page.locator('canvas'),box=await c.boundingBox();await page.mouse.move(box.x+box.width*.53,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.53+110,box.y+box.height*.5+12,{steps:5});await page.mouse.up();await image('rotated');
 await page.click('#full');await page.setViewportSize({width:390,height:844});await image('mobile-viewport');check('mobile viewport no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 let final=await page.evaluate(()=>HAIR_LAB.snapshot());check('no shader or runtime errors',errors.length===0&&final.errors.length===0,{errors,final});
 fs.writeFileSync(`evidence/${label}.json`,JSON.stringify({url,label,results,errors,final,mobile:'viewport only; not physical phone',gpu:'SwiftShader software renderer; not desktop GPU performance proof'},null,2));
}catch(e){await page.screenshot({path:`evidence/${label}-failure.jpg`,type:'jpeg',quality:80}).catch(()=>{});fs.writeFileSync(`evidence/${label}.json`,JSON.stringify({url,label,results,errors,failure:String(e)},null,2));throw e;}finally{await browser.close();}
