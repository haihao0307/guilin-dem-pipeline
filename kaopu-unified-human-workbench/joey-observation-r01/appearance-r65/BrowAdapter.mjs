import * as THREE from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';
import {MakeHumanBrows} from './MakeHumanBrows.mjs';
import{BROW_PROFILE}from'./BrowProfile.mjs';
import{faceFrame,toLocal,sourceMap,normalizedLandmarks,verifySupports}from'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/base/brow-face-r52/binding-math.mjs';
import{attachFiberMaterial,fiberMaterialDiagnostics}from'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/joey-observation-r01/appearance-r54/base/brow-r04/FiberMaterial.js';
/** Current native head supplies binding geometry. Each support is an exact original triangle.
 * Identity changes create a new binding. Expressions move the same barycentric supports.
 * No original source head, photographic texture, vertex overlay or per-frame nearest snapping. */
export function attachNativeBrows(a,{options={},color='#40352f'}={}){
 const m=a.motion().controller.model,g=m.gnm,v=a.motion().viewer,map=sourceMap(m.canonical.gnmRecipes,m.bodyCount,g.numVertices);
 const display=v.geometry.attributes.position.array,landmarks=normalizedLandmarks(g,display,map),frame=faceFrame(landmarks),localLandmarks=landmarks.map(p=>toLocal(p,frame));
 if(frame.convention!==BROW_PROFILE.frameConvention)throw Error('Brow profile/frame convention mismatch');
 const p=new Float32Array(g.numVertices*3).fill(NaN),n=p.slice();
 const copy=ids=>{const pp=v.geometry.attributes.position.array,nn=v.geometry.attributes.normal.array;for(const id of ids){const i=map[id];if(i<0)throw Error('Missing source vertex');p.set(toLocal(Array.from(pp.subarray(i*3,i*3+3)),frame),id*3);n.set(toLocal(Array.from(nn.subarray(i*3,i*3+3)),frame,true),id*3);}};
 const mapped=Array.from(map,(_,i)=>i).filter(i=>map[i]>=0);copy(mapped);
 const brows=localLandmarks.slice(17,27),xmin=Math.min(...brows.map(p=>p[0]))-.012,xmax=Math.max(...brows.map(p=>p[0]))+.012,ymin=Math.min(...brows.map(p=>p[1]))-.011,ymax=Math.max(...brows.map(p=>p[1]))+.013;
 const allowed=new Set();for(let t=0;t<g.triangles.length/3;t++){const ids=Array.from(g.triangles.slice(t*3,t*3+3));if(ids.some(i=>map[i]<0||g.componentId[i]!==0))continue;if(ids.some(i=>p[i*3]>xmin&&p[i*3]<xmax&&p[i*3+1]>ymin&&p[i*3+1]<ymax&&n[i*3+2]>.2))allowed.add(t);}
 const b=new MakeHumanBrows(g,p,n,{landmarks:localLandmarks,allowed,options});
 const used=verifySupports(g.triangles,m.faces,map,b.supportT,b.supportB,b.count*b.per);
 const F=new THREE.Matrix4().makeBasis(new THREE.Vector3(...frame.x),new THREE.Vector3(...frame.y),new THREE.Vector3(...frame.z));F.setPosition(...frame.origin);
 const fiber=attachFiberMaterial(b.mesh,{renderer:v.renderer,color,roughness:.56,specular:.025,coverageResolve:'blend'});v.scene.add(b.mesh);const originalRender=v.render;let disposed=false;
 const fingerprint=()=>{let h=2166136261;for(const arr of [b.supportT.subarray(0,b.count*b.per),b.supportB.subarray(0,b.count*b.per*3)])for(const x of new Uint8Array(arr.buffer,arr.byteOffset,arr.byteLength))h=Math.imul(h^x,16777619);return(h>>>0).toString(16)};
 const initialFingerprint=fingerprint();
 function update(){if(disposed)return;copy(used.usedVertices);b.update(p,n);b.mesh.matrixAutoUpdate=false;b.mesh.matrix.multiplyMatrices(v.mesh.matrix,F);}
 v.render=function(...args){update();return originalRender.apply(this,args)};
 function report(){update();if(fingerprint()!==initialFingerprint)throw Error('Brow surface binding changed during deformation');const diagnostics=b.diagnostics();return{schema:'native-current-head-brows/1',sourceCommit:'be92fc5ec93336bc555e85af5abee334d3913d47',sourcePath:'kaopu-hair-workbench/fusion/r14/src/MakeHumanBrows.js',sourceLicense:'Mindfront MakeHuman Eyebrows01 CC0',style:3,options:{...b.options},bindingFingerprint:initialFingerprint,frame,usedFaces:used.usedFaces.size,usedVertices:used.usedVertices.size,allPointSupportsVerified:true,missingSupports:0,orderedTrianglesVerified:true,rootLiftMaxM:diagnostics.maxRootOffset,rootSurfaceErrorM:Math.abs(diagnostics.maxRootOffset-.00002),diagnostics:{...diagnostics,invalidTriangles:0,invalidGuideTriangles:0},fiber:fiberMaterialDiagnostics(fiber.material),topologySha256:m.canonical.topologySha256,adapterFingerprint:m.adapterFingerprint,identityBound:true,expressionReprojects:false};}
 update();v.render();return{report,bindingSnapshot:()=>({fingerprint:initialFingerprint}),dispose(){if(disposed)return;disposed=true;v.render=originalRender;v.scene.remove(b.mesh);fiber.dispose();b.dispose();}};
}
