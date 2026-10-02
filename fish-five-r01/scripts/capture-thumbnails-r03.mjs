// Genuine single-specimen REST renders from the immutable R02 standalone; no asset replacement or image painting.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),source=path.join(root,'dist/KAOPU_FISH_UNIFIED_R02.html');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),sourceHtmlSha256=sha(fs.readFileSync(source));
const ids=['barracuda','herring','tuna-yellow-label','tuna-blue-label','colorful','picasso'];
const scoreManifest=JSON.parse(fs.readFileSync(path.join(root,'data/scores.json'),'utf8'));const sourceItems=new Map(scoreManifest.items.map(item=>[item.id,item]));
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const page=await browser.newPage({viewport:{width:512,height:256},deviceScaleFactor:1});const errors=[];page.on('pageerror',error=>errors.push(String(error)));
try{
 await page.goto(pathToFileURL(source).href);await page.waitForFunction(()=>globalThis.__FIVE_FISH__?.ready,undefined,{timeout:180000});
 await page.addStyleTag({content:'html,body{width:512px!important;height:256px!important;margin:0!important;overflow:hidden!important}.shell{display:block!important;height:256px!important}.top,.sidebar,.footer,.stage>:not(canvas):not(iframe){display:none!important}.stage{position:fixed!important;inset:0!important;width:512px!important;height:256px!important}#canvas{width:512px!important;height:256px!important}#barracudaViewport{width:512px!important;height:256px!important}'});
 const items=[];
 for(const id of ids){
  await page.evaluate(async id=>{const a=__FIVE_FISH__;a.state.group=false;a.state.playing=false;a.state.mode='rest';await a.select(id);},id);
  await page.waitForTimeout(120);
  const capture=await page.evaluate(id=>{
   const a=__FIVE_FISH__;a.state.playing=false;a.state.mode='rest';
   let canvas,snapshot;
   if(id==='barracuda'){
    const r=a.barracuda.api.renderer;r.setSchool(false);r.setMode('REST');r.resetAll();r.state.playing=false;r.state.paths=false;r.state.compare=false;r.state.eyes=true;r.camera.setView('left');r.camera.halfWidth=.58;r.camera.pitch=.06;r.camera.target=[0,.14,0];r.camera.zoom=1;r.camera.perspective=false;r.resize();r.uploadPoses();r.draw(0,0,r.canvas.width,r.canvas.height,true);r.gl.finish();canvas=r.canvas;snapshot={instances:1,sourceVertices:497701,sourceTriangles:964285,sourcePipeline:'R14 retained inside R02 standalone',mode:r.state.mode,sourceHead:a.manifest.buildSourceHead};
   }else{
    const actor=a.behavior.actors[0];actor.position=[0,0,0];actor.yaw=actor.pitch=actor.roll=0;actor.amplitude=actor.turnRate=0;actor.beatPhase=actor.finPhase=0;actor.finAngles={};actor.finWaves={};a.reference(false);a.updatePoses();
    const T=a.THREE,bounds=new T.Box3();for(const p of a.score.primitives){const points=a.sourcePositions(p,a.score);for(let j=0;j<points.length;j+=3)bounds.expandByPoint(new T.Vector3(points[j],points[j+1],points[j+2]));}
    const center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());a.renderer.setClearColor(0x10252f,1);a.renderer.setPixelRatio(1);a.renderer.setSize(512,256,false);a.camera.aspect=2;a.camera.updateProjectionMatrix();const height=Math.max(size.y/.76,size.x/(2*.86)),distance=height/(2*Math.tan(a.camera.fov*Math.PI/360))+size.z*.35;a.camera.position.set(center.x,center.y+distance*.035,center.z+distance);a.camera.lookAt(center);a.camera.updateMatrixWorld();a.renderer.render(a.scene,a.camera);a.renderer.getContext().finish();canvas=a.renderer.domElement;snapshot={instances:1,sourceVertices:a.score.primitives.reduce((n,p)=>n+p.positions.length/3,0),sourceTriangles:a.score.primitives.reduce((n,p)=>n+p.indices.length/3,0),sourcePipeline:'R02 original sampled carrier and frozen eyes',mode:'REST',sourceHead:a.manifest.buildSourceHead};
   }
   return {png:canvas.toDataURL('image/png'),uri:canvas.toDataURL('image/webp',.82),width:canvas.width,height:canvas.height,snapshot};
  },id);
  if(capture.width!==512||capture.height!==256)throw Error('Unexpected thumbnail canvas dimensions: '+id);
  const bytes=Buffer.from(capture.uri.split(',')[1],'base64'),png=Buffer.from(capture.png.split(',')[1],'base64');
  const item={id,uri:capture.uri,width:512,height:256,bytes:bytes.length,imageSha256:sha(bytes),renderedPngSha256:sha(png),sourceHtmlSha256,sourceScoreSha256:sourceItems.get(id)?.sha256||null,snapshot:capture.snapshot};items.push(item);console.log(id,bytes.length,item.imageSha256);
 }
 const payload={schema:'FISH_SCOREMAKER_REAL_SPECIMEN_THUMBNAILS_R03',capturedAt:new Date().toISOString(),sourceStandalone:'dist/KAOPU_FISH_UNIFIED_R02.html',sourceHtmlSha256,renderMode:'Single specimen REST; real WebGL source geometry, skin and frozen eyes',viewport:[512,256],mainViewportStillRealtime3D:true,noGeneratedImages:true,noAdditionalCardWebGLContexts:true,items,errors};
 const text=JSON.stringify(payload);if(Buffer.byteLength(text)>300000)throw Error('Thumbnail carrier exceeds compact 300KB budget');if(errors.length)throw Error('Thumbnail source page errors: '+errors.join(';'));
 fs.writeFileSync(path.join(root,'data/thumbnails-r03.json'),text+'\n');if(sha(fs.readFileSync(source))!==sourceHtmlSha256)throw Error('Immutable R02 source was modified during capture');console.log(JSON.stringify({bytes:Buffer.byteLength(text),count:items.length,sourceHtmlSha256,sourceUnchanged:true}));
}finally{await browser.close();}
