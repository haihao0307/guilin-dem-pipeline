const fs=require('fs'),crypto=require('crypto'),{chromium}=require('playwright');
const phase=process.argv[2],stage=phase==='stage';
const base='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/';
const url=(stage?base+'lab-r09/':base)+'?case=home&v=r09';
const file=stage?'STAGE_PROOF.json':'PUBLICATION_PROOF.json';
const expected=stage?'ff434393a2ad68c87fa96266079cbdf8b55e6edaadc5e7905c55125cff95305d':'581ba66fffb396d1ea158e13de4a0013174c9607a91d923985349d2fad37bb5e';
const report={version:'R09',url,phase,environment:'Public HTTPS Chromium + ANGLE SwiftShader',desktop:{},mobile:{type:'390px Chromium viewport, not a physical phone'},errors:[],shareAllowed:false};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const assert=(x,m)=>{if(!x)throw Error(m);};
(async()=>{
 let found=false;for(let i=0;i<70;i++){try{const r=await fetch(url+'&probe='+Date.now(),{signal:AbortSignal.timeout(15000)});const bytes=Buffer.from(await r.arrayBuffer());if(r.status===200&&hash(bytes)===expected){report.httpStatus=200;report.indexSHA256=hash(bytes);found=true;break;}}catch(e){console.log(e.message);}await sleep(10000);}assert(found,'Exact public R09 version not available');
 const manifest=JSON.parse(fs.readFileSync('build_material_r09/manifest.json'));report.resources={};
 for(const[name,wanted]of Object.entries(manifest)){if(name==='index.html')continue;const r=await fetch(base+'lab-r09/'+name+'?r09='+Date.now(),{signal:AbortSignal.timeout(30000)}),bytes=Buffer.from(await r.arrayBuffer());assert(r.status===200&&hash(bytes)===wanted,'Resource differs: '+name);report.resources[name]=wanted;}
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050},deviceScaleFactor:1});page.setDefaultTimeout(120000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url,{waitUntil:'load',timeout:120000});await page.waitForFunction(()=>window.KAOPU9?.ready);
  assert(await page.locator('#catalog .case').count()===2,'Wrong case count');assert(await page.locator('iframe').count()===0,'Nested webpage found');report.desktop.twoCases=true;report.desktop.noIframe=true;
  await page.screenshot({path:'evidence/'+phase+'-home.png',fullPage:true});
  const pixelHash=()=>page.evaluate(()=>{KAOPU9.draw();let h=2166136261;for(const v of KAOPU9.pixels())h=Math.imul(h^v,16777619);return h>>>0;});
  for(const id of ['wet','iq']){
   await page.locator('nav [data-go='+id+']').click();await page.evaluate(()=>KAOPU9.reset());
   await page.locator('#compare').click();
   const eq=await page.evaluate(()=>{KAOPU9.draw();const a=KAOPU9.pixels('result'),b=KAOPU9.pixels('ref');let channels=0,max=0;for(let i=0;i<a.length;i++){let d=Math.abs(a[i]-b[i]);if(d)channels++;max=Math.max(max,d);}return{channels,max,resolution:[document.getElementById('resultCanvas').width,document.getElementById('resultCanvas').height]};});
   assert(eq.channels===0,id+' default differs from original frozen shader');report.desktop[id]={originalDefaultComparison:eq};
   await page.locator('[data-pane=ref][data-act=close]').click();await page.screenshot({path:'evidence/'+phase+'-'+id+'.png',fullPage:true});
   await page.evaluate(()=>KAOPU9.setResolution(320));let before=await pixelHash();
   await page.locator('[data-pane=result][data-act=in]').click();assert(await pixelHash()!==before,id+' zoom unchanged');await page.locator('[data-pane=result][data-act=reset]').click();assert(await pixelHash()===before,id+' reset changed baseline');report.desktop[id].zoomReset=true;
   await page.locator('[data-palette="4"]').click();assert(await pixelHash()!==before,id+' recolor ineffective');report.desktop[id].color=true;
   await page.locator('[data-pane=result][data-act=close]').click();assert(await page.locator('#closed').isVisible(),'Closed pane lost restore');await page.locator('#restoreWindows').click();assert(await page.locator('#resultPane').isVisible(),'Result not restored');await page.locator('[data-pane=ref][data-act=close]').click();report.desktop[id].closeRestore=true;
   const saved=await page.evaluate(()=>KAOPU9.getScore());await page.locator('nav [data-go=home]').click();assert(await page.locator('#workspace').isHidden(),'Home not restored');await page.locator('nav [data-go='+id+']').click();assert(JSON.stringify(saved)===JSON.stringify(await page.evaluate(()=>KAOPU9.getScore())),'Navigation loses parameters');report.desktop[id].navigationPreservesState=true;
   await page.evaluate(()=>KAOPU9.reset());
   if(stage){
    const colors=[];for(let i=0;i<10;i++){await page.locator('[data-palette="'+i+'"]').click();colors.push(await pixelHash());}assert(new Set(colors).size===10,id+' missing ten colors');report.desktop[id].tenColors=true;
    await page.evaluate(()=>KAOPU9.reset());
    if(id==='wet'){await page.locator('[data-effect=forest]').click();assert(await pixelHash()!==before,'Wet relief preset not active');report.desktop[id].forestPreset=true;}else{
     await page.locator('[data-seed="11"]').click();assert(await pixelHash()!==before,'Shape seed not active');await page.locator('#resetShape').click();assert(await pixelHash()===before,'Original shape not recovered');report.desktop[id].shapeSeedRestore=true;
     await page.locator('[data-path="layers.0.on"]').check();assert(await pixelHash()!==before,'Independent layer not active');report.desktop[id].layerToggle=true;
    }
   }
   await page.evaluate(()=>{KAOPU9.reset();KAOPU9.setResolution(960);});
  }
  const gl=await page.evaluate(()=>KAOPU9.glErrors());assert(gl.every(n=>n===0),'WebGL error');report.desktop.glErrors=gl;
  await page.setViewportSize({width:390,height:844});await page.locator('nav [data-go=home]').click();await page.screenshot({path:'evidence/'+phase+'-mobile.png',fullPage:true});
  report.mobile.noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);assert(report.mobile.noOverflow,'Mobile viewport overflow');await page.locator('nav [data-go=iq]').click();report.mobile.caseSwitchWorks=await page.locator('#resultPane').isVisible();assert(report.mobile.caseSwitchWorks,'Mobile case switching');
  assert(report.errors.length===0,'Page errors');report.browserPassed=true;report.shareAllowed=true;
 }finally{await browser.close();}
})().catch(e=>{report.failure=e.message;report.shareAllowed=false;process.exitCode=1;}).finally(()=>{report.checkedAt=new Date().toISOString();fs.mkdirSync('evidence',{recursive:true});fs.writeFileSync('evidence/'+file,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));});
