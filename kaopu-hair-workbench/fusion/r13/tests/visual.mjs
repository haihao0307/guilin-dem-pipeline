import {chromium} from 'playwright';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../evidence/visual');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:1}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.argv[2],{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.lengthGroom?.diagnostics().ready&&!lengthGroom.diagnostics().busy,null,{timeout:240000});
 for(const style of ['textured-fringe','side-flow','curtain-layer']){
  await page.evaluate(style=>lengthGroom.preset(style),style);await page.evaluate(()=>lengthGroom.whenRendered());
  await page.evaluate(()=>lengthGroom.camera('three'));await page.evaluate(()=>lengthGroom.whenRendered());
  await page.screenshot({path:path.join(out,style+'.png'),timeout:180000});
  fs.writeFileSync(path.join(out,style+'.json'),JSON.stringify(await page.evaluate(()=>lengthGroom.diagnostics()),null,2));
 }
 if(errors.length)throw Error(errors.join('; '));
}catch(e){try{await page.screenshot({path:path.join(out,'FAILURE.png'),timeout:30000});fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({errors,error:String(e),state:await page.evaluate(()=>window.lengthGroom?.diagnostics())},null,2));}catch{}throw e;
}finally{await browser.close();}
