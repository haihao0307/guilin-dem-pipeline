/** Browser-only acceptance checks. CPU results do not imply GPU or phone acceptance. */
import * as T from 'three';
import {GLTFLoader} from '../../a4-a6-source-comparison-r03/vendor/GLTFLoader.mjs';
import {RoomEnvironment} from '../../a4-a6-source-comparison-r03/vendor/RoomEnvironment.mjs';
import {applyAcceptanceCamera,projectedExtents} from '../../a4-a6-source-comparison-r03/src/orthographic-acceptance.mjs';
import {loadProjection} from './runtime/projection-loader.mjs';
import {makeGltfBridge,runtimeLock,sha256} from './runtime/src/exact-decoder.mjs';

const COAL=[311,312,313,314,315,316];
const TIMES=[0,.37,1.13],VIEWS=['side','front','top'];
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const stripError=e=>e?.stack||String(e);
const currentBase=()=>new URL('./runtime/',import.meta.url);

function makeSource(root,nodes,animations,g){
 const rest=nodes.map(n=>({position:n.position.clone(),quaternion:n.quaternion.clone(),scale:n.scale.clone(),matrix:n.matrix.clone()}));
 const mixer=new T.AnimationMixer(root);
 return {root,nodes,g,animations,mixer,rest,setTime(t){
  mixer.stopAllAction();nodes.forEach((n,i)=>{n.position.copy(rest[i].position);n.quaternion.copy(rest[i].quaternion);n.scale.copy(rest[i].scale);n.matrix.copy(rest[i].matrix);});
  if(animations[0]){const a=mixer.clipAction(animations[0]);a.reset().setLoop(T.LoopOnce,1);a.clampWhenFinished=true;a.play();mixer.setTime(t);}
  root.updateMatrixWorld(true);
 }};
}

/** Reads only this projected package. glTF receives verified in-memory Blob URLs only. */
export async function loadNonCoalBrowserModel({runtimeBase=currentBase(),deadlineMs=60000,onProgress=()=>{}}={}){
 const base=new URL(runtimeBase,location.href);if(!base.pathname.endsWith('/'))base.pathname+='/';
 const requests=[],bytesByPath=new Map(),allowedBlobURLs=new Set(),gltfResourceRequests=[];
 const readBytes=async relative=>{
  const url=new URL(relative,base);assert(url.href.startsWith(base.href),'Dependency escaped projected runtime: '+relative);
  if(bytesByPath.has(relative))return bytesByPath.get(relative);
  const started=performance.now(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),deadlineMs);
  try{
   const response=await fetch(url,{signal:controller.signal,cache:'no-store'});assert(response.ok,'Projection dependency HTTP '+response.status+': '+relative);
   const bytes=new Uint8Array(await response.arrayBuffer());bytesByPath.set(relative,bytes);
   requests.push({path:relative,url:url.href,bytes:bytes.length,sha256:await sha256(bytes),elapsedMs:performance.now()-started});onProgress({path:relative,bytes:bytes.length});return bytes;
  }finally{clearTimeout(timer);}
 };
 let result,model;
 try{
  result=await loadProjection(readBytes);
  const binary=URL.createObjectURL(new Blob([result.payload]));allowedBlobURLs.add(binary);
  const g=makeGltfBridge(result.document,binary),c=result.document.content;
  for(let i=0;i<c.images.length;i++){
   const image=c.images[i],bytes=bytesByPath.get('a6-inheritance/'+image.payload);assert(bytes,'Verified image bytes absent');
   const uri=URL.createObjectURL(new Blob([bytes],{type:image.definition.mimeType||(/\.jpe?g$/i.test(image.payload)?'image/jpeg':'image/png')}));allowedBlobURLs.add(uri);g.images[i].uri=uri;
  }
  const manager=new T.LoadingManager();manager.setURLModifier(url=>{gltfResourceRequests.push(url);assert(allowedBlobURLs.has(url),'glTF attempted external data/fallback: '+url);return url;});
  model=await new GLTFLoader(manager).parseAsync(JSON.stringify(g),'');
  const nodes=await Promise.all(g.nodes.map((_,i)=>model.parser.getDependency('node',i)));
  const source=makeSource(model.scene,nodes,model.animations,g);
  source.model=model;source.manifest=result.manifest;source.document=result.document;source.payload=result.payload;
  source.requestReport={runtimeBase:base.href,requests,logicalPaths:result.requested,gltfResourceRequests:gltfResourceRequests.map(url=>({scheme:new URL(url).protocol,issuedByVerifiedProjection:true})),allGLTFDataIsVerifiedBlob:true,sourceAssetFallbackRequests:0,storedDependencyBytes:requests.reduce((sum,r)=>sum+r.bytes,0),sourcePayloadBytes:result.payload.length,sourcePayloadSHA256:await sha256(result.payload)};
  source.performanceResources=performance.getEntriesByType('resource').filter(e=>e.name.startsWith(base.href)).map(e=>({url:e.name,initiatorType:e.initiatorType,transferSize:e.transferSize,encodedBodySize:e.encodedBodySize,decodedBodySize:e.decodedBodySize,duration:e.duration}));
  return source;
 }finally{for(const uri of allowedBlobURLs)URL.revokeObjectURL(uri);}
}

