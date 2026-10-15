/* Immutable public SkinVariationDNA R01 Windows browser verification; not visual approval. */
const fs=require('fs'),crypto=require('crypto'),{chromium}=require('playwright'),{PNG}=require('pngjs');
const url=process.env.PREVIEW_URL,digest=process.env.EXPECTED_SHA256,out=process.env.QA_OUT||'public-evidence';
if(!url||!digest)throw Error('Need fixed public URL and digest');
fs.mkdirSync(out,{recursive:true});
const R={version:'SKIN-VARIATION-DNA-R01',url,complete:false,tests:[],screens:[],pageErrors:[],requests:[],http:[],console:[],
 scope:'Actual public desktop first frame, 7 semantic maps, 3 character presets, baseline A/B, same rig/lighting. Not visual quality acceptance.'};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const verify=(b,m)=>{if(!b)throw Error(m);};
const save=()=>fs.writeFileSync(out+'/QA.json',JSON.stringify(R,null,2));
const pass=(name,data)=>{R.tests.push({name,data,passed:true});save();};
let browser,page,cdp;
async function capture(name){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const b=Buffer.from((await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');
 const image=PNG.sync.read(b),rect=await page.locator('#canvas').boundingBox();
 verify(rect&&rect.width>600&&rect.height>600,'canvas bounding box unavailable');
 const x=Math.ceil(rect.x+10),y=Math.ceil(rect.y+170),w=Math.floor(rect.width-20),h=Math.floor(rect.height-280);
 verify(w>470&&h>470&&x+w<=image.width&&y+h<=image.height,'Crop outside canvas');
 const crop=Buffer.alloc(w*h*3);let k=0;
 for(let iy=y;iy<y+h;iy++)for(let ix=x;ix<x+w;ix++){const p=(iy*image.width+ix)*4;crop[k++]=image.data[p];crop[k++]=image.data[p+1];crop[k++]=image.data[p+2];}
 fs.writeFileSync(out+'/'+name+'.png',b);
 const meta={name,sha256:hash(b),canvasRGBHash:hash(crop),crop:{x,y,w,h}};
 R.screens.push(meta);save();return{...meta,cropRGB:crop};
}
async function geometry(){
 return page.evaluate(async()=>{
 const g=__IDENTITY_QA__.viewer().geometry;
 const sha=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
 return{position:await sha(g.attributes.position.array),index:await sha(g.index.array),vertices:g.attributes.position.count,triangles:g.index.count/3};
 });
}
const diff=(a,b)=>{
 verify(a.cropRGB.length===b.cropRGB.length,'incompatible image crops');
 let sum=0,peak=0,changed=0;
 for(let i=0;i<a.cropRGB.length;i+=3){let d=0;for(let c=0;c<3;c++){const v=Math.abs(a.cropRGB[i+c]-b.cropRGB[i+c]);sum+=v;d+=v;peak=Math.max(peak,v);}if(d/3>.5)changed++;}
 return{meanRGB:sum/a.cropRGB.length,peak,changedFraction:changed/(a.cropRGB.length/3)};
};
(async()=>{
 const raw=url.split('?')[1]||url,r=await fetch(raw),bytes=Buffer.from(await r.arrayBuffer());
 verify(r.ok,'Raw pinned HTML unavailable');verify(hash(bytes)===digest,'Raw pinned bytes mismatch');
 pass('pinned public content hash',{bytes:bytes.length,sha256:hash(bytes)});
 const win=process.platform==='win32',args=win?['--use-angle=d3d11-warp']:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 browser=await chromium.launch({channel:'chrome',headless:true,args});R.platform=process.platform;R.browser=browser.version();
 page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.setDefaultTimeout(120000);cdp=await page.context().newCDPSession(page);
 page.on('pageerror',e=>R.pageErrors.push(String(e)));
 page.on('requestfailed',r=>R.requests.push({url:r.url(),error:r.failure()}));
 page.on('response',r=>{if(r.status()>=400&&!/favicon\.ico/.test(r.url()))R.http.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{const loc=m.location();if(m.type()==='error'&&!/favicon\\.ico/.test(m.text())&&!/favicon\\.ico/.test(loc.url||''))R.console.push({text:m.text(),location:loc});});
 const t=Date.now();await page.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.skinVariationDNA_R01&&(skinVariationDNA_R01.report().ready||skinVariationDNA_R01.report().errors.length),null,{timeout:360000});
 R.startMS=Date.now()-t;R.initial=await page.evaluate(()=>skinVariationDNA_R01.report());
 verify(R.initial.ready&&R.initial.graphics.valid,'SkinVariationDNA first frame failed');
 verify(R.initial.field.textureLayers===7,'Expected native 7-layer array');
 verify(R.initial.variationDNA&&R.initial.variationDNA.eventCounts.follicleRoots>1000,'Shared follicles unavailable');
 verify(R.initial.variationDNA.sourcePixelsCopied===false,'Non-original texture pixels');
 verify(R.initial.variationDNA.vertexDisplacementImplemented===false,'Scar geometry claim mismatched');
 verify((await page.locator('[data-dna-param]').count())===14,'DNA sliders missing');
 await capture('first');pass('unassisted first frame and semantic field metadata',{driver:R.initial.graphics.driver,field:R.initial.field,variationDNA:R.initial.variationDNA});
 R.geometry=await geometry();
 verify(R.geometry.position==='f0a4cac701401c519fd4eb6e75fdef9e16173d3c11969b1217cd384627ccb634','Original vertex buffer changed');
 verify(R.geometry.index==='dde240f688ef10f61721ad12a35a3f79e410f9049a1d16361fdb669c6c7a95db','Original triangles changed');
 pass('unchanged native character geometry',R.geometry);
 // Same camera, frozen lighting and same identity: contrast the DNA switch only.
 await page.click('[data-ssg-view="macro"]');
 const diffs={};
 for(const name of ['young','adult','mature']){
  await page.selectOption('#dna-preset',name);
  const on=await capture(name+'-on');
  await page.evaluate(()=>skinVariationDNA_R01.setEnabled(false));
  const off=await capture(name+'-off');
  await page.evaluate(()=>skinVariationDNA_R01.setEnabled(true));
  const again=await capture(name+'-return');
  verify(on.canvasRGBHash===again.canvasRGBHash,name+': cannot restore exact ON frame');
  verify(on.canvasRGBHash!==off.canvasRGBHash,name+': toggle did not alter render');
  const delta=diff(on,off);verify(delta.peak>=2&&delta.changedFraction>0.0001,name+': invisible DNA mask');
  diffs[name]=delta;
 }
 pass('three presets: same-camera OFF / ON / exact return',diffs);
 const tri=await page.evaluate(()=>['young','adult','mature'].map(k=>({key:k,fields:Object.keys(KAOPU_SKIN_VARIATION_DNA_R01.presets[k]).length})));
 verify(tri.every(x=>x.fields===15),'Preset field mismatch');pass('three profiles share one schema',tri);
 await page.evaluate(()=>skinVariationDNA_R01.setPreset('adult'));
 for(let v=1;v<=7;v++){await page.evaluate(n=>skinVariationDNA_R01.debug(n),v);await capture('mask-'+v);}
 await page.evaluate(()=>skinVariationDNA_R01.debug(0));
 pass('seven semantic atlas mask views',true);
 const before=await page.evaluate(()=>skinVariationDNA_R01.archive());
 const atomic=await page.evaluate(()=>{const b=JSON.stringify(skinVariationDNA_R01.archive());try{const bad=skinVariationDNA_R01.archive();bad.settings.pie=99;skinVariationDNA_R01.restore(bad);return false;}catch{return b===JSON.stringify(skinVariationDNA_R01.archive());}});
 verify(atomic,'Invalid DNA recipe mutated current state');
 await page.evaluate(x=>skinVariationDNA_R01.restore(x),before);
 verify(JSON.stringify(await geometry())===JSON.stringify(R.geometry),'DNA changed geometry');
 pass('atomic invalid recipe rejection and geometric invariants',true);
 verify(!R.pageErrors.length&&!R.requests.length&&!R.http.length&&!R.console.length,'Runtime errors or blocked resources');
 pass('zero application errors and network failures',true);
 R.complete=true;
})().catch(async e=>{R.failure=String(e.stack||e);console.error(e);try{if(page){R.visibleText=(await page.locator('body').innerText()).slice(0,2000);await capture('FAILED');}}catch{}process.exitCode=1;}).finally(async()=>{save();await browser?.close();});
