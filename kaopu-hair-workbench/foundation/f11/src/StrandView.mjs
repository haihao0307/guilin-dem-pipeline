import {denseHairBlob} from './StrandExchange.mjs';
import * as THREE from './three.module.js';
import {nativeFrame} from './GuideExchange.mjs';
import {PARENTS} from './BundlePlan.mjs';
import {sub,dot} from './approved/LegacyFoundation.mjs';
export function createStrandView(surface,state){
 const group=new THREE.Group();group.name='F11-all-root-grown-hairs';group.matrixAutoUpdate=false;
 const parts=[];let selected='all',colored=false,version=-1,enabled=true;
 for(const p of state.strands.parts){
  const N=p.positions.length/3,array=new Float32Array(p.positions.length),offsets=new Float32Array(p.positions.length),colors=new Uint8Array(p.positions.length),index=new Uint32Array(p.count*(p.samples-1)*2);
  for(let i=0;i<p.count;i++){
   const q=i*4,f=nativeFrame(surface.referenceHead,p.bindings[q],Array.from(p.bindings.subarray(q+1,q+4)));
   for(let j=0;j<p.samples;j++){
    const k=(i*p.samples+j)*3,a=surface.toNative(Array.from(p.positions.subarray(k,k+3))),v=sub(a,f.origin);array.set(a,k);offsets.set([dot(v,f.t),dot(v,f.b),dot(v,f.n)],k);
    if(j){const t=(i*(p.samples-1)+j-1)*2;index[t]=i*p.samples+j-1;index[t+1]=i*p.samples+j;}
   }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(array,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));geometry.setIndex(new THREE.BufferAttribute(index,1));
  const material=new THREE.LineBasicMaterial({vertexColors:true,transparent:false,depthWrite:true,depthTest:true,toneMapped:false});
  const line=new THREE.LineSegments(geometry,material);line.name='F11-dense-'+p.id;line.frustumCulled=false;group.add(line);parts.push({p,array,offsets,colors,geometry,material,line});
 }
 function refresh(){for(const o of parts){const {p,colors}=o;o.line.visible=enabled&&(selected==='all'||selected===p.id||selected===p.patch||selected===p.parent);const color=new THREE.Color(colored?PARENTS.find(g=>g.id===p.parent).color:'#8b8981');
   for(let i=0;i<p.count;i++){const tone=p.appearance[i*4+3],phase=p.appearance[i*4];for(let j=0;j<p.samples;j++){const k=(i*p.samples+j)*3,u=j/(p.samples-1),shade=.50+tone*.56+.24*Math.pow(Math.max(0,Math.sin(u*5+phase*.18)),8);colors[k]=Math.min(255,Math.round(color.r*255*shade));colors[k+1]=Math.min(255,Math.round(color.g*255*shade));colors[k+2]=Math.min(255,Math.round(color.b*255*shade));}}
   o.geometry.attributes.color.needsUpdate=true;
  }}
 function update(head,mesh,positionVersion){group.matrix.copy(mesh.matrix);group.matrixWorld.copy(mesh.matrixWorld);if(version===positionVersion)return;version=positionVersion;
  for(const o of parts){const {p,array,offsets}=o;for(let i=0;i<p.count;i++){const q=i*4,f=nativeFrame(head,p.bindings[q],Array.from(p.bindings.subarray(q+1,q+4)));for(let j=0;j<p.samples;j++){const k=(i*p.samples+j)*3;for(let a=0;a<3;a++)array[k+a]=f.origin[a]+f.t[a]*offsets[k]+f.b[a]*offsets[k+1]+f.n[a]*offsets[k+2];}}o.geometry.attributes.position.needsUpdate=true;}
 }
 refresh();return {group,update,mode(c,id='all'){colored=c;selected=id;refresh();},display(on){enabled=on;refresh();},exportData(metadata){return denseHairBlob(parts.map(o=>({...o.p,positions:o.array})),metadata);},diagnostics:()=>({schema:state.strands.schema,actualStrands:state.strands.count,renderedStrands:enabled?parts.filter(o=>o.line.visible).reduce((n,o)=>n+o.p.count,0):0,allTargetHairsGenerated:state.strands.count===state.population.totalTarget,samplesPerHair:state.strands.samples,segments:state.strands.count*(state.strands.samples-1),rootBindings:state.strands.count,selected,colored,buildMS:state.strands.buildMS,clearanceCells:state.strands.clearanceCells,checkedSegments:state.strands.segmentChecks,repairedSegments:state.strands.segmentRepairs,unresolvedSegments:state.strands.unresolvedSegments,finiteWidthCollisionCertified:false}),dispose(){for(const o of parts){o.geometry.dispose();o.material.dispose();}}};
}
