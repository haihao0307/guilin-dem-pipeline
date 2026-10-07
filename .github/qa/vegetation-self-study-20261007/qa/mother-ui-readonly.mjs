// Read-only UI audit of the verified existing public mother Site.
// No source archive retrieval, authentication, saving, export, or Site mutation.
import {chromium,webkit} from 'playwright';
import fs from 'node:fs';
const engine=process.env.BROWSER??'chromium',out=`qa-output/${engine}`,url='https://vegetation-workbench-rc16.sunhaihao.chatgpt.site';
fs.mkdirSync(out,{recursive:true});
const browser=await({chromium,webkit}[engine]).launch({headless:true,args:engine==='chromium'?['--use-angle=swiftshader']:[]});
const report={url,engine,readOnly:true,blockedNonReadRequests:[],errors:[],views:[],sourceArchiveRequested:false};
try {
 const page=await browser.newPage({viewport:{width:1600,height:1050},deviceScaleFactor:1,acceptDownloads:false});
 await page.route('**/*',async route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method())){report.blockedNonReadRequests.push({method:r.method(),url:r.url().split('?')[0]});return route.abort();}await route.continue();});
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('download',()=>report.errors.push('Unexpected download initiated by public page; not accepted'));
 const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});report.httpStatus=response?.status();
 await page.waitForTimeout(40000);
 async function inspect(name){const state=await page.evaluate(()=>({title:document.title,url:location.href,text:document.body.innerText.slice(0,45000),links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText,href:a.href})),buttons:[...document.querySelectorAll('button,[role=tab]')].map(b=>({text:b.innerText,aria:b.getAttribute('aria-label'),disabled:!!b.disabled})),canvas:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}))}));report.views.push({name,...state});await page.screenshot({path:`${out}/mother-ui-${name}.png`,fullPage:true});}
 await inspect('initial');
 const started=Date.now();report.initialisationReady=await page.waitForFunction(()=>{const b=document.querySelector('[data-action=mode-scene]');return b&&!b.disabled;},{},{timeout:240000}).then(()=>true,()=>false);report.additionalWaitMs=Date.now()-started;await inspect('settled');
 // Only switch an exact top-level view tab if it is present and visible.
 const scene=page.getByRole('button',{name:'Scene',exact:true});if(await scene.count()===1&&await scene.isVisible()&&await scene.isEnabled()){await scene.click();await page.waitForTimeout(2000);await inspect('scene');}
 const plant=page.getByRole('button',{name:'Plant',exact:true});if(await plant.count()===1&&await plant.isVisible()&&await plant.isEnabled()){await plant.click();await page.waitForTimeout(2000);await inspect('plant');}
 report.complete=report.initialisationReady;
} catch(e){report.complete=false;report.failure=e.stack;}
finally{fs.writeFileSync(`${out}/mother-ui-readonly.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
