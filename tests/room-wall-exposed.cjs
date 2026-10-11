// Same original R3.12 wall, same legacy controller bindings and camera matrices.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');const {chromium}=require('playwright');
const ROOT=process.cwd(),GAME='kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01',OUT=path.resolve('room-native-material-results');fs.mkdirSync(OUT,{recursive:true});const app=path.join(ROOT,GAME,'app.mjs'),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),appHash=hash(fs.readFileSync(app));
const mime={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'};const server=http.createServer((req,res)=>{let f=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end()}try{if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res)}catch{res.writeHead(404);res.end()}});
(async()=>{let browser;const receipt={commit:process.env.GITHUB_SHA,host:GAME,version:'Brick Mother R3.12',mode:'declared exposed-brick parameter candidate',errors:[]};try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});page.on('pageerror',e=>receipt.errors.push(String(e)));await page.route(origin+'/'+GAME+'/app.mjs',r=>r.fulfill({status:200,contentType:'text/javascript',body:'// isolated original-material check'}));await page.goto(origin+'/'+GAME+'/index.html',{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async base=>{
 const THREE=await import(base+'/../../vendor/three.module.js');const {createR312Wall}=await import(base+'/room-unit-r02/r312-wall/r312-wall.mjs');
 const w=600,h=450,b=document.createElement('canvas');b.width=w;b.height=h;document.body.append(b);
 const camera=new THREE.PerspectiveCamera(36,w/h,.012,60),renderer=new THREE.WebGLRenderer({canvas:b,antialias:true,preserveDrawingBuffer:true});renderer.setSize(w,h,false);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.setClearColor(0x111111,1);const gpuErrors=[];renderer.debug.onShaderError=(gl,p,v,f)=>gpuErrors.push({program:gl.getProgramInfoLog(p),vertex:gl.getShaderInfoLog(v),fragment:gl.getShaderInfoLog(f)});const scene=new THREE.Scene(),g=renderer.getContext();
  const checks=[],images=[];
  const probe=new THREE.Mesh(new THREE.PlaneGeometry(10,8),new THREE.MeshBasicMaterial({color:0x00ffff,side:THREE.DoubleSide,toneMapped:false}));probe.position.set(0,2,1.4);scene.add(probe);
  const projectRay=new THREE.Vector3(),ray=new THREE.Vector3(),cameraWorld=new THREE.Vector3();
  for(const item of [
   {name:'r312-exposed-brick-front',position:[0,1.4,-6.5],opening:{x:0,bottom:0,width:.9,height:2.05}},
   {name:'r312-exposed-brick-oblique',position:[-3,2.1,-5],opening:{x:0,bottom:0,width:.9,height:2.05}}
  ]){
   camera.position.fromArray(item.position);camera.lookAt(0,1.35,0);camera.updateMatrixWorld();const candidate=createR312Wall({THREE,seed:312,bindingMode:'declared',proxyCulling:'adaptive',door:item.opening,showPlaster:false,materialFamily:0,layerReveal:[0,0,0,0,0],layerOut:[0,0,0,0,0],coreOffset:-.018,coreRelief:.002,coreMicro:0,soilColor:0,layerColors:Array(5).fill('#77736b')});scene.add(candidate.group);renderer.render(scene,camera);g.finish();const buf=new Uint8Array(w*h*4);g.readPixels(0,0,w,h,g.RGBA,g.UNSIGNED_BYTE,buf);let clearSamples=0,blockedSamples=0,solidSamples=0,solidCyanLeaks=0;
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
 return {images,checks,gpuErrors};
 },origin+'/'+GAME);
 for(const item of result.images)fs.writeFileSync(path.join(OUT,item.name+'.png'),Buffer.from(item.png.split(',')[1],'base64'));
 receipt.checks=result.checks;receipt.gpuErrors=result.gpuErrors;receipt.sourceAppUnchanged=hash(fs.readFileSync(app))===appHash;if(result.gpuErrors.length||result.checks.some(c=>c.gpuError||c.blockedSamples>0||c.clearSamples<150))throw Error('Exposed brick aperture gate failed');receipt.passed=true;
 }catch(e){receipt.failure=String(e);process.exitCode=1}finally{fs.writeFileSync(path.join(OUT,'wall-exposed-receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));await browser?.close();server.close()}})();
