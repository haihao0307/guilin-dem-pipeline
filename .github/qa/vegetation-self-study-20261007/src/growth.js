/* Developmental graph addition to VegetationGenerator 1.14.0.
   Retains the existing invariant from TreeArchitectureGrowth.ts: parent attachment
   is resolved before descendants. Roots and shoots share the same axis representation.
   The former Pandanus support-root study supplies outward/downward curved-root logic.
   This is a bounded developmental reconstruction, not a botanical growth simulator. */
import * as THREE from '../vendor/three.module.js';
import {curve,seeded,clamp,smooth,sweep} from './geometry.js';
export function inverseSmoothstep(t){let lo=0,hi=1;for(let i=0;i<28;i++){const m=(lo+hi)/2;if(m*m*(3-2*m)<t)lo=m;else hi=m;}return (lo+hi)/2;}
export class GrowthGraph {
 constructor(){this.axes=[];this.byId=new Map();this.progress=0;}
 add({id,parentId=null,attachment=0,path,radius,birth,duration,kind='shoot',material,segments=32,sides=10}){
  if(this.byId.has(id))throw Error('Duplicate biological axis '+id);const parent=parentId?this.byId.get(parentId):null;if(parentId&&!parent)throw Error('Growth graph must be topological and connected');
  if(parent){const expected=parent.path.getPointAt(attachment),actual=path.getPointAt(0);if(expected.distanceTo(actual)>1e-5)throw Error('Detached axis '+id);birth=Math.max(birth,parent.birth+parent.duration*inverseSmoothstep(attachment));}
  const geometry=sweep(path,radius,{segments,sides,tip:.01,lobes:.035}),mesh=new THREE.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;
  const positions=geometry.attributes.position,reference=positions.array.slice(),frames=path.computeFrenetFrames(segments,false),centers=Array.from({length:segments+1},(_,i)=>path.getPointAt(i/segments));
  const axis={id,parentId,attachment,path,radius,birth,duration,kind,geometry,mesh,positions,reference,frames,centers,segments,sides,progress:-1};this.axes.push(axis);this.byId.set(id,axis);return axis;
 }
 update(age){this.progress=clamp(age);for(const a of this.axes){const g=smooth(a.birth,a.birth+a.duration,age);if(Math.abs(g-a.progress)<.0001)continue;a.progress=g;a.mesh.visible=g>0.001;if(!a.mesh.visible)continue;
   const tip=a.path.getPointAt(g),secondary=.28+.72*Math.sqrt(g);for(let i=0;i<=a.segments;i++){const t=i/a.segments,c=t<=g?a.centers[i]:tip,fade=clamp((g-t)/.04),rScale=secondary*fade;for(let j=0;j<=a.sides;j++){const n=(i*(a.sides+1)+j)*3,old=a.centers[i];a.positions.setXYZ(n/3,c.x+(a.reference[n]-old.x)*rScale,c.y+(a.reference[n+1]-old.y)*rScale,c.z+(a.reference[n+2]-old.z)*rScale);}}
   // Cap centres follow the actual growing tip, never the mature endpoint.
   const n=(a.segments+1)*(a.sides+1);a.positions.setXYZ(n,...a.path.getPointAt(0).toArray());a.positions.setXYZ(n+1,...tip.toArray());a.positions.needsUpdate=true;a.geometry.computeVertexNormals();a.geometry.computeBoundingSphere();
  }}
 evidence(){return {axisCount:this.axes.length,rootAxes:this.axes.filter(a=>a.kind==='root').length,shootAxes:this.axes.filter(a=>a.kind!=='root').length,progress:this.progress,connected:this.axes.every(a=>!a.parentId||a.path.getPointAt(0).distanceTo(this.byId.get(a.parentId).path.getPointAt(a.attachment))<1e-5),activeAttachmentsValid:this.axes.every(a=>!a.parentId||a.progress<.001||this.byId.get(a.parentId).progress>=a.attachment-1e-6),wholeObjectScaling:false};}
}
export function addRootNetwork(graph,group,material,{scale=1,seed=207}={}){
 const rand=seeded(seed),main=graph.add({id:'radicle',path:curve([[0,0,0],[.06*scale,-.18*scale,0],[-.08*scale,-.55*scale,.08*scale],[.03*scale,-1.13*scale,.03*scale]]),radius:.045*scale,birth:.015,duration:.26,kind:'root',material,segments:40,sides:12});group.add(main.mesh);
 for(let n=0;n<9;n++){const at=.14+n*.075,start=main.path.getPointAt(at),az=n*2.399963+rand()*.4,len=(.9-n*.045)*scale;const direction=new THREE.Vector3(Math.cos(az),-.28-rand()*.25,Math.sin(az));const p1=start.clone().addScaledVector(direction,len*.4),end=start.clone().addScaledVector(direction,len);p1.y-=.07*scale;
  const a=graph.add({id:'root-'+n,parentId:'radicle',attachment:at,path:curve([start,p1,end]),radius:.018*scale,birth:.10+n*.018,duration:.27,kind:'root',material,segments:25,sides:8});group.add(a.mesh);
  for(let j=0;j<4;j++){const u=.28+j*.18,sp=a.path.getPointAt(u),side=new THREE.Vector3(Math.cos(az+(j%2?1:-1)), -.5-rand()*.25,Math.sin(az+(j%2?1:-1)));const len2=(.15+rand()*.18)*scale;const fine=graph.add({id:`root-${n}-${j}`,parentId:a.id,attachment:u,path:curve([sp,sp.clone().addScaledVector(side,len2*.4),sp.clone().addScaledVector(side,len2)]),radius:.006*scale,birth:.24+n*.015+j*.02,duration:.18,kind:'root',material,segments:12,sides:5});group.add(fine.mesh);}
 }
 return main;
}
