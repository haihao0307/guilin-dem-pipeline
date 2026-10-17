import {ZONES,smooth,sub,mix} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';

// A cut is a prefix of an existing safe flow curve, never a scaled or extended
// strand. These are current-length authoring studies, not the three length grooms.
export function cutProfile(reference,preset){
 const layered=preset==='cut-layered';
 if(!['cut-u','cut-layered'].includes(preset))throw Error('Unknown cut study');
 return {...structuredClone(reference),mode:'continuous current-length end envelope; exact flow-curve prefix',study:preset,
  coordinates:'inherited head-aligned metres; root height for layering, outlet azimuth for silhouette',
  envelope:{sideRise:.016,frontRise:.026,asymmetry:.002,layerStart:.29,layerSpan:.12},
  regions:Object.fromEntries(ZONES.map(([id],z)=>[id,z<=1||z===6||z===7?{...reference.regions[id],edited:false}:{hem:.145,layer:layered?.010:0,edited:true}])),
  policy:{extension:false,rootMotion:false,pathDeformation:false,protectedRootArc:.085,fringeUnchanged:true,templeUnchanged:true,variation:'root-correlated layering; no independent per-node noise'}};
}

export function cutTarget(g,field){
 const region=field.regions[ZONES[g.zone][0]];
 if(!region.edited)return null;
 const root=g.points.slice(0,3),tip=g.points.slice(-3),e=field.envelope,theta=Math.atan2(Math.abs(tip[0]),tip[2]-.012),front=1-smooth(theta/1.6);
 return region.hem+e.sideRise*Math.sin(theta)**2+e.frontRise*front+e.asymmetry*Math.sin(theta)*Math.sign(tip[0])+region.layer*smooth((root[1]-e.layerStart)/e.layerSpan);
}

function firstDescendingHit(g,target){
 // Ignore the root exit and rising sections. A cut ends the first downward
 // passage through its surface, rather than jumping to a later crossing.
 for(let n=1;n<g.arcLengths.length;n++){
  const a=g.points.slice(n*3-3,n*3),b=g.points.slice(n*3,n*3+3);
  if(a[1]>=target&&b[1]<target){const t=(a[1]-target)/(a[1]-b[1]);return{segment:n-1,t,point:mix(a,b,t),arc:g.arcLengths[n-1]+Math.hypot(...sub(b,a))*t};}
 }
 return null;
}

export function cutGroom(source,field){
 const changes=[],guides=source.map(old=>{
  const target=cutTarget(old,field),hit=target===null?null:firstDescendingHit(old,target),g=structuredClone(old);
  if(!hit){changes.push({id:g.id,edited:false,reason:target===null?'fringe/temple retained':'reference ends before surface; no extension',targetY:target,sourceLength:old.length,finalLength:old.length,removedArc:0});return g;}
  if(hit.arc<=field.policy.protectedRootArc+.005)throw Error('Cut reached protected root comb region: '+g.id);
  const points=Array.from({length:hit.segment+1},(_,n)=>old.points.slice(n*3,n*3+3));
  if(Math.hypot(...sub(points.at(-1),hit.point))<1e-10)throw Error('Degenerate cut endpoint');points.push(hit.point);
  // Retain every source corner before the cut. Fill the 97-point transport by
  // subdividing only existing lower segments: no chord shortcuts or resampling
  // that moves the upper flow, and no new collision path is introduced.
  while(points.length<old.arcLengths.length){let best=-1,span=-1,arc=0;for(let n=1;n<points.length;n++){const d=Math.hypot(...sub(points[n],points[n-1]));if(arc>=field.policy.protectedRootArc&&d>span){best=n;span=d;}arc+=d;}if(best<0)throw Error('No lower segment available for cut transport');points.splice(best,0,mix(points[best-1],points[best],.5));}
  g.points=points.flat();g.cut={...g.cut,hem:target,sourceHem:old.cut.hem,operation:'exact-prefix-cut',targetY:target,sourceSegment:hit.segment,sourceFraction:hit.t,sourceArc:hit.arc};rebuildGuide(g);
  changes.push({id:g.id,edited:true,targetY:target,sourceLength:old.length,finalLength:g.length,removedArc:old.length-g.length,sourceSegment:hit.segment,sourceFraction:hit.t});return g;
 });
 return{guides,report:{revision:'length-cut-07',study:field.study,method:'independent spatial cut envelope and physical arc; retain exact original flow prefix',changes,editedGuides:changes.filter(c=>c.edited).length,maxRemovedArcMM:Math.max(...changes.map(c=>c.removedArc))*1000,rootMotion:false,pathDeformation:false,extension:false,limits:'Current-length shortening studies. No new ear-length/chest-length styles, finite-radius collision or fibre taper acceptance.'}};
}
