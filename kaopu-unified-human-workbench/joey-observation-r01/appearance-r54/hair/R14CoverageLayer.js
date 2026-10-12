import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {makeRootSet,SkinField,compileGroom,validateRecipe} from './r14/LengthKernel.js';
import {attachFiberMaterial,fiberMaterialDiagnostics} from './r14/FiberMaterial.js';
import {SOURCE_COMMIT,buildCoverageContext,bindCurrentRoots,compiledToDisplay,fingerprint,sameArray} from './R14CoverageCore.js';

/** Static R14.2 scalp coverage overlay. The original R30 long hair remains a
 * separate, owner-managed mesh. R14's 45–160 mm domain is never called long hair.
 * Recompile after any current common-geometry change, including expressions.
 */
export async function attachR14Coverage(api,options={}){
 const {count=36000,segments=24,recipe:recipePatch={},visible=true,onProgress,onInvalidated,cancel,expectedVertexCount=25417,archive='R52 current fixed appearance'}=options;
 if(!Number.isInteger(count)||count<1000||count>36000)throw Error('R14 coverage count must be an integer from 1000 to 36000');
 if(!Number.isInteger(segments)||segments<12||segments>32)throw Error('R14 coverage segments must be an integer from 12 to 32');
 const motion=api?.motion?.(),model=motion?.controller?.model,viewer=motion?.viewer;
 if(!model?.gnm||!viewer?.mesh||!viewer?.geometry?.index||!viewer?.scene)throw Error('R14 coverage requires api.motion() with a native common mesh');
 const geometryAtCompile=viewer.geometry,positions=geometryAtCompile.getAttribute('position')?.array,index=geometryAtCompile.index.array,started=performance.now();
 const recipe=validateRecipe({style:'side-flow',color:'#21170f',...recipePatch});
 const context=buildCoverageContext({source:model.gnm,recipes:model.canonical?.gnmRecipes,bodyCount:model.bodyCount,positions,faces:model.faces,displayFaces:index,expectedVertexCount});
 const matches=()=>{
  try {
   const now=api.motion();
   return now?.controller?.model===model&&now?.viewer===viewer&&viewer.geometry===geometryAtCompile&&
    sameArray(viewer.geometry.getAttribute('position')?.array,context.positions)&&sameArray(model.faces,context.faces)&&sameArray(viewer.geometry.index?.array,context.displayFaces);
  } catch {return false;}
 };
 onProgress?.('原 GNM 根域 / 同向表面绑定',0);
 const roots=makeRootSet(model.gnm,count),support=bindCurrentRoots(roots,context),skin=new SkinField(context.collisionModel);
 const compiled=await compileGroom(roots,skin,recipe,{segments,cancel:()=>cancel?.()||!matches(),onProgress});
 if(!matches())throw Error('Common mesh changed during R14 compilation; recompile for the new state');
 if(fingerprint(model.gnm.template)!==context.sourcePositionHash)throw Error('GNM source template changed during R14 compilation');
 const bindingStats=compiledToDisplay(compiled,context,support),geometry=coverageMeshGeometry(compiled,context.frame.scale),mesh=new THREE.Mesh(geometry,null);
 mesh.name='R14.2 current-mesh scalp coverage; static state binding';mesh.renderOrder=1;mesh.visible=!!visible;mesh.matrixAutoUpdate=false;
 mesh.matrix.copy(viewer.mesh.matrix);mesh.matrixWorld.copy(viewer.mesh.matrixWorld);
 const fiber=attachFiberMaterial(mesh,{renderer:viewer.renderer,color:recipe.color,roughness:recipe.roughness/100,specular:.075,radiusScale:recipe.width/100,coverageResolve:'depth'});
 let disposed=false,invalidated=false,invalidReason=null;
 const sourceStats={...compiled.stats},compileStats={guides:compiled.guides.length,activeCount:compiled.activeCount,regions:{...compiled.regions},sourceCurveHash:compiled.curveHash,sourceRootHash:compiled.rootHash,compilerMs:compiled.buildMs,earGuard:compiled.earGuard,headGuard:compiled.headGuard,fieldCacheCells:compiled.fieldCacheCells};
 const bindingReport={verifiedRoots:support.verifiedRoots,orientedRootFaces:support.orientedRootFaces,missingSupports:0,originalRootHash:support.originalRootHash,currentRootHash:support.currentRootHash,maxFrameRootReprojection:support.maxFrameRootReprojection,...bindingStats};
 const memoryBytes=Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,geometry.index.array.byteLength),buildMs=performance.now()-started;
 function checkState(){
  if(disposed||invalidated)return false;
  if(!matches()){
   invalidated=true;invalidReason='Current common geometry changed. Recompile R14 coverage before showing it again.';
   mesh.visible=false;geometry.setDrawRange(0,0);onInvalidated?.(invalidReason);
   return false;
  }
  return true;
 }
 const fiberBeforeRender=mesh.onBeforeRender;
 mesh.onBeforeRender=function(renderer,...args){
  if(!checkState())return;
  mesh.matrix.copy(viewer.mesh.matrix);mesh.matrixWorld.copy(viewer.mesh.matrixWorld);
  fiberBeforeRender.call(this,renderer,...args);
 };
 // A shadow render also refuses a stale state before emitting any triangles.
 const fiberBeforeShadow=mesh.onBeforeShadow;
 mesh.onBeforeShadow=function(...args){if(!checkState())return;mesh.matrix.copy(viewer.mesh.matrix);mesh.matrixWorld.copy(viewer.mesh.matrixWorld);fiberBeforeShadow?.apply(this,args);};
 viewer.scene.add(mesh);viewer.render?.();
 return {
  mesh,
  rootRecords:{sourceTriangles:roots.rootTriangles.slice(),barycentrics:roots.rootBarycentrics.slice(),commonSourceMap:context.sourceMap.slice(),displayRoots:support.displayRoots.slice(),displayNormals:support.normalRoots.slice()},
  setVisible(next){if(disposed)throw Error('R14 coverage is disposed');if(next&&!checkState())throw Error(invalidReason);mesh.visible=!!next;viewer.render?.();return mesh.visible;},
  assertCurrent(){if(!checkState())throw Error(invalidReason||'R14 coverage is disposed');return true;},
  update(){if(!checkState())throw Error(invalidReason||'R14 coverage is disposed');return true;},
  report(){checkState();return {
   kind:'r14.2-static-current-mesh-coverage',sourceCommit:SOURCE_COMMIT,archive,count,segments,
   role:'scalp coverage and short/mid-length flow over owner-retained R30 long strands',
   recipe:{...recipe},staticBinding:true,requiresRecompileOn:'any common vertex or triangle change, including face/pose/expression',
   valid:!disposed&&!invalidated,visible:mesh.visible,disposed,invalidReason,physics:false,
   nativeVertexCount:context.positions.length/3,nativeTriangleCount:context.displayFaces.length/3,
   geometryUnchanged:matches(),inputPositionHash:context.positionHash,inputIndexHash:context.indexHash,
   rootBinding:bindingReport,rootFrame:{anchors:[...context.anchors],anchorDistances:[...context.anchorDistances],source:context.frame.source,current:context.frame.current,scale:context.frame.scale},
   collision:{source:'actual current complete displayed common mesh, inverse transformed into GNM frame',teacherGeometry:false,triangleCount:context.collisionModel.triangles.length/3,...compileStats},
   length:{...sourceStats,units:'GNM source-frame millimetres; displayed lengths multiplied by frame scale',displayScale:context.frame.scale,longHairProvided:false},
   material:fiberMaterialDiagnostics(fiber.material),geometryBytes:memoryBytes,buildMs,
   limitations:['static rest groom; no hair dynamics','R14.2 authored hairline and 45–160 mm recipe range','actual-triangle skin field and segment guards are bounded collision approximations, not a swept-radius proof','R30 long strands are separate and must remain enabled by the owner']
  };},
  dispose(){if(disposed)return;disposed=true;viewer.scene.remove(mesh);fiber.dispose();geometry.dispose();mesh.visible=false;viewer.render?.();}
 };
}

