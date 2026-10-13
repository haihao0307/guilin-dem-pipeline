"""L03: read frozen L02; generate only isolated r14-l03 runtime and build data."""
from pathlib import Path
import json,hashlib,shutil,gzip
p=Path(__file__).resolve().parent
old=p.parent/'r14-fast'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((old/'site/index.html').read_bytes())=='bd1668502411fa074796ef8d851e75aa0044862d6b5ec9ee0c393438b2f0433c'
for name in ['src','vendor','native-head','data','licenses']:
 shutil.copytree(old/name,p/name,dirs_exist_ok=True)
for name in ['index.html','workbench.css','BASELINE_HASHES.json','NATIVE_HEAD_LOCK.json']:
 shutil.copy2(old/name,p/name)
m=json.loads((old/'ASSET_MANIFEST.json').read_text());d=p/'build-data';d.mkdir(exist_ok=True)
for name in ['core','deferred']:
 a=m['assets'][name];chunks=[]
 for part in a['chunks']:
  b=(old/'site'/part['path']).read_bytes();assert len(b)==part['bytes'] and sha(b)==part['sha256'];chunks.append(b)
 raw=b''.join(chunks);raw=gzip.decompress(raw) if a['gzip'] else raw
 assert sha(raw)==a['sha256'] and len(raw)==a['bytes'];(d/(name+'.bin')).write_bytes(raw)
(d/'original.json').write_text(json.dumps(m['original']))
engine={f.name:sha(f.read_bytes()) for f in sorted((old/'src').glob('*.js')) if f.name not in ['app.js','RenderGate.js','AssetLoader.js','EmbeddedHead.js']}
(p/'src/CacheEngine.js').write_text('export const GROOM_ENGINE='+json.dumps(sha(json.dumps(engine,sort_keys=True).encode()))+';\n')
for name in ['RenderGate.js','GroomResultCache.js']:
 shutil.copy2(p/'patches'/name,p/'src'/name)
s=(old/'src/app.js').read_text()
def sub(a,b,count=1):
 global s
 assert s.count(a)==count,(a[:100],s.count(a));s=s.replace(a,b)
sub("const $=id=>", "import {GroomResultCache} from './GroomResultCache.js';\nimport {GROOM_ENGINE} from './CacheEngine.js';\nconst runtimePerf={compileRuns:0,unchangedRequests:0,meshBuildMs:0,resultSource:null,stages:[],disposal:null};let groomCache;\nfunction markStage(name){runtimePerf.stages.push({name,at:performance.now()});if(runtimePerf.stages.length>24)runtimePerf.stages.shift();}\nconst $=id=>")
sub('let nativeHead;','let nativeHead,appliedInspection=null;')
sub("if(e?.name==='AbortError')return;", "if(disposed||e?.name==='AbortError')return;")
sub("function dimensions(){const r=$('stage').getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();}", "let lastSize=[];function dimensions(){if(disposed)return;const r=$('stage').getBoundingClientRect();if(lastSize[0]===r.width&&lastSize[1]===r.height)return;lastSize=[r.width,r.height];renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();draw();}")
start=s.index('function meshGeometry(data){');end=s.index('function updateInspection()',start)
s=s[:start]+(p/'patches/meshGeometry.js').read_text()+s[end:]
sub('function updateInspection(){\n if(!compiled)return;','function updateInspection(){\n if(!compiled)return;appliedInspection=inspection;')
sub("if(hair.userData.fullIndex)hair.geometry.setIndex(hair.userData.fullIndex);", "if(hair.userData.rootIndexBackup){hair.geometry.index.array.set(hair.userData.rootIndexBackup);hair.geometry.index.needsUpdate=true;hair.geometry.setDrawRange(0,Infinity);hair.userData.rootIndexBackup=null;}")
sub("hair.geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(ids),1));", "hair.userData.rootIndexBackup=hair.geometry.index.array.slice();hair.geometry.index.array.set(ids);hair.geometry.index.needsUpdate=true;hair.geometry.setDrawRange(0,ids.length);")
sub("hair.userData.fullIndex=geometry.index;compiled=result;", "hair.userData.rootIndexBackup=null;compiled=result;")
sub("const next=validateRecipe({...recipe,...patch}),id=++job;busy=true;", """if(disposed)return false;
 const next=validateRecipe({...recipe,...patch});
 if(compiled&&!busy&&Object.keys(next).every(k=>next[k]===recipe[k])){runtimePerf.unchangedRequests++;if(appliedInspection!==inspection)updateInspection();await gate.wait(180000);sync();return true;}
 const id=++job;busy=true;""")
sub("const result=await compileGroom(roots,skin,next,{segments:24,cancel:()=>id!==job||disposed,onProgress:(stage,value)=>{$('progressText').textContent=stage+' '+Math.round(value*100)+'%';$('progress').value=value;}});", """markStage('result-cache-read');let result=await groomCache.load(next,()=>id!==job||disposed);if(id!==job||disposed)return false;
  if(result){runtimePerf.resultSource='verified-local-cache';$('progressText').textContent='复用本机原质量发丝 · 校验已通过';}
  else{runtimePerf.compileRuns++;runtimePerf.resultSource='original-compiler';markStage('compile-start');result=await compileGroom(roots,skin,next,{segments:24,cancel:()=>id!==job||disposed,onProgress:(stage,value)=>{$('progressText').textContent=stage+' '+Math.round(value*100)+'%';$('progress').value=value;}});markStage('compile-end');}
  markStage('mesh-start');""")
