import * as THREE from 'three';
import {layerLayout} from './material-settings.mjs';
/** Threads follow paired sewing edges, not independent decorative panel outlines. */
export function sewnTrims(native,packet,info){
 const group=new THREE.Group(),layout=layerLayout(info),knit=info.family==='knit',offsets=new Map(),panels=packet.spec.panels,active=new Set(packet.record.activeSeams),closedEdges=new Set(),strokes=[];let offset=0;
 for(const p of panels){offsets.set(p.id,offset);offset+=p.uvMm.length;}
 const edgeKey=(a,b)=>a<b?a+','+b:b+','+a;
 for(const s of packet.spec.seams){if(!active.has(s.id)||!s.stitchVertexPairs?.length)continue;const a=offsets.get(s.a.panelId),b=offsets.get(s.b.panelId),ia=s.stitchVertexPairs.map(q=>a+q[0]),ib=s.stitchVertexPairs.map(q=>b+q[1]);for(const ids of [ia,ib])for(let j=1;j<ids.length;j++)closedEdges.add(edgeKey(ids[j-1],ids[j]));
  strokes.push({ids:ia,kind:'thread',lane:1},{ids:ia,kind:'thread',lane:-1});
 }
 for(const panel of panels){const off=offsets.get(panel.id),b=panel.boundary.map(i=>i+off);let run=[];for(let j=0;j<b.length;j++){const a=b[j],z=b[(j+1)%b.length];if(!closedEdges.has(edgeKey(a,z))){if(!run.length)run.push(a);run.push(z);}else if(run.length){strokes.push({ids:run,kind:'hem',lane:0});run=[];}}if(run.length)strokes.push({ids:run,kind:'hem',lane:0});}
 const pos=native.geometry.attributes.position.array,nor=native.geometry.attributes.normal.array;const dist=(a,b)=>Math.hypot(pos[a*3]-pos[b*3],pos[a*3+1]-pos[b*3+1],pos[a*3+2]-pos[b*3+2]);
 let vertices=0;const indices=[];
 for(const s of strokes){let length=0;s.lengths=[0];for(let j=1;j<s.ids.length;j++){length+=dist(s.ids[j-1],s.ids[j]);s.lengths.push(length);}s.length=length;s.sides=s.kind==='hem'?6:5;s.samples=[];const pitch=s.kind==='hem'?.0025:(knit?.0038:.0031)/6,count=Math.max(2,Math.ceil(length/pitch));let seg=0;
  for(let j=0;j<=count;j++){const t=length*j/count;while(seg<s.ids.length-2&&s.lengths[seg+1]<t)seg++;s.samples.push({a:s.ids[seg],b:s.ids[seg+1],f:(t-s.lengths[seg])/Math.max(1e-8,s.lengths[seg+1]-s.lengths[seg]),arc:t});}
  s.offset=vertices;for(let j=0;j<count;j++)for(let k=0;k<s.sides;k++){const a=s.offset+j*(s.sides+1)+k;indices.push(a,a+s.sides+1,a+1,a+1,a+s.sides+1,a+s.sides+2);}vertices+=(count+1)*(s.sides+1);
 }
 const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setIndex(indices);
 const color=knit?info.parameters['base-dye']:info.family==='denim'?'#aa9370':info.parameters.color;const material=new THREE.MeshStandardMaterial({color,roughness:knit?.94:.8,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='paired-seams-and-bound-off-hems';group.add(mesh);
 const P=new THREE.Vector3(),N=new THREE.Vector3(),T=new THREE.Vector3(),B=new THREE.Vector3(),W=new THREE.Vector3();
 function update(){for(const s of strokes)for(let j=0;j<s.samples.length;j++){const q=s.samples[j],a=q.a*3,b=q.b*3,f=q.f;P.set(pos[a]*(1-f)+pos[b]*f,pos[a+1]*(1-f)+pos[b+1]*f,pos[a+2]*(1-f)+pos[b+2]*f);N.set(nor[a]*(1-f)+nor[b]*f,nor[a+1]*(1-f)+nor[b+1]*f,nor[a+2]*(1-f)+nor[b+2]*f).normalize();T.set(pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]).normalize();B.crossVectors(T,N).normalize();W.crossVectors(B,T).normalize();
   let width,height,center;if(s.kind==='hem'){width=knit?.0007:.00028;height=Math.max(width,layout.thickness*.0005);center=layout.thickness*.0005;}else{const pitch=knit?.0038:.0031,phase=(q.arc/pitch)%1,drop=Math.exp(-Math.pow(Math.min(phase,1-phase)/.11,2));width=height=knit?.00020:.00010;center=(layout.thickness-.1-(layout.thickness-.3)*drop)*.001;P.addScaledVector(B,s.lane*(knit?.00115:.00085));}
   P.addScaledVector(N,center);for(let k=0;k<=s.sides;k++){const angle=k/s.sides*Math.PI*2,c=Math.cos(angle),ss=Math.sin(angle),i=(s.offset+j*(s.sides+1)+k)*3;positions[i]=P.x+B.x*c*width+W.x*ss*height;positions[i+1]=P.y+B.y*c*width+W.y*ss*height;positions[i+2]=P.z+B.z*c*width+W.z*ss*height;const nn=B.clone().multiplyScalar(c/width).addScaledVector(W,ss/height).normalize();normals.set(nn.toArray(),i);}
  }geometry.attributes.position.needsUpdate=geometry.attributes.normal.needsUpdate=true;}
 update();return{group,update,stats:{pairedSeams:packet.spec.seams.filter(s=>active.has(s.id)).length,threadPaths:strokes.filter(s=>s.kind==='thread').length,hemRuns:strokes.filter(s=>s.kind==='hem').length,threadTriangles:indices.length/3,seamForceModel:'shared sewn cloth particles; thread micro-mechanics not solved'},plain(on){material.color.set(on?'#888888':color);},dispose(){geometry.dispose();material.dispose();}};
}
