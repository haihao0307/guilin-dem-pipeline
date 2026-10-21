import fs from 'node:fs';
import path from 'node:path';
import {actorFor} from './native-actor.mjs';
import {fitNativeShoeSide} from '../../src/NativeShoes.mjs';
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
import {buildSurface,inspectOrientation} from './geometry-audit.mjs';
const ids=(process.env.ACTOR_IDS||'F').split(','),rows=[],root=globalThis.__SHOE_QA_ROOT__;
for(const id of ids){
 const actor=actorFor(id),body=new MeshContact(actor.nativeSource.positions,actor.nativeSource.faces);
 for(const side of (process.env.SHOE_SIDES||'L').split(',')){
  const started=performance.now(),fit=fitNativeShoeSide(actor,side),surfaces=[buildSurface(fit),buildSurface(fit,'insole')],records=[],q=new Float64Array(4),seenVertices=new Set(),seenEdges=new Set();
  const toNative=p=>{const x=fit.field.mirror*p[0]*fit.scaleM,z=p[2]*fit.scaleM+fit.field.centerF;return[fit.foot.foot[0]+fit.foot.right[0]*(x+fit.field.centerR)+fit.foot.forward[0]*z,fit.foot.foot[1]+fit.foot.right[1]*(x+fit.field.centerR)+fit.foot.forward[1]*z,p[1]*fit.scaleM+fit.field.baseZ];};
  const sample=(p,meta)=>{const n=toNative(p),f=body.nearest(...n);body.evaluate(f,...n,q);return{...meta,pointMm:p,native:n,signedDistanceM:q[0],bodyTriangle:f/3,bodyVertices:Array.from(actor.nativeSource.faces.subarray(f,f+3)),gradient:Array.from(q.subarray(1))};};
  for(const [surfaceIndex,surface]of surfaces.entries())for(const t of surface.triangles){
   for(let k=0;k<3;k++){const key=t.part+'/'+t.ids[k];if(!seenVertices.has(key)){seenVertices.add(key);records.push(sample(t.points[k],{part:t.part,kind:'vertex',vertex:t.ids[k],triangle:t.triangle,surfaceIndex}));}}
   records.push(sample([0,1,2].map(k=>(t.points[0][k]+t.points[1][k]+t.points[2][k])/3),{part:t.part,kind:'center',triangle:t.triangle,surfaceIndex}));
   for(let k=0;k<3;k++){const j=(k+1)%3,a=t.ids[k],b=t.ids[j],key=t.part+'/'+Math.min(a,b)+'/'+Math.max(a,b);if(seenEdges.has(key))continue;seenEdges.add(key);records.push(sample(t.points[k].map((x,i)=>(x+t.points[j][i])*.5),{part:t.part,kind:'edge',edge:[a,b],triangle:t.triangle,surfaceIndex}));}
  }
  records.sort((a,b)=>a.signedDistanceM-b.signedDistanceM);
  const topology=fit.model.parts.map((part,i)=>{const original=fit.sourceModel.parts[i],g=part.geometry,o=original.geometry,attrs={};for(const [name,attribute]of Object.entries(o.attributes)){if(name==='position'||name==='normal')continue;const actual=g.attributes[name];attrs[name]=!!actual&&actual.array.length===attribute.array.length&&actual.array.every((v,i)=>v===attribute.array[i]);}return{id:part.id,vertices:g.attributes.position.count,triangles:g.index.count/3,indexBytesIdentical:g.index.array.length===o.index.array.length&&g.index.array.every((v,i)=>v===o.index.array[i]),materialGroupsIdentical:JSON.stringify(g.groups)===JSON.stringify(o.groups),attributesIdentical:attrs};});
  const orientation=inspectOrientation(fit),r={actor:id,side,samples:records.length,innerTriangles:surfaces.reduce((s,x)=>s+x.triangles.length,0),completeBodyVertices:actor.nativeSource.bodyCount,completeBodyTriangles:actor.nativeSource.faces.length/3,minimumM:records[0].signedDistanceM,negativeCount:records.filter(x=>x.signedDistanceM<0).length,below1mmCount:records.filter(x=>x.signedDistanceM<.001).length,worst:records.slice(0,40),byPart:Object.fromEntries([...new Set(records.map(x=>x.part))].map(p=>{const a=records.filter(x=>x.part===p);return[p,{samples:a.length,minimumM:a[0].signedDistanceM,negative:a.filter(x=>x.signedDistanceM<0).length,below1mm:a.filter(x=>x.signedDistanceM<.001).length}]})),orientation,topology,sourceParts:fit.sourceModel.parts.length,sourceTriangles:fit.sourceModel.report.triangles,soleVertices:fit.record.solePointsNative.length,soleLiftM:fit.record.soleLiftM,maximumDisplacementM:fit.model.report.wearerFit.maximumDisplacementMm*fit.scaleM,fitting:fit.model.report.wearerFit,elapsedMS:performance.now()-started};
  rows.push(r);fs.writeFileSync(path.join(root,'evidence/shoe-recovery/'+(process.env.SHOE_QA_OUTPUT||'SURFACE_BODY_FIRST')+'.json'),JSON.stringify({schema:'native-shoe-inner-to-complete-body-samples/1',sourceHashes:globalThis.__SHOE_QA_SOURCE_HASHES__,rows,limitations:['Original MeshContact closest normal sign, evaluated on full canonical body; no body vertex omitted.','All current lining/insole vertices, triangle centers and unique edge midpoints; not a continuous whole-triangle separation certificate.','Ankle points above the real opening do not need to be classified as inside a closed shoe. No body or shoe geometry hidden.']},null,2)+'\n');
  console.log(JSON.stringify({actor:id,side,minimumM:r.minimumM,negative:r.negativeCount,below1mm:r.below1mmCount,orientationDisagreements:orientation.transportedNormalDisagreements,sourceParts:r.sourceParts,sourceTriangles:r.sourceTriangles,soleVertices:r.soleVertices,soleLiftM:r.soleLiftM,maximumDisplacementM:r.maximumDisplacementM,ms:r.elapsedMS}));
 }
}