function cloneReference(original){
 assert(original.nodes.length===331&&original.g.meshes.length===200,'Reference must be complete original A4');
 assert(original.object?.content?.fieldPayload?.sha256==='829caf7934c5d58d59a35f0e2125ae1ccc1c551447a62fed22bf4bd2170673b2','Reference full A4 anchor mismatch');
 const root=original.root.clone(true),map=new Map();
 const visit=(a,b)=>{assert(a.children.length===b.children.length,'Reference clone structure mismatch');map.set(a,b);a.children.forEach((child,i)=>visit(child,b.children[i]));};visit(original.root,root);
 const nodes=original.nodes.map(n=>{const clone=map.get(n);assert(clone,'Reference node absent from clone');return clone;});
 nodes.forEach((n,i)=>{const rest=original.rest[i];n.position.copy(rest.position);n.quaternion.copy(rest.quaternion);n.scale.copy(rest.scale);n.matrix.copy(rest.matrix);});
 const visibilityBefore=nodes.map(n=>n.visible);for(const i of COAL)nodes[i].visible=false;
 assert(nodes.every((n,i)=>COAL.includes(i)||n.visible===visibilityBefore[i]),'Reference non-coal visibility changed');
 const source=makeSource(root,nodes,original.model.animations.map(a=>a.clone()),original.g);
 source.visibilityBefore=visibilityBefore;return source;
}

function sceneFor(root,referenceScene,environment){
 const scene=referenceScene?referenceScene.clone(false):new T.Scene();
 if(!referenceScene){scene.background=new T.Color('#e9e6dd');scene.environment=environment;scene.add(new T.HemisphereLight(0xffffff,0x656b62,1.2));const sun=new T.DirectionalLight(0xffffff,2);sun.position.set(10,20,15);scene.add(sun);}
 else for(const child of referenceScene.children)if(child.isLight)scene.add(child.clone(true));
 scene.add(root);scene.updateMatrixWorld(true);return scene;
}

function visibleBounds(root){
 const box=new T.Box3();
 root.updateMatrixWorld(true);root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}});
 assert(!box.isEmpty(),'Visible geometry bounds empty');return box;
}

function pixels(renderer,scene,camera,target,width,height){
 renderer.setScissorTest(false);renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);renderer.clear();renderer.render(scene,camera);
 const bytes=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,bytes);return bytes;
}

function nonBackgroundPixels(data){
 let count=0;for(let i=4;i<data.length;i+=4)if(data[i]!==data[0]||data[i+1]!==data[1]||data[i+2]!==data[2])count++;return count;
}

function capturePanel(container,id,label,data,width,height){
 const figure=document.createElement('figure');figure.style.cssText='margin:0;padding:6px;background:#eee;color:#222';figure.dataset.auditCapture=id;
 const caption=document.createElement('figcaption');caption.textContent=label;caption.style.cssText='font:13px system-ui;padding:4px';figure.append(caption);
 const canvas=document.createElement('canvas');canvas.id=id;canvas.width=width;canvas.height=height;canvas.style.cssText='position:static;display:block;width:100%;height:auto;pointer-events:none';
 const flipped=new Uint8ClampedArray(data.length);for(let y=0;y<height;y++)flipped.set(data.subarray(y*width*4,(y+1)*width*4),(height-1-y)*width*4);
 canvas.getContext('2d').putImageData(new ImageData(flipped,width,height),0,0);figure.append(canvas);container.append(figure);return id;
}

function startCaptures(compareReference){
 document.getElementById('a6-noncoal-audit')?.remove();const section=document.createElement('section');section.id='a6-noncoal-audit';section.style.cssText='position:relative;z-index:10;padding:12px;background:#ddd;color:#222';
 const title=document.createElement('h2');title.textContent='A4 非煤继承依赖投影核查：原壳保留，A6 新车体/油水机构未构建';title.style.font='bold 16px system-ui';section.append(title);
 const grid=document.createElement('div');grid.style.cssText=`display:grid;grid-template-columns:repeat(${compareReference?2:1},minmax(0,1fr));gap:8px`;section.append(grid);document.body.append(section);return grid;
}

