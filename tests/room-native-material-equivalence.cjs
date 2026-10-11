// Internal same-page renderer equivalence QA. No new site or host-entry edit.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const ROOT=process.cwd(),GAME='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01',OUT=path.resolve('room-native-material-results');fs.mkdirSync(OUT,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),app=path.join(ROOT,GAME,'app.mjs'),appHash=hash(fs.readFileSync(app));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{let f=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end();}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(404);res.end()}});
(async()=>{let browser;const receipt={commit:process.env.GITHUB_SHA,host:GAME,surface:'one original timber member',sourceVersion:'Library v3',changes:'renderer attribute/uniform bridge only',errors:[]};try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1100,height:850},deviceScaleFactor:1});page.on('pageerror',e=>receipt.errors.push(String(e)));
 // Only material modules are exercised. Prevent the unrelated existing game script from running.
 await page.route(origin+'/'+GAME+'/app.mjs',route=>route.fulfill({status:200,contentType:'text/javascript',body:'// Isolated material verification; original disk entry remains untouched.'}));
 await page.goto(origin+'/'+GAME+'/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async base=>{
  const THREE=await import(base+'/../../vendor/three.module.js');
  const O=await import(base+'/room-unit-r02/native/timber/original-core.mjs');
  const {WebGLTimberRenderer}=await import(base+'/room-unit-r02/native/timber/original-renderer.mjs');
  const {createTimberMember}=await import(base+'/room-unit-r02/native/timber/three-adapter.mjs');
  const w=960,h=960,make=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.style.width=w+'px';c.style.height=h+'px';document.body.append(c);return c};
  const camera=new THREE.PerspectiveCamera(32,1,.05,30);camera.position.set(2.2,1.65,3.6);camera.lookAt(0,1,0);camera.updateMatrixWorld();
  const recipe={id:'original-jamb',sourceId:'test-mother-01',seed:198107,length:2.05,height:.18,depth:.26,position:[0,1.025,0],rotation:[0,0,Math.PI/2],tessellation:{lengthSegments:28,crossSegments:4,endSegments:5},settings:{reliefMode:'inspection'}};
  const t=createTimberMember(THREE,recipe);t.mesh.updateMatrixWorld();
  const rawCanvas=make(),raw=new WebGLTimberRenderer(rawCanvas);raw.gl.viewport(0,0,w,h);
  const frame={preset:t.preset,settings:recipe.settings,view:camera.matrixWorldInverse.elements,projection:camera.projectionMatrix.elements,cameraPosition:camera.position.toArray(),debugMode:0};
  t.sourceMesh.model=t.mesh.matrixWorld.elements;
  let originalDrawCalls=0;const originalDraw=raw.draw;raw.draw=function(...args){originalDrawCalls++;return originalDraw.apply(this,args)};
  raw.beginFrame([.047,.053,.05,1]);raw.draw(t.sourceMesh,frame);raw.gl.finish();
  const originalPNG=rawCanvas.toDataURL('image/png'),rawPixels=new Uint8Array(w*h*4);raw.gl.readPixels(0,0,w,h,raw.gl.RGBA,raw.gl.UNSIGNED_BYTE,rawPixels);
  const threeCanvas=make(),renderer=new THREE.WebGLRenderer({canvas:threeCanvas,antialias:true,preserveDrawingBuffer:true});renderer.setSize(w,h,false);renderer.setPixelRatio(1);renderer.setClearColor(new THREE.Color().setRGB(.047,.053,.05),1);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  const gpuErrors=[];renderer.debug.onShaderError=(gl,p,vs,fs)=>gpuErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(vs),fragment:gl.getShaderInfoLog(fs)});
  const scene=new THREE.Scene();scene.add(t.mesh);let adapterBindCalls=0;const hook=t.mesh.onBeforeRender;t.mesh.onBeforeRender=(...args)=>{adapterBindCalls++;return hook(...args)};
  renderer.render(scene,camera);const gl=renderer.getContext();gl.finish();const adaptedPNG=threeCanvas.toDataURL('image/png'),threePixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,threePixels);
  let sum=0,max=0,changed=0,foreground=0;for(let i=0;i<rawPixels.length;i+=4){let d=0;for(let j=0;j<3;j++){const v=Math.abs(rawPixels[i+j]-threePixels[i+j]);sum+=v;max=Math.max(max,v);d=Math.max(d,v)}if(d>2)changed++;if(rawPixels[i]>24||rawPixels[i+1]>24||rawPixels[i+2]>24)foreground++;}
  const stats={width:w,height:h,maeRGB:sum/(w*h*3),maxChannelDifference:max,pixelsDifferenceOver2:changed,foregroundPixels:foreground,originalDrawCalls,adapterBindCalls,shaderVertexIdentical:t.mesh.material.vertexShader===O.vertexShaderSource.replace(/^#version 300 es\n/,''),shaderFragmentIdentical:t.mesh.material.fragmentShader===O.fragmentShaderSource.replace(/^#version 300 es\n/,''),originalGeometryUnchanged:O.createSubdividedBoxGeometry(recipe.length,recipe.height,recipe.depth,recipe.tessellation).positions.every((v,i)=>v===t.sourceMesh.geometry.positions[i]),gpuErrors,rawError:raw.gl.getError(),threeError:gl.getError(),renderer:gl.getParameter(gl.RENDERER),proof:t.proof,frame:{camera:camera.position.toArray(),target:[0,1,0],fov:32,originalLightingDefaults:true,settings:recipe.settings},uniformCount:Object.keys(t.mesh.material.uniforms).length};
  return {originalPNG,adaptedPNG,stats};
 },origin+'/'+GAME);
 for(const [name,data] of [['timber-v3-original-workbench',result.originalPNG],['timber-v3-three-adapted',result.adaptedPNG]])fs.writeFileSync(path.join(OUT,name+'.png'),Buffer.from(data.split(',')[1],'base64'));
 receipt.stats=result.stats;receipt.sourceAppUnchanged=hash(fs.readFileSync(app))===appHash;
 if(result.stats.gpuErrors.length||result.stats.rawError||result.stats.threeError||!result.stats.shaderVertexIdentical||!result.stats.shaderFragmentIdentical||!result.stats.originalGeometryUnchanged||result.stats.maeRGB>1||result.stats.foregroundPixels<500)throw Error('Original/adapted material equivalence gate failed');
 receipt.passed=true;
 }catch(e){receipt.failure=String(e);process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'timber-equivalence-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));await browser?.close();server.close()}})();
