const {chromium,webkit}=require('playwright'),fs=require('fs');
(async()=>{const kind=process.argv[2],out='material-r16-repro/'+kind;fs.mkdirSync(out,{recursive:true});const browser=await ({chromium,webkit}[kind]).launch({headless:true,args:kind==='chromium'?['--use-angle=swiftshader','--enable-unsafe-swiftshader']:[]});
for(const [label,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1120,height:1000}]]){
 const page=await browser.newPage({viewport,deviceScaleFactor:1});page.setDefaultTimeout(180000);const errors=[],responses=[];
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(/\.frag|defaults|studio/.test(r.url()))responses.push([r.status(),r.url()]);});
 await page.goto('https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/?case=wet&qa=20261007',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.KAOPU_STUDIO?.ready);await page.waitForTimeout(500);
 await page.locator('#canvas').screenshot({path:out+'/'+label+'-wet-default.png',timeout:180000});
 const packet=await page.evaluate(()=>({state:KAOPU_STUDIO.getState(),packet:KAOPU_STUDIO.packet(),glError:KAOPU_STUDIO.glError(),error:document.querySelector('#error').textContent,pixels:(()=>{const a=KAOPU_STUDIO.pixels(),c=document.querySelector('#canvas'),i=(Math.floor(c.height/2)*c.width+Math.floor(c.width/2))*4;return{center:a.slice(i,i+4),range:[Math.min(...a.filter((_,i)=>i%4!==3).slice(0,20000)),Math.max(...a.filter((_,i)=>i%4!==3).slice(0,20000))]};})()}));
 fs.writeFileSync(out+'/'+label+'-wet-default.json',JSON.stringify({packet,errors,responses},null,2));
 for(const c of ['iq','volcanic','analytic','wet']){await page.evaluate(c=>{KAOPU_STUDIO.select(c,false);KAOPU_STUDIO.draw();},c);await page.locator('#canvas').screenshot({path:out+'/'+label+'-'+c+'-switch.png',timeout:180000});}
 await page.locator('#cameraReset').click();await page.locator('#canvas').screenshot({path:out+'/'+label+'-wet-camera-reset.png',timeout:180000});
 await page.close();
}
await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