function disposeCandidate(source){
 source?.mixer?.stopAllAction();if(!source)return;
 const geometries=new Set(),materials=new Set(),textures=new Set();source.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const material of [].concat(o.material||[])){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);}});
 for(const t of textures)t.dispose();for(const m of materials)m.dispose();for(const g of geometries)g.dispose();
}

/** Call from page.evaluate after the existing viewer has loaded a4-original. */
export async function runNonCoalBrowserAudit({qa=globalThis.CONVERSION_QA,runtimeBase=currentBase(),width=800,height=350,capture=true,compareReference=true,renderer:providedRenderer,environment=null}={}){
 const started=performance.now(),report={passed:false,scope:'A4 non-coal inherited dependency subset only; not a finished A6 vehicle',browserGPUExecuted:false,phoneAcceptance:'NOT_TESTED',newRulesLearned:0,checks:[],errors:[],matrixChecks:[],pixelChecks:[],captureIds:[]};
 const check=(condition,label)=>{report.checks.push({label,passed:!!condition});assert(condition,label);};
 const recordCheck=(condition,label)=>report.checks.push({label,passed:!!condition});
 let candidate,reference,target,renderer=providedRenderer||qa?.renderer,saved,original,sourceVisibility,originalParent,referencePanel,container;
 try{
  check(renderer?.isWebGLRenderer,'WebGL renderer available');check(Number.isInteger(width)&&width>=128&&Number.isInteger(height)&&height>=128,'Valid fixed capture dimensions');
  if(compareReference){
   check(qa?.ready,'Existing viewer reference ready');referencePanel=qa.panels.find(p=>p.id==='a4-original');check(!!referencePanel,'Full A4 original reference panel exists');original=referencePanel.source;
   sourceVisibility=original.nodes.map(n=>n.visible);originalParent=original.root.parent;reference=cloneReference(original);
  }
  candidate=await loadNonCoalBrowserModel({runtimeBase});report.requests=candidate.requestReport;report.performanceResources=candidate.performanceResources;
  check(candidate.requestReport.requests.length===186,'All 186 projected runtime dependencies loaded and locked');
  check(candidate.requestReport.storedDependencyBytes===10843600,'Projected stored dependency byte total exact');
  check(candidate.g.nodes.length===325&&candidate.g.meshes.length===195&&candidate.g.accessors.length===922,'Actual glTF contains only the retained nodes, meshes and fields');
  check(candidate.requestReport.allGLTFDataIsVerifiedBlob&&candidate.requestReport.sourceAssetFallbackRequests===0,'glTF uses only verified projection buffers/images, no source fallback');
  const ids=candidate.manifest.projection.sourceIndices;
  const candidateScene=sceneFor(candidate.root,referencePanel?.scene,environment),referenceScene=reference?sceneFor(reference.root,referencePanel.scene,environment):null;
  if(reference){
   const animation=structuredClone(candidate.g.animations);
   for(const a of animation){for(const sampler of a.samplers){sampler.input=ids.fields[sampler.input];sampler.output=ids.fields[sampler.output];}for(const ch of a.channels)ch.target.node=ids.nodes[ch.target.node];}
   check(await runtimeLock(animation)===await runtimeLock(original.g.animations),'All 71 original animation channels/samplers preserved after source-identity remap');
   report.animationChannels=animation.reduce((n,a)=>n+a.channels.length,0);check(report.animationChannels===71,'Exactly 71 retained animation channels');
   check(reference.nodes.every((n,i)=>COAL.includes(i)?!n.visible:n.visible===sourceVisibility[i]),'Only original coal closure hidden in reference clone');
  }
  const bounds=new T.Box3();
  for(const time of TIMES){
   candidate.setTime(time);reference?.setTime(time);candidateScene.updateMatrixWorld(true);referenceScene?.updateMatrixWorld(true);
   bounds.union(visibleBounds(candidate.root));if(reference)bounds.union(visibleBounds(reference.root));
   if(reference){
    const mismatch=[];
    candidate.nodes.forEach((node,i)=>{const a=reference.nodes[ids.nodes[i]].matrixWorld.elements,b=node.matrixWorld.elements;for(let k=0;k<16;k++)if(!Object.is(a[k],b[k])){mismatch.push({sourceNode:ids.nodes[i],projectedNode:i,element:k,reference:a[k],projected:b[k]});break;}});
    report.matrixChecks.push({time,retainedNodes:325,float64Values:325*16,mismatchedNodes:mismatch.length,firstMismatches:mismatch.slice(0,12)});recordCheck(mismatch.length===0,'All 325 source-mapped world matrices bit-exact at '+time);
   }
  }
  const size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3()),scales={};
  for(const view of VIEWS){const e=projectedExtents(size,view);scales[view]=Math.max(e.width/width,e.height/height)*1.12;}
  report.camera={kind:'fixed-orthographic',views:VIEWS,width,height,worldUnitsPerPixelByView:scales,scaleScope:'Within each fixed view, one common scale and camera for both objects and all three times; no independent object fitting.',center:center.toArray(),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},metricScaleCertified:false};
  if(capture)container=startCaptures(compareReference);
  saved={target:renderer.getRenderTarget(),viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest(),autoClear:renderer.autoClear,clearColor:renderer.getClearColor(new T.Color()),clearAlpha:renderer.getClearAlpha()};renderer.autoClear=true;
  target=new T.WebGLRenderTarget(width,height,{depthBuffer:true,stencilBuffer:false});target.texture.colorSpace=T.SRGBColorSpace;
  for(const time of TIMES){
   candidate.setTime(time);reference?.setTime(time);candidateScene.updateMatrixWorld(true);referenceScene?.updateMatrixWorld(true);
   for(const view of VIEWS){
    const camera=applyAcceptanceCamera(T,new T.OrthographicCamera(),{view,center,worldUnitsPerPixel:scales[view],width,height});
    const actual=pixels(renderer,candidateScene,camera,target,width,height),expected=reference?pixels(renderer,referenceScene,camera,target,width,height):null;report.browserGPUExecuted=true;
    let differences=0;const first=[];if(expected)for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i]){differences++;if(first.length<12)first.push({byte:i,reference:expected[i],projected:actual[i]});}
    const nonempty=nonBackgroundPixels(actual),entry={view,time,rgbaBytes:actual.length,differentBytes:expected?differences:null,nonBackgroundPixels:nonempty,projectedPixelSHA256:await sha256(actual),referencePixelSHA256:expected?await sha256(expected):null,firstDifferences:first};report.pixelChecks.push(entry);
    if(capture&&time===0){if(expected)report.captureIds.push(capturePanel(container,'a6-noncoal-reference-'+view,'原A4参考克隆，仅隐藏煤 · '+view,expected,width,height));report.captureIds.push(capturePanel(container,view==='side'?'noncoal-audit-canvas':'a6-noncoal-projection-'+view,'独立非煤载荷，原A4壳保留 · '+view,actual,width,height));}
    recordCheck(nonempty>1000,'Nonempty projected geometry '+view+' at '+time);if(expected)recordCheck(differences===0,'Full-frame identical pixels '+view+' at '+time);
   }
  }
  renderer.getContext().finish();check(!renderer.getContext().isContextLost(),'WebGL context retained');
  if(original)check(original.root.parent===originalParent&&original.nodes.every((n,i)=>n.visible===sourceVisibility[i]),'Original complete A4 tree and visibility unchanged');
  report.browserGPUExecuted=true;report.comparedWithOriginalMinusCoal=compareReference;report.screenshotTargets={candidateSide:'#noncoal-audit-canvas',candidateFront:'#a6-noncoal-projection-front',candidateTop:'#a6-noncoal-projection-top',comparison:'#a6-noncoal-audit'};report.passed=report.checks.every(c=>c.passed);if(!report.passed)report.errors.push('One or more matrix/pixel acceptance checks failed; diagnostic canvases retained.');
 }catch(e){report.errors.push(stripError(e));}
 finally{
  if(saved){renderer.setRenderTarget(saved.target);renderer.setViewport(saved.viewport);renderer.setScissor(saved.scissor);renderer.setScissorTest(saved.scissorTest);renderer.autoClear=saved.autoClear;renderer.setClearColor(saved.clearColor,saved.clearAlpha);}target?.dispose();reference?.mixer.stopAllAction();disposeCandidate(candidate);qa?.render?.();
  report.elapsedMs=performance.now()-started;report.browser={userAgent:navigator.userAgent,devicePixelRatio:devicePixelRatio,threeRevision:T.REVISION,webglVersion:renderer?.getContext()?.getParameter(renderer.getContext().VERSION)||null};
  globalThis.A6_NONCOAL_BROWSER_AUDIT=report;
 }
 return report;
}

/** Separate page/CI path: block all original source-assets and generated/ URLs before calling. */
export async function runNonCoalStandaloneAudit(options={}){
 const renderer=new T.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
 const room=new RoomEnvironment(),pmrem=new T.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();
 try{return await runNonCoalBrowserAudit({...options,qa:null,compareReference:false,renderer,environment});}
 finally{environment.dispose();renderer.dispose();}
}
