// Node-only actual-mesh checks. Browser visual acceptance is a separate gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from '../../material-master-workbench-r02/vendor/three.module.js';
import {buildObject as buildBaseline} from '../../material-master-workbench-r03/objects.mjs';
import {buildMetalObject,METAL_RECEIVER_PROVENANCE} from '../metal-objects.mjs';
const eq=(a,b,e=2e-7,msg='')=>assert(Math.abs(a-b)<e,`${msg}: ${a} != ${b}`);
const materials=Object.fromEntries(['metal','masonry','cloth','sign','lens','joint','drain'].map(k=>[k,new T.MeshStandardMaterial({side:T.DoubleSide})]));
const bounds=o=>new T.Box3().setFromObject(o);
const vector=a=>new T.Vector3(...a);
const report={passed:false,kind:'numerical actual-mesh validation; not browser visual acceptance',baseline:'R03 objects.mjs (byte-equal R02)',provenance:METAL_RECEIVER_PROVENANCE,before:{},after:{}};
assert.equal(fs.readFileSync(new URL('../../material-master-workbench-r02/objects.mjs',import.meta.url),'utf8'),fs.readFileSync(new URL('../../material-master-workbench-r03/objects.mjs',import.meta.url),'utf8'));
// Read the frozen, immutable source, not merely the hash claimed by the new module.
for(const [file,hash] of [['kst1-architecture-original.mjs',METAL_RECEIVER_PROVENANCE.frozenGeometrySHA256],['fh88-metal-original.mjs',METAL_RECEIVER_PROVENANCE.materialMotherSHA256]])assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../../material-master-workbench-r02/sources/'+file,import.meta.url))).digest('hex'),hash);

