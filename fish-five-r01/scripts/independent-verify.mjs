import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo=path.dirname(root),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const anchor=JSON.parse(fs.readFileSync(path.join(root,'TASK_ANCHOR.json')));
const html=path.join(root,'dist/KAOPU_FIVE_FISH_R01.html');
const frozenHash=sha(fs.readFileSync(html));
const failures=[],checks=[],check=(name,pass,detail)=>{checks.push({name,pass,detail});if(!pass)failures.push(name);};
const expectedArg=process.argv.find(x=>x.startsWith('--expected-html='));
if(expectedArg)check('coordinator-frozen-html-hash',expectedArg.slice(16)===frozenHash,{expected:expectedArg.slice(16),actual:frozenHash});
const files=['TASK_ANCHOR.json','src/app.js','src/behavior.js','src/workbench.template.html','scripts/prepare-sources.py','scripts/build.mjs',...anchor.targets.map(id=>'data/'+id+'.score.json.gz')];
const hashes=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const embedded=fs.readFileSync(html,'utf8');
for(const id of anchor.targets){const carrier=embedded.match(new RegExp('<script[^>]*id="score-'+id+'"[^>]*>([\\s\\S]*?)</script>'));check('frozen-html-source-payload-'+id,!!carrier&&sha(Buffer.from(carrier[1].trim(),'base64'))===hashes['data/'+id+'.score.json.gz'],{sourceScoreSha256:hashes['data/'+id+'.score.json.gz']});}
const python=String.raw`
import json, pathlib, zipfile, io, base64, gzip, posixpath, hashlib, urllib.parse
import numpy as np
from PIL import Image
root=pathlib.Path(__import__('sys').argv[1]);inv=json.loads((root.parent/'species-intake-r01/LOCAL_INVENTORY.json').read_text(encoding='utf8'))['models']
results=[]
for fish in ['herring','tuna-yellow-label','tuna-blue-label','colorful','picasso']:
 score=json.loads(gzip.decompress((root/'data'/f'{fish}.score.json.gz').read_bytes()))
 row=next(r for r in inv if r['sourceId']==score['source']['sourceId'])
 parts=row['container'].split('!');raw=pathlib.Path(parts[0]).read_bytes();containerOK=hashlib.sha256(raw).hexdigest()==row['containerSha256']
 for nested in parts[1:]:raw=zipfile.ZipFile(io.BytesIO(raw)).read(nested)
 archive=zipfile.ZipFile(io.BytesIO(raw));entry=row['entry'];g=json.loads(archive.read(entry));parent=posixpath.dirname(entry)
 def readuri(u):
  return base64.b64decode(u.split(',',1)[1]) if u.startswith('data:') else archive.read(posixpath.normpath(posixpath.join(parent,urllib.parse.unquote(u))))
 buffers=[readuri(b['uri']) for b in g['buffers']]
 dtypes={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'};widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
 def accessor(k):
  a=g['accessors'][k];w=widths[a['type']];dt=np.dtype(dtypes[a['componentType']]);v=g['bufferViews'][a['bufferView']]
  out=np.ndarray((a['count'],w),dtype=dt,buffer=buffers[v['buffer']],offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*dt.itemsize),dt.itemsize)).copy()
  if a.get('normalized') and dt.kind in 'iu':out=np.maximum(out.astype(float)/np.iinfo(dt).max,-1)
  return out
 def local(n):
  if 'matrix' in n:return np.array(n['matrix'],float).reshape((4,4),order='F')
  x,y,z,w=n.get('rotation',[0,0,0,1]);R=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
  out=np.eye(4);out[:3,:3]=R@np.diag(n.get('scale',[1,1,1]));out[:3,3]=n.get('translation',[0,0,0]);return out
 parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};world={}
 def wm(i):
  if i not in world:world[i]=(wm(parents[i]) if i in parents else np.eye(4))@local(g['nodes'][i])
  return world[i]
 canonical=score['canonical'];rotation=np.array(canonical['rotationRows']);offset=np.array(canonical['centerProjected']);L=canonical['sourceLength']
 sourceMax=0.;normalMax=0.;residualMax=0.;topologyOK=True;uvOK=True;materialOK=True;vertexCount=0;primitiveRows=[]
 for p in score['primitives']:
  node=g['nodes'][p['sourceNode']];mesh=g['meshes'][p['sourceMesh']]
  # Match source primitive by exact complete index sequence and accessor vertex count.
  matches=[q for q in mesh['primitives'] if g['accessors'][q['attributes']['POSITION']]['count']==len(p['positions'])//3 and np.array_equal(accessor(q['indices']).reshape(-1),p['indices'])]
  if len(matches)!=1:raise RuntimeError(f'{fish}: source primitive match not unique')
  q=matches[0];attrs=q['attributes'];P=accessor(attrs['POSITION']).astype(float);N=accessor(attrs['NORMAL']).astype(float)
  if 'skin' in node:
   skin=g['skins'][node['skin']];ib=accessor(skin['inverseBindMatrices']);joints=accessor(attrs['JOINTS_0']).astype(int);weights=accessor(attrs['WEIGHTS_0']).astype(float)
   bind=np.stack([wm(j)@ib[i].reshape((4,4),order='F') for i,j in enumerate(skin['joints'])]);M=np.einsum('nk,nkab->nab',weights,bind[joints]);worldP=np.einsum('nab,nb->na',M,np.column_stack((P,np.ones(len(P)))))[:,:3];worldN=np.einsum('nab,nb->na',np.linalg.inv(M[:,:3,:3]).transpose(0,2,1),N)
  else:
   M=wm(p['sourceNode']);worldP=(M@np.column_stack((P,np.ones(len(P)))).T).T[:,:3];worldN=(np.linalg.inv(M[:3,:3]).T@N.T).T
  worldN/=np.linalg.norm(worldN,axis=1)[:,None];expected=(worldP@rotation.T-offset)/L;expectedN=worldN@rotation.T
  got=np.array(p['positions']).reshape(-1,3);base=np.array(p['base']).reshape(-1,3);residual=np.array(p['residual']).reshape(-1,3)
  e=float(abs(expected-got).max());ne=float(abs(expectedN-np.array(p['normals']).reshape(-1,3)).max());re=float(abs(expected-(base+residual)).max());sourceMax=max(sourceMax,e);normalMax=max(normalMax,ne);residualMax=max(residualMax,re)
  uvOK=uvOK and np.array_equal(accessor(attrs['TEXCOORD_0']).reshape(-1),p['uvs']);materialOK=materialOK and q.get('material',0)==p['material'];vertexCount+=len(P)
  primitiveRows.append({'sourceMesh':p['sourceMesh'],'sourceNode':p['sourceNode'],'vertices':len(P),'triangles':len(p['indices'])//3,'maxCanonicalPositionError':e})
 pixelRows=[]
 for im in score.get('textures',[]):
  orig=g['images'][im['sourceIndex']]
  if 'uri' in orig:src=readuri(orig['uri'])
  else:
   bv=g['bufferViews'][orig['bufferView']];start=bv.get('byteOffset',0);src=buffers[bv['buffer']][start:start+bv['byteLength']]
  delivery=base64.b64decode(im['uri'].split(',',1)[1]);a=np.asarray(Image.open(io.BytesIO(src)).convert('RGBA'));b=np.asarray(Image.open(io.BytesIO(delivery)).convert('RGBA'));equal=np.array_equal(a,b)
  pixelRows.append({'sourceIndex':im['sourceIndex'],'pixelsEqual':equal,'sourceSha256':hashlib.sha256(src).hexdigest(),'deliveredSha256':hashlib.sha256(delivery).hexdigest(),'sourceSize':list(a.shape),'deliveredBytes':len(delivery)})
 seams={};seamMismatch=0
 for p in score['primitives']:
  for k,v in enumerate(np.array(p['positions']).reshape(-1,3)):
   key=tuple(np.round(v,7));binding=(p['finId'][k],p['finWeight'][k]);previous=seams.get(key)
   if previous is not None and previous!=binding:seamMismatch+=1
   seams[key]=binding
 results.append({'id':fish,'sourceArchiveUnchanged':containerOK,'sourceEntryUnchanged':hashlib.sha256(archive.read(entry)).hexdigest()==row['sourceEntrySha256'],'maxCanonicalPositionError':sourceMax,'maxSourceNormalError':normalMax,'maxParametricResidualError':residualMax,'indicesExact':topologyOK,'uvExact':uvOK,'materialsExact':score['materials']==g['materials'] and materialOK,'vertexCount':vertexCount,'primitives':primitiveRows,'textures':pixelRows,'allTexturePixelsExact':all(p['pixelsEqual'] for p in pixelRows),'sameAddressBindingMismatches':seamMismatch,'pass':containerOK and sourceMax<1e-10 and normalMax<1e-10 and residualMax<1e-10 and uvOK and materialOK and seamMismatch==0 and all(p['pixelsEqual'] for p in pixelRows)})
print(json.dumps(results))
`;
const py=spawnSync('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-c',python,root],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:240000});
let sources=[];if(py.status===0){sources=JSON.parse(py.stdout);for(const s of sources)check('original-source-full-surface-'+s.id,s.pass,s);}else check('independent-source-decoder',false,py.stderr||py.error?.message);
const diff=execFileSync('git',['-c','core.fsmonitor=false','diff',anchor.baseSha,'--','local-r14'],{cwd:repo,encoding:'utf8'});check('r14-protected',diff.length===0,{diffBytes:diff.length});
const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8'),behavior=fs.readFileSync(path.join(root,'src/behavior.js'),'utf8');check('procedural-controller-instead-of-raw-clip-playback',/sampleSpine/.test(app)&&/finWaves/.test(app)&&/FishBehavior/.test(app)&&!/AnimationMixer/.test(app),{analyticSpine:true,independentFinDomains:true,sourceClipsAreReferenceOnly:true});
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-angle=d3d11']});
const browserRows=[],errors=[],network=[];let rendererInfo=null;
try{
 for(const viewport of [{width:1440,height:950},{width:390,height:844}]){
  const page=await browser.newPage({viewport});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(html).href,{timeout:120000});await page.waitForFunction(()=>window.__FIVE_FISH__?.ready||window.__FIVE_FISH__?.error,null,{timeout:120000});
  rendererInfo=await page.evaluate(()=>{const gl=__FIVE_FISH__.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return{webgl:gl.getParameter(gl.VERSION),renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
  for(const id of anchor.targets){
   await page.locator('.fish-choice[data-fish="'+id+'"]').click();await page.waitForFunction(id=>__FIVE_FISH__.state.loaded&&__FIVE_FISH__.state.selected===id,id,{timeout:90000});
   await page.evaluate(()=>{__FIVE_FISH__.state.playing=false;__FIVE_FISH__.state.orbit.yaw=0;__FIVE_FISH__.state.orbit.pitch=.05;});await page.waitForTimeout(500);
   const test=await page.evaluate(()=>{const a=__FIVE_FISH__,m=a.meshes,s=a.score,actor=a.behavior.actors[0],spine=a.Behavior.sampleSpine(actor,a.state.selected,65),M=new a.camera.matrixWorld.constructor(),V=a.camera.position.constructor;m[0].getMatrixAt(0,M);let screenX=0,screenY=0;for(const p of s.primitives)for(let k=0;k<p.positions.length;k+=3){const d=a.Behavior.deform(p.positions.slice(k,k+3),actor,a.state.selected,spine),v=new V(...d).applyMatrix4(M).project(a.camera);screenX=Math.max(screenX,Math.abs(v.x));screenY=Math.max(screenY,Math.abs(v.y));}return {id:a.state.selected,loaded:a.state.loaded,error:a.error,meshNames:m.map(x=>x.name),oneType:m.every(x=>x.name==='sampled-fish-'+a.state.selected),instances:a.behavior.actors.length,sourceAddressExact:m.every((x,j)=>{let max=0;const p=s.primitives[j],v=x.geometry.attributes.position.array;for(let k=0;k<v.length;k++)max=Math.max(max,Math.abs(v[k]-p.positions[k]));return max<6e-8;}),singleFishProjectedMaxAbs:[screenX,screenY],singleFishFramed:screenX<.99&&screenY<.99,frames:a.state.frames};});
   const modes=[];for(const mode of ['cruise','hover','burst','turn','rest']){
    const result=await page.evaluate(({mode})=>{const a=__FIVE_FISH__;for(let n=0;n<240;n++)a.Behavior.update(a.behavior,1/60,{mode,centered:true});a.updatePoses();const finite=x=>typeof x==='number'?Number.isFinite(x):Array.isArray(x)?x.every(finite):x&&typeof x==='object'?Object.values(x).every(finite):true;return {mode,finite:finite(a.Behavior.snapshot(a.behavior))&&Array.from(a.poseTexture.image.data).every(Number.isFinite)&&Array.from(a.finTexture.image.data).every(Number.isFinite),amplitude:a.behavior.actors[0].amplitude,eyeBounds:a.eyes.every(e=>e.objects.every(x=>Math.abs(x.gaze.rotation.x)<=.023001&&Math.abs(x.gaze.rotation.y)<=.047001))};},{mode});modes.push(result);
   }
   await page.locator('[data-mode="cruise"]').click();await page.evaluate(()=>{__FIVE_FISH__.state.playing=false;});
   if(viewport.width===1440){for(const view of ['side','oblique','top']){await page.locator('[data-view="'+view+'"]').click();await page.evaluate(()=>__FIVE_FISH__.reference(true));await page.waitForTimeout(110);await page.screenshot({path:path.join(root,'evidence',`independent-${id}-${view}-source.png`)});await page.evaluate(()=>__FIVE_FISH__.reference(false));await page.waitForTimeout(110);await page.screenshot({path:path.join(root,'evidence',`independent-${id}-${view}-candidate.png`)});}}
   await page.locator('#group').click();await page.waitForFunction(()=>__FIVE_FISH__.state.loaded&&__FIVE_FISH__.behavior.actors.length===30,null,{timeout:90000});
   const group=await page.evaluate(()=>{const a=__FIVE_FISH__;let minClearance=Infinity;for(let n=0;n<180;n++){a.Behavior.update(a.behavior,1/60,{mode:'turn',pointer:[0,0,0],centered:false});if(a.Behavior.groupClearance)minClearance=Math.min(minClearance,a.Behavior.groupClearance(a.behavior));}a.updatePoses();return {count:a.behavior.actors.length,oneType:a.meshes.every(x=>x.name==='sampled-fish-'+a.state.selected),finite:Array.from(a.poseTexture.image.data).every(Number.isFinite),minimumConservativeBodyClearance:minClearance};});
   const canvas=page.locator('#canvas'),box=await canvas.boundingBox();await page.mouse.move(box.x+box.width*.52,box.y+box.height*.5);const pointer=await page.evaluate(()=>Array.isArray(__FIVE_FISH__.state.pointer));await page.mouse.move(box.x+box.width*.7,box.y+box.height*.55);await page.mouse.down();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.6,{steps:3});await page.mouse.up();const rotated=await page.evaluate(()=>Math.abs(__FIVE_FISH__.state.orbit.yaw)>.01);if(viewport.width===1440)await page.screenshot({path:path.join(root,'evidence',`independent-${id}-group.png`)});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);check(`real-file-browser-${viewport.width}-${id}`,test.oneType&&test.instances===1&&test.sourceAddressExact&&test.singleFishFramed&&modes.every(m=>m.finite&&m.eyeBounds)&&group.count===30&&group.oneType&&group.finite&&pointer&&rotated&&!overflow,{test,modes,group,pointer,rotated,overflow});browserRows.push({viewport,id,test,modes,group,pointer,rotated,overflow});
   await page.locator('#single').click();await page.waitForFunction(()=>__FIVE_FISH__.state.loaded&&__FIVE_FISH__.behavior.actors.length===1,null,{timeout:90000});
  }if(viewport.width===390)await page.screenshot({path:path.join(root,'evidence','independent-mobile.png')});await page.close();
 }
}catch(e){check('real-browser-completion',false,String(e.stack||e));}finally{await browser.close();}
check('standalone-no-core-network',network.length===0,{requests:network});check('browser-console-zero-errors',errors.length===0,{errors});check('artifact-unchanged-during-independent-verification',frozenHash===sha(fs.readFileSync(html)),{testedHtmlSha256:frozenHash});
for(const [file,hash] of Object.entries(hashes))check('source-frozen-during-verification-'+file,sha(fs.readFileSync(path.join(root,file)))===hash,{sha256:hash});
const report={schema:'FISH_INDEPENDENT_VERIFICATION_1',taskId:anchor.taskId,verifiedAt:new Date().toISOString(),baseSha:anchor.baseSha,sourceHead:execFileSync('git',['-c','core.fsmonitor=false','rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),testedHtmlSha256:frozenHash,testedHtmlBytes:fs.statSync(html).size,hashes,status:failures.length?'HOLD_LOCAL':'TECHNICAL_PASS_PENDING_VISUAL_INSPECTION',checks,sources,browserRows,rendererInfo,failures,visualAcceptance:false,productionReady:false,publicBrowserVerification:'ROOT_PUBLICATION_LANE_REQUIRED',visualReview:'Verifier must inspect fresh independent side/oblique/top source vs candidate evidence before PASS_LOCAL_PROMOTE'};
fs.writeFileSync(path.join(root,'evidence/INDEPENDENT_REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,failures,htmlSha256:frozenHash,sourceCount:sources.length,browserCases:browserRows.length}));if(failures.length)process.exitCode=1;
