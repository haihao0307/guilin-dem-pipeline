import {unit,sub,mul,add,mix,dot,smooth} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// Local P01 crown authoring. Source arcs address immutable R10 points, never
// the rebuilt curve's arc. The same field supplies roots and full guide launch.
export function upperRestProfile(profile){return{revision:'upper-rest-11',source:'rest10-reference',whorl:structuredClone(profile.WhorlField[0]),part:structuredClone(profile.PartingCurves[0]),strength:.7,radiusScale:1.35,rootMinY:.365,rootFade:.030,launchHold:.008,reach:.080,minPointY:.335,heightFade:.020};}
export function assertUpperRestField(f){
 if(f?.revision!=='upper-rest-11'||f.source!=='rest10-reference'||!f.whorl||!Array.isArray(f.part?.points)||f.part.points.length<2||f.part.points.some(p=>p.length!==3||p.some(v=>!Number.isFinite(v))))throw Error('Invalid upper-rest source');
 const limits={strength:[0,1],radiusScale:[1,1.5],rootMinY:[.365,.365],rootFade:[.030,.030],launchHold:[.008,.008],reach:[.080,.080],minPointY:[.335,.335],heightFade:[.020,.020]};
 for(const[k,[a,b]]of Object.entries(limits))if(!Number.isFinite(f[k])||f[k]<a||f[k]>b)throw Error('Upper-rest control outside scope: '+k);
 const w=f.whorl;if(!Array.isArray(w.center)||w.center.length!==3||w.center.some(v=>!Number.isFinite(v))||!Number.isFinite(w.radius)||w.radius<=0||!Number.isFinite(w.strength)||w.strength<0||w.strength>1||typeof w.clockwise!=='boolean'||!(w.coreRadius>0&&w.coreRadius<w.radius))throw Error('Invalid crown whorl');return true;
}
export function upperRootWeight(p,zone,f){
 if(zone<=1)return 0;const w=f.whorl,r=Math.hypot(p[0]-w.center[0],p[2]-w.center[2]);
 // Continuous core regularization and fade into the existing front part.
 const partEndZ=f.part.points.at(-1)[2];return f.strength*w.strength*(1-smooth((r-w.coreRadius)/(w.radius*f.radiusScale-w.coreRadius)))*smooth(r/w.coreRadius)*smooth((p[1]-f.rootMinY)/f.rootFade)*(1-smooth((p[2]-partEndZ-.020)/.035));
}
export function upperRootDirection(row,f){
 const p=row.slice(4,7),n=row.slice(7,10),old=row.slice(13,16),weight=upperRootWeight(p,row[23],f);if(!weight)return old;
 const w=f.whorl,dx=p[0]-w.center[0],dz=p[2]-w.center[2],sign=w.clockwise?1:-1,spin=[dx*.8+dz*sign,-.08,dz*.8-dx*sign],t=unit(sub(spin,mul(n,dot(spin,n)))),source=unit(row.slice(10,13)),tangent=unit(mix(source,t,weight));return unit(add(tangent,mul(n,row[18])));
}
export function shapeUpperRest(source,sourceRoots,f){
 assertUpperRestField(f);let changedGuides=0,maxDisplacementMM=0,maxRootRotationDegrees=0;const affected=[];
 const guides=source.map(old=>{
  const row=Array.from(sourceRoots.subarray(old.rootId*26,old.rootId*26+26)),weight=upperRootWeight(row.slice(4,7),old.zone,f);if(!weight)return structuredClone(old);
  const g=structuredClone(old),launch=unit(sub(old.points.slice(3,6),old.points.slice(0,3))),desired=upperRootDirection(row,f),delta=sub(desired,launch);let localMax=0;
  for(let n=1;n<old.arcLengths.length;n++){
   const s=old.arcLengths[n],p=old.points.slice(n*3,n*3+3);if(s>=f.reach||p[1]<=f.minPointY)continue;
   const envelope=s*(1-smooth((s-f.launchHold)/(f.reach-f.launchHold)))*smooth((p[1]-f.minPointY)/f.heightFade),q=add(p,mul(delta,envelope));g.points.splice(n*3,3,...q);localMax=Math.max(localMax,Math.hypot(...sub(q,p))*1000);
  }
  if(localMax>1e-7){rebuildGuide(g);changedGuides++;affected.push(g.id);maxDisplacementMM=Math.max(maxDisplacementMM,localMax);maxRootRotationDegrees=Math.max(maxRootRotationDegrees,Math.acos(Math.max(-1,Math.min(1,dot(launch,desired))))*180/Math.PI);}return g;
 });return{guides,report:{revision:f.revision,source:f.source,changedGuides,affected,maxDisplacementMM,maxRootRotationDegrees,reach:f.reach,minPointY:f.minPointY,method:'shared native crown tangent, smooth compact-support full-curve launch deformation, fixed downstream points',physics:false}};
}
export function updateUpperRoots(roots,f){let changed=0;const source=roots.slice();for(let i=0;i<roots.length/26;i++){const o=i*26,row=Array.from(source.subarray(o,o+26));if(!row[25]||!upperRootWeight(row.slice(4,7),row[23],f))continue;const d=upperRootDirection(row,f),n=row.slice(7,10),t=unit(sub(d,mul(n,dot(d,n))));for(let k=0;k<3;k++){roots[o+10+k]=t[k];roots[o+13+k]=d[k];}changed++;}return changed;}
export function assertUpperPreserved(source,output,f){
 assertUpperRestField(f);if(source.length!==output.length)throw Error('Upper rest lost guides');
 for(let i=0;i<source.length;i++){const a=source[i],b=output[i];for(const k of ['id','rootId','root','zone','macro','cut'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Upper rest changed native identity or cut');
  for(let n=0;n<a.arcLengths.length;n++)if(n===0||a.zone<=1||a.arcLengths[n]>=f.reach||a.points[n*3+1]<=f.minPointY)if(a.points.slice(n*3,n*3+3).some((v,k)=>v!==b.points[n*3+k]))throw Error('Upper rest changed protected fringe/downstream point');
  if(a.zone<=1)for(const k of ['frames','arcLengths','length'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Upper rest changed fringe geometry');
 }return true;
}