function actualAxis(mesh){const p=mesh.geometry.attributes.position;let min=Infinity,max=-Infinity;for(let i=0;i<p.count;i++){min=Math.min(min,p.getY(i));max=Math.max(max,p.getY(i));}return [new T.Vector3(0,min,0).applyMatrix4(mesh.matrixWorld),new T.Vector3(0,max,0).applyMatrix4(mesh.matrixWorld)];}
function findCrossing(root,c){
  const source=root.getObjectByName(c.member),target=root.getObjectByName(c.target);assert(source&&target,`${c.member} -> ${c.target} exists`);
  const start=vector(c.from),end=vector(c.at),dir=end.clone().sub(start),length=dir.length();dir.normalize();
  const cross=new T.Vector3(Math.abs(dir.y)<.85?0:1,Math.abs(dir.y)<.85?1:0,0).cross(dir).normalize(),other=dir.clone().cross(cross).normalize();
  const section=source.geometry.userData.section;
  const registered=root.userData.audit.members.find(v=>v.mesh===source.name);
  const radius=section?.kind==='round-hollow'?(section.outerRadius+section.innerRadius)/2:registered?.radius??source.geometry.parameters?.radiusTop??0;
  let distance=Infinity;
  // A hollow source has no centreline solid; test rays through its actual wall.
  const samples=section?.kind==='round-hollow'?24:25;
  for(let i=0;i<samples;i++){
    const r=(!section&&i===24)?0:radius,theta=2*Math.PI*i/24;
    const offset=cross.clone().multiplyScalar(Math.cos(theta)*r).addScaledVector(other,Math.sin(theta)*r);
    const ray=new T.Raycaster(start.clone().add(offset),dir,0,length+2e-6);
    const hits=ray.intersectObject(target,false);for(const h of hits)distance=Math.min(distance,h.distance);
  }
  assert(Number.isFinite(distance),`${c.member} has no actual triangle contact with ${c.target}`);return distance;
}
for(const family of ['rack','sign']){
  const original=buildBaseline(T,family,materials);original.updateMatrixWorld(true);
  const root=buildMetalObject(T,family,materials);root.updateMatrixWorld(true);const a=root.userData.audit;
  const wall=bounds(root.getObjectByName('wall'));eq(wall.max.z,root.userData.wallFront);
  const meshes=[];root.traverse(o=>{if(o.isMesh){meshes.push(o);const pos=o.geometry.attributes.position;for(let i=0;i<pos.count;i++)assert(Number.isFinite(pos.getX(i)+pos.getY(i)+pos.getZ(i)),`${o.name} finite`);assert(Object.values(materials).includes(o.material),`${o.name} externally supplied material`);assert(o.geometry.index?.count>0,`${o.name} indexed faces`);}});
  assert.equal(meshes.length,root.userData.stats.parts);const componentBounds=meshes.map(bounds),connected=new Set([meshes.findIndex(o=>o.name==='wall')]);let changed=true;while(changed){changed=false;for(let i=0;i<meshes.length;i++)if(!connected.has(i))for(const j of connected)if(componentBounds[i].clone().expandByScalar(2e-7).intersectsBox(componentBounds[j])){connected.add(i);changed=true;break;}}assert.equal(connected.size,meshes.length,'No component has an isolated bounding-box contact island');assert.equal(a.plates.length,4);assert.equal(a.anchors.length,16);assert(root.userData.jointOrigins.length<=16);
  let maxPlateGap=0,minEmbed=Infinity;
  for(const p of a.plates){const b=bounds(root.getObjectByName(p.mesh));const gap=b.min.z-wall.max.z;maxPlateGap=Math.max(maxPlateGap,Math.abs(gap));eq(gap,0,2e-7,`${p.mesh} flush`);eq(b.max.z,p.front);assert(b.min.x>=wall.min.x&&b.max.x<=wall.max.x&&b.min.y>=wall.min.y&&b.max.y<=wall.max.y,`${p.mesh} stays on actual wall`);}
  for(const bolt of a.anchors){const shaft=bounds(root.getObjectByName(bolt.shaft)),p=bounds(root.getObjectByName(bolt.plate));assert(shaft.min.z<wall.max.z-.06&&shaft.max.z>p.max.z+.01,`${bolt.shaft} crosses plate and wall`);assert(shaft.min.x>p.min.x&&shaft.max.x<p.max.x&&shaft.min.y>p.min.y&&shaft.max.y<p.max.y,`${bolt.shaft} within plate`);minEmbed=Math.min(minEmbed,wall.max.z-shaft.min.z);}
  let rayContacts=0,buttContacts=0,coaxialContacts=0;
  for(const c of a.connections){
    if(c.kind==='axis-enters-solid'){findCrossing(root,c);rayContacts++;}
    if(c.kind==='coaxial-seat'){const source=root.getObjectByName(c.member),target=root.getObjectByName(c.target);eq(source.geometry.userData.section.outerRadius,target.geometry.userData.section.innerRadius);const [a0,a1]=actualAxis(source),[b0,b1]=actualAxis(target);eq(a0.distanceTo(b0),0,2e-7);const d=a1.clone().sub(a0).normalize();eq(d.clone().cross(b1.clone().sub(b0).normalize()).length(),0,2e-7);coaxialContacts++;}
    if(c.kind==='butt-face'){const b1=bounds(root.getObjectByName(c.member)),b2=bounds(root.getObjectByName(c.target));const gap=Math.max(b2.min.y-b1.max.y,b1.min.y-b2.max.y);eq(gap,0,2e-7,`${c.member} meets ${c.target}`);buttContacts++;}
  }
  for(const s of a.sections){const o=root.getObjectByName(s.mesh),p=o.geometry.attributes.position,n=o.geometry.attributes.normal,ix=o.geometry.index;assert(s.wallThickness>0);for(let k=0;k<ix.count;k+=3){const ids=[ix.getX(k),ix.getX(k+1),ix.getX(k+2)],v=ids.map(i=>new T.Vector3().fromBufferAttribute(p,i));const actual=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize(),declared=new T.Vector3().fromBufferAttribute(n,ids[0]);assert(actual.dot(declared)>.98,s.mesh+' triangle winding agrees with outward/inner normal');}if(s.kind==='round-hollow'){let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));lo=Math.min(lo,r);hi=Math.max(hi,r);}eq(lo,s.innerRadius,1e-7,s.mesh+' inner radius');eq(hi,s.outerRadius,1e-7,s.mesh+' outer radius');eq(hi-lo,s.wallThickness,1e-7,s.mesh+' visible wall');}else{eq(s.wallThickness,.003);const xs=new Set(Array.from({length:p.count},(_,i)=>Math.abs(p.getX(i)).toFixed(6)));assert(xs.has((s.width/2).toFixed(6))&&xs.has((s.width/2-s.wallThickness).toFixed(6)));}}
  const b=bounds(root),size=b.getSize(new T.Vector3());assert(size.toArray().every(Number.isFinite));assert(size.y>=2.38&&size.y<=2.81);assert(root.userData.cameraTargets.overall.every(Number.isFinite));
  if(family==='rack'){
    const oldWall=bounds(original.children[0]),oldPlate=bounds(original.children[1]);eq(oldPlate.min.z-oldWall.max.z,.046,2e-7,'verified R03 rack plate gap');
    const oldArm=original.children[4];const [start,end]=actualAxis(oldArm);const offsets=[.52,.92,1.33].map(z=>({z,yOffset:1.88-(start.y+(end.y-start.y)*(z-start.z)/(end.z-start.z))}));eq(offsets[0].yOffset,.100465116,1e-7);eq(offsets[1].yOffset,.050852713,1e-7);
    report.before.rack={wallGapM:oldPlate.min.z-oldWall.max.z,crossbarEndpointAxisOffsetsM:offsets,unplatedBraceRoots:2};
    for(let i=0;i<3;i++){const line=root.getObjectByName(`line-${i}`);for(const side of ['left','right']){const end=vector(line.userData.curve[side==='left'?0:line.userData.curve.length-1]);const [a0,a1]=actualAxis(root.getObjectByName(`${side}-arm`));const d=a1.clone().sub(a0);const nearest=a0.clone().addScaledVector(d,end.clone().sub(a0).dot(d)/d.lengthSq());eq(end.distanceTo(nearest),0,2e-7,`${line.name} exactly seated ${side}`);}const pts=line.userData.curve;eq(pts[0][0],-.9);eq(pts.at(-1)[0],.9);eq(pts[0][1]-pts[18][1],.1);}
    eq(size.x,2.25,1e-7);assert(size.z>1.53&&size.z<1.57);
  }else{
    const oldWall=bounds(original.children[0]),oldPlate=bounds(original.children[1]);eq(oldPlate.min.z-oldWall.max.z,.005,2e-7,'verified R03 sign plate gap');
    // Old panel index 11; bolt index 12; rails 16–18, side frame index 9.
    const panel=bounds(original.children[11]),bolt=bounds(original.children[12]),rail=bounds(original.children[16]),left=bounds(original.children[9]);
    eq(bolt.min.z-panel.max.z,.030,2e-7,'verified R03 panel bolt gap');eq(rail.min.x-left.max.x,.0175,2e-7,'verified R03 rail stop');eq(panel.min.z-rail.max.z,.0245,2e-7,'verified R03 panel rail gap');
    report.before.sign={wallGapM:oldPlate.min.z-oldWall.max.z,panelBoltGapM:bolt.min.z-panel.max.z,railEndpointGapM:rail.min.x-left.max.x,panelRailGapM:panel.min.z-rail.max.z,unplatedBraceRoots:2};
    const panelNow=bounds(root.getObjectByName('sign-panel'));for(let i=0;i<3;i++)eq(panelNow.min.z,bounds(root.getObjectByName(`rear-rail-${i}`)).max.z,2e-7,`rail ${i} supports panel`);
    eq(size.y,2.8,2e-7);assert(size.x>2.10&&size.x<2.13);
  }
  report.after[family]={parts:meshes.length,connectedBoundingComponents:connected.size,boundsM:{min:b.min.toArray(),max:b.max.toArray(),size:size.toArray()},flushPlates:a.plates.length,maxPlateGapM:maxPlateGap,throughPlateAnchors:a.anchors.length,minimumWallEmbedM:minEmbed,actualTriangleConnections:rayContacts,buttConnections:buttContacts,coaxialSeats:coaxialContacts,hollowSections:a.sections.length,jointOrigins:root.userData.jointOrigins,changes:a.changes};
}
assert.throws(()=>buildMetalObject(T,'lamp',materials),RangeError);
assert.throws(()=>buildMetalObject(T,'rack',{metal:materials.metal}),TypeError);
report.passed=true;fs.writeFileSync(new URL('./metal-geometry-receipt.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