sub("if(id!==job)return false;const geometry=meshGeometry(result);", "if(id!==job||disposed)return false;const geometry=meshGeometry(result);markStage('mesh-end');")
sub("appearance();updateInspection();sync();await gate.wait(180000);", "appearance();updateInspection();sync();await gate.wait(180000);markStage('visible-complete');if(runtimePerf.resultSource==='original-compiler'&&!disposed)void groomCache.save(result);")
sub("await gate.wait(180000);brows.apply({browsModel:style,browsDensity:density});", "if(brows.options.browsModel===style&&brows.options.browsDensity===density){runtimePerf.unchangedRequests++;await gate.wait(180000);return;}await gate.wait(180000);brows.apply({browsModel:style,browsDensity:density});")
sub("function diagnostics(){return{startup:", "function diagnostics(){return{runtimePerf:{...runtimePerf,cache:groomCache?.diagnostics(),navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),indexBytes:hair?.geometry.index.array.byteLength,indexDrawCount:hair?.geometry.drawRange.count,hasIndexBackup:!!hair?.userData.rootIndexBackup},startup:")
sub("document.addEventListener('visibilitychange',()=>{if(document.hidden)setRotate(false)});", "document.addEventListener('visibilitychange',()=>{if(document.hidden)suspendRuntime();else resumeRuntime();});")
sub("e=>{e.preventDefault();setRotate(false);gate?.reset();", "e=>{if(disposed)return;e.preventDefault();setRotate(false);gate?.reset();")
sub("throw Error('未知灯光');light=name;", "throw Error('未知灯光');if(light===name)return;light=name;")
sub("dimensions();cameraView();const h=await load('head');", "markStage('init');dimensions();cameraView();const h=await load('head');")
sub("nativeHead=await installNativeHead", "markStage('native-head-start');nativeHead=await installNativeHead")
sub("head.castShadow=head.receiveShadow=true;scene.add(head);", "markStage('native-head-end');head.castShadow=head.receiveShadow=true;scene.add(head);")
sub("roots=makeRootSet(model,count);skin=new SkinField(nativeHead.collisionModel);", """markStage('root-bind-start');roots=makeRootSet(model,count);skin=new SkinField(nativeHead.collisionModel);markStage('root-bind-end');
 const digest=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join('');
 groomCache=new GroomResultCache({engine:GROOM_ENGINE,count,segments:24,seed:724,rootSHA:await digest(roots.templateRoots),headSHA:await digest(head.geometry.attributes.position.array)});""")
sub("boot();sync();", "window.lengthGroom.cache={flush:()=>groomCache.flush(),clear:()=>groomCache.clear(),diagnostics:()=>groomCache.diagnostics()};\n"+(p/'patches/lifecycle.js').read_text()+"\nboot();sync();")
s=s.replace('R14.2-L02','R14.2-L03');(p/'src/app.js').write_text(s)
b=(old/'boot.js').read_text()
b=b.replace("window.__HAIR_BOOT={start,manifest,cacheName};", "window.__HAIR_BOOT={start,manifest,cacheName,dispose(){generation++;for(const u of blobs)URL.revokeObjectURL(u);blobs.length=0;window.__HAIR_TEXTURES=null;window.__HAIR_RUNTIME=null;}};")
b=b.replace("stats.assetsReadyMs=performance.now();", "stats.navigation=performance.getEntriesByType('navigation')[0]?.toJSON();stats.assetsReadyMs=performance.now();")
(p/'boot.js').write_text(b.replace('R14.2-L02','R14.2-L03'))
f=p/'index.html';f.write_text(f.read_text().replace('R14.2-L02','R14.2-L03'))
b=(old/'build.mjs').read_text().replace('R14.2-L02','R14.2-L03').replace('/fusion/r14-fast/README.md','/fusion/r14-l03/README.md');(p/'build.mjs').write_text(b)
preserved=[]
for f in sorted(old.rglob('*')):
 if f.is_file() and f.relative_to(old).parts[0] in ['src','vendor','native-head','data','licenses']:
  dest=p/f.relative_to(old)
  if dest.exists() and dest.read_bytes()==f.read_bytes():preserved.append({'path':str(f.relative_to(old)),'sha256':sha(f.read_bytes())})
(p/'INVARIANTS.json').write_text(json.dumps({'baseline':'47da1ce9c26d63d4b9cb835aacbb6caee763094d','frozenL02HTML':sha((old/'site/index.html').read_bytes()),'preservedFiles':preserved,'engineSources':engine,'oldPathsModified':False},indent=2))
print('L03 isolated source prepared; preserved',len(preserved),'files')
