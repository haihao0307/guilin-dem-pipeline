// Same original R3.12 wall, same legacy controller bindings and camera matrices.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');const {chromium}=require('playwright');
const ROOT=process.cwd(),GAME='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01',OUT=path.resolve('room-native-material-results');fs.mkdirSync(OUT,{recursive:true});const app=path.join(ROOT,GAME,'app.mjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),appHash=hash(fs.readFileSync(app));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};const server=http.createServer((req,res)=>{let f=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(404);res.end()}});
(async()=>{let browser;const receipt={commit:process.env.GITHUB_SHA,host:GAME,version:'Brick Mother R3.12',mode:'legacy actual bindings',errors:[]};try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});page.on('pageerror',e=>receipt.errors.push(String(e)));await page.route(origin+'/'+GAME+'/app.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',body:'// isolated original-material check'}));await page.goto(origin+'/'+GAME+'/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async base=>{
  const THREE=await import(base+'/../../vendor/three.module.js');const {createR312Wall}=await import(base+'/room-unit-r02/r312-wall/r312-wall.mjs');const {createR312RawBaseline}=await import(base+'/room-unit-r02/r312-wall/raw-baseline.mjs');
  const w=600,h=450,canvas=()=>{const c=document.createElement('canvas');c.width=w;c.height=h;document.body.append(c);return c};const camera=new THREE.PerspectiveCamera(36,w/h,.012,60);camera.position.set(-4,2.7,-6.5);camera.lookAt(0,1.4,0);camera.updateMatrixWorld();
  const viewProj=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),vd=new THREE.Vector3();camera.getWorldDirection(vd);const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);const frame={viewProj:viewProj.elements,camera:camera.position.toArray(),viewDir:vd.toArray(),right:right.toArray(),up:up.toArray(),parameters:{seed:312,bindingMode:'legacy',door:null,mode:'wall'}};
  const a=canvas(),gl=a.getContext('webgl2',{antialias:true,alpha:false,depth:true,preserveDrawingBuffer:true});const raw=createR312RawBaseline({gl});gl.viewport(0,0,w,h);gl.clearColor(.040,.047,.042,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);raw.draw(frame);gl.finish();const originalPNG=a.toDataURL(),rawPixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,rawPixels);const rawError=gl.getError();
  const b=canvas(),renderer=new THREE.WebGLRenderer({canvas:b,antialias:true,preserveDrawingBuffer:true});renderer.setSize(w,h,false);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(new THREE.Color().setRGB(.040,.047,.042),1);const gpuErrors=[];renderer.debug.onShaderError=(gl,p,v,f)=>gpuErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});
  const scene=new THREE.Scene(),wall=createR312Wall({THREE,...frame.parameters});scene.add(wall.group);renderer.render(scene,camera);const g=renderer.getContext();g.finish();const adaptedPNG=b.toDataURL(),pixels=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,pixels);const threeError=g.getError();let sum=0,max=0,changed=0,foreground=0;for(let i=0;i<pixels.length;i+=4){let d=0;for(let j=0;j<3;j++){const v=Math.abs(rawPixels[i+j]-pixels[i+j]);sum+=v;max=Math.max(max,v);d=Math.max(d,v)}if(d>2)changed++;if(rawPixels[i]>24||rawPixels[i+1]>24||rawPixels[i+2]>24)foreground++;}
  const stats={width:w,height:h,maeRGB:sum/(w*h*3),maxDifference:max,changedOver2:changed,foregroundPixels:foreground,rawCounters:raw.counters,rawProof:raw.proof,adapterProof:wall.proof,gpuErrors,rawError,threeError,drawCalls:renderer.info.render.calls,frame};
  wall.dispose();const door=createR312Wall({THREE,seed:312,bindingMode:'legacy',door:{x:0,bottom:0,width:.9,height:2.05}});scene.add(door.group);renderer.render(scene,camera);g.finish();const doorPNG=b.toDataURL();stats.doorProof=door.proof;stats.doorGPUError=g.getError();door.dispose();
  const checks=[],images=[];
  const probe=new THREE.Mesh(new THREE.PlaneGeometry(10,8),new THREE.MeshBasicMaterial({color:0x00ffff,side:THREE.DoubleSide,toneMapped:false}));probe.position.set(0,2,1.4);scene.add(probe);
  const projectRay=new THREE.Vector3(),ray=new THREE.Vector3(),cameraWorld=new THREE.Vector3();
  for(const item of [
   {name:'r312-declared-solid-front',position:[0,1.4,-6.5],opening:null},
   {name:'r312-declared-door-front',position:[0,1.4,-6.5],opening:{x:0,bottom:0,width:.9,height:2.05}},
   {name:'r312-declared-door-oblique',position:[-3,2.1,-5],opening:{x:0,bottom:0,width:.9,height:2.05}},
   {name:'r312-declared-room-plaster',position:[-3,2.1,-5],opening:{x:0,bottom:0,width:.9,height:2.05},plasterSize:[3.2,2.35],plasterCenter:[0,1.48]}
  ]){
   camera.position.fromArray(item.position);camera.lookAt(0,1.35,0);camera.updateMatrixWorld();const candidate=createR312Wall({THREE,seed:312,bindingMode:'declared',door:item.opening,...(item.plasterSize?{plasterSize:item.plasterSize,plasterCenter:item.plasterCenter}:{})});scene.add(candidate.group);renderer.render(scene,camera);g.finish();const buf=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,buf);let clearSamples=0,blockedSamples=0,solidSamples=0,solidCyanLeaks=0;
   camera.getWorldPosition(cameraWorld);
   for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    projectRay.set((px+.5)/w*2-1,(py+.5)/h*2-1,.5).unproject(camera);ray.copy(projectRay).sub(cameraWorld).normalize();if(ray.z<=0)continue;
    const crossings=[-.45,.45].map(z=>{const t=(z-cameraWorld.z)/ray.z;return{x:cameraWorld.x+ray.x*t,y:cameraWorld.y+ray.y*t}});
    const d=item.opening,inside=d&&crossings.every(p=>p.x>d.x-d.width/2+.045&&p.x<d.x+d.width/2-.045&&p.y>d.bottom+.06&&p.y<d.bottom+d.height-.06);
    const i=(py*w+px)*4,isCyan=buf[i]<5&&buf[i+1]>249&&buf[i+2]>249;
    if(inside){clearSamples++;if(!isCyan)blockedSamples++;}
    if(!d&&crossings.every(p=>Math.abs(p.x)<1.6&&p.y>.25&&p.y<2.7)){solidSamples++;if(isCyan)solidCyanLeaks++;}
   }
   checks.push({name:item.name,parameters:candidate.parameters,proof:candidate.proof,clearSamples,blockedSamples,solidSamples,solidCyanLeaks,gpuError:g.getError(),drawCalls:renderer.info.render.calls});images.push({name:item.name,png:b.toDataURL()});candidate.dispose();
  }
  stats.declaredChecks=checks;return {originalPNG,adaptedPNG,doorPNG,images,stats};
 },origin+'/'+GAME);
 for(const [n,d] of [['r312-original-workbench',result.originalPNG],['r312-three-adapted',result.adaptedPNG],['r312-door-geometry-adapter',result.doorPNG]])fs.writeFileSync(path.join(OUT,n+'.png'),Buffer.from(d.split(',')[1],'base64'));
 for(const item of result.images)fs.writeFileSync(path.join(OUT,item.name+'.png'),Buffer.from(item.png.split(',')[1],'base64'));
 receipt.stats=result.stats;receipt.sourceAppUnchanged=hash(fs.readFileSync(app))===appHash;const s=result.stats;if(s.gpuErrors.length||s.rawError||s.threeError||s.doorGPUError||s.maeRGB>1||s.foregroundPixels<500||s.declaredChecks.some(c=>c.gpuError||c.blockedSamples>0||(c.parameters.door&&c.clearSamples<150)))throw Error('Wall source/adapter equivalence gate failed');receipt.passed=true;
 }catch(e){receipt.failure=String(e);process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'wall-equivalence-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));await browser?.close();server.close()}})();
