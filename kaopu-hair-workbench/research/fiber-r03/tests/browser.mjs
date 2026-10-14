import {chromium} from 'playwright';import fs from 'node:fs';import crypto from 'node:crypto';
const url=process.argv[2],label=process.argv[3]||'candidate';
if(!url)throw Error('URL missing');fs.mkdirSync('evidence',{recursive:true});
const results=[],errors=[],frames=[],images={};
const b=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const ctx=await b.newContext({viewport:{width:1100,height:820},deviceScaleFactor:1});const page=await ctx.newPage();
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const check=(name,pass,data={})=>{results.push({name,pass,...data});console.log(pass?'PASS':'FAIL',name);if(!pass)throw Error(name);};
async function draw(){return page.evaluate(()=>HAIR_LAB.renderFrame());}
async function capture(name,screenshot=true){
 const s=await page.evaluate(()=>HAIR_LAB.snapshot());
 const raw=await page.evaluate(()=>HAIR_LAB.capture()),buf=Buffer.from(raw.split(',')[1],'base64');
 const digest=crypto.createHash('sha256').update(buf).digest('hex');images[name]=digest;
 fs.writeFileSync(`evidence/${label}-${name}.png`,buf);
 const small=await page.evaluate(()=>{const c=document.querySelector('canvas'),d=document.createElement('canvas');d.width=240;d.height=350;const x=d.getContext('2d');x.drawImage(c,c.width*.25,c.height*.05,c.width*.5,c.height*.87,0,0,240,350);const pixels=x.getImageData(0,0,240,350).data;let n=0;for(let i=0;i<pixels.length;i+=4)if(Math.abs(pixels[i]-pixels[0])+Math.abs(pixels[i+1]-pixels[1])+Math.abs(pixels[i+2]-pixels[2])>24)n++;return {base64:d.toDataURL('image/jpeg',.7).split(',')[1],foreground:n};});
 fs.writeFileSync(`evidence/${label}-${name}-review.base64.txt`,small.base64+'\n');
 if(screenshot)await page.screenshot({path:`evidence/${label}-${name}-page.jpg`,type:'jpeg',quality:80,timeout:90000});
 check(name+' has actual hair pixels',small.foreground>400&&buf.length>10000,{bytes:buf.length,sha256:digest});
 frames.push({name,snapshot:s,sha256:digest});return digest;
}
try{
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>document.body.dataset.ready==='true'||document.body.dataset.failed==='true',null,{timeout:240000});
 await page.evaluate(()=>HAIR_LAB.setManual(true));
 let s=await page.evaluate(()=>HAIR_LAB.snapshot());check('exact R03 version and source',s.version==='HAIR-FIBER-R03-S1'&&s.source===process.env.GITHUB_SHA,{snapshot:s});
 check('same approved optical specimen',s.signature==='eaadb8b8'&&s.count===10000&&s.segments===80);
 const st=await capture('stable');await draw();check('single-frame exact repeat no stochastic grain evolution',st===await capture('stable-repeat',false));
 check('stable path not waiting for sixteen samples',(await page.evaluate(()=>HAIR_LAB.snapshot())).completed===1);
 await page.evaluate(()=>HAIR_LAB.setParam('path','legacy'));await draw();await capture('legacy-single');
 await page.evaluate(()=>HAIR_LAB.setParam('path','reference'));for(let i=0;i<32;i++)await draw();await capture('reference32');
 await page.evaluate(()=>HAIR_LAB.setParam('path','stable'));
 for(let i=0;i<10;i++){
  await page.evaluate(i=>HAIR_LAB.setCamera({yaw:.12+Math.sin(i*.43)*.10,pitch:.035+Math.sin(i*.19)*.035}),i);
  const snap=await draw();check('moving-camera-frame-'+i,snap.completed===1&&snap.completedRevision===snap.revision,{wallMS:snap.completedFrameWallMS.at(-1)});
  if([0,3,6,9].includes(i))await capture('camera-'+i,false);
 }
 await page.evaluate(()=>HAIR_LAB.setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]}));await draw();check('return to same view has no stale-frame trail',st===await capture('return-view',false));
 const before=await page.evaluate(()=>HAIR_LAB.snapshot().counters);
 // Exposures must not rebuild geometry or radiance. Use native UI path, not manual renderFrame.
 await page.evaluate(()=>HAIR_LAB.setManual(false));await page.evaluate(()=>HAIR_LAB.setParam('exposure',1.4));
 await page.waitForFunction(()=>HAIR_LAB.snapshot().completedRevision===HAIR_LAB.snapshot().revision,null,{timeout:120000});
 await page.evaluate(()=>HAIR_LAB.setManual(true));const after=await page.evaluate(()=>HAIR_LAB.snapshot().counters);
 check('exposure only changes display mapping',before.positions===after.positions&&before.radiance===after.radiance&&before.shadows===after.shadows&&before.geometry===after.geometry,{before,after});
 await page.evaluate(()=>HAIR_LAB.setParam('exposure',1.25));
 for(let i=0;i<6;i++){await page.evaluate(i=>HAIR_LAB.setParam('rotation',i*8),i);await draw();if([0,2,5].includes(i))await capture('light-'+i,false);}
 check('light movement changes current radiance',images['light-0']!==images['light-5']);
 await page.evaluate(()=>HAIR_LAB.setParam('rotation',0));
 for(const mat of['black','honey','silver']){await page.evaluate(m=>HAIR_LAB.setParam('material',m),mat);await draw();await capture(mat,false);check(mat+' preserves roots',(await page.evaluate(()=>HAIR_LAB.snapshot())).signature==='eaadb8b8');}
 await page.evaluate(()=>{HAIR_LAB.setParam('material','chestnut');HAIR_LAB.setParam('lighting','back');});await draw();await capture('backlight');
 await page.evaluate(()=>{HAIR_LAB.setParam('lighting','studio');HAIR_LAB.setCamera({yaw:.08,pitch:0,distance:.20,target:[.012,-.015,.006]});});await draw();await capture('macro');
 await page.evaluate(()=>HAIR_LAB.setCamera({yaw:.12,pitch:.035,distance:.66,target:[0,-.002,0]}));
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await draw();await capture('mobile-viewport');
 check('mobile viewport no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 check('no shader or runtime errors',errors.length===0&&(await page.evaluate(()=>HAIR_LAB.snapshot().errors)).length===0,{errors});
 const final=await page.evaluate(()=>HAIR_LAB.snapshot());
 fs.writeFileSync(`evidence/${label}.json`,JSON.stringify({url,label,results,frames,images,errors,final,motionCapture:'Ordered camera/light poses, ONE completed R03 draw per pose; no static settle. This is not a real-time FPS claim.',renderer:'SwiftShader software rasterizer; physical GPU and phone performance not measured',limits:['8-bin colour mixture approximation','81-node radiance interpolation','no temporal reprojection','no hair deformation or physics']},null,2));
}catch(e){const snapshot=await page.evaluate(()=>window.HAIR_LAB?.snapshot()).catch(()=>null);await page.screenshot({path:`evidence/${label}-failure.jpg`,type:'jpeg',quality:80,timeout:90000}).catch(()=>{});fs.writeFileSync(`evidence/${label}.json`,JSON.stringify({url,label,results,frames,images,errors,snapshot,failure:String(e)},null,2));throw e;}finally{await b.close();}