/** Same R14 mesh layout, transformed into current mesh-local display units.
 * Physical fibre radius scales with the same similarity as its centreline.
 */
function coverageMeshGeometry(data,scale){
 const n=data.count*data.per*2,g=new THREE.BufferGeometry(),position=new Float32Array(n*3),tangent=new Float32Array(n*3),normal=new Float32Array(n*3),side=new Float32Array(n),radius=new Float32Array(n),along=new Float32Array(n),random=new Float32Array(n),index=new Uint32Array(data.activeCount*data.segments*6);let at=0;
 for(let i=0;i<data.count;i++)for(let j=0;j<data.per;j++){
  const q=i*data.per+j;
  for(let k=0;k<2;k++){const v=q*2+k;position.set(data.curves.subarray(q*3,q*3+3),v*3);tangent.set(data.tangents.subarray(q*3,q*3+3),v*3);normal.set(data.normals.subarray(q*3,q*3+3),v*3);side[v]=k?1:-1;along[v]=j/data.segments;random[v]=data.randoms[i];radius[v]=scale*.000052*(.74+.50*data.randoms[i])*(1-.91*Math.pow(j/data.segments,3.5));}
  if(data.active[i]&&j<data.segments){const v=q*2;index.set([v,v+1,v+2,v+1,v+3,v+2],at);at+=6;}
 }
 for(const [name,array,size]of [['position',position,3],['tangent',tangent,3],['scalpNormal',normal,3],['strandSide',side,1],['strandRadius',radius,1],['along',along,1],['strandRandom',random,1]])g.setAttribute(name,new THREE.BufferAttribute(array,size));
 g.setIndex(new THREE.BufferAttribute(index,1));g.computeBoundingSphere();return g;
}
