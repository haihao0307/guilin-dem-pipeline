import {smooth,mix,sub,add,mul,dot,unit} from './HairStyleProfile.mjs';
import {rebuildGuide} from './ClumpShaping.mjs';
import {assertSilhouetteField} from './SilhouetteContract.mjs';

// Low-frequency authoring constraints for this P01 current-length groom.
// No surface mesh, material, gravity or child strands are generated here.
export function silhouetteProfile(profile,preset){
 if(!['silhouette-round','silhouette-framing'].includes(preset))throw Error('Unknown silhouette study');
 return {revision:'silhouette-wisps-08',preset,source:'cut-layered R07',protectedArc:.045,
  blendArc:.095,strength:1,wispSpread:.90,
  loft:{centerZ:.012,width:.100,depth:.102,widthEase:.003,depthEase:.006,layerWidth:.002,layerDepth:.003,shoulderFlare:.008},
  faceFrame:{enabled:preset==='silhouette-framing',tipDrop:.010,angleStart:1.00,angleSpan:.55,reference:'same-side retained temple outlets interpolated over source material angle'},
  collision:{clearance:.001,iterations:8},
  coordinates:'inherited head-aligned metres; signed material-route azimuth; source mid-wisp local coordinates',
  limits:'Authored static low-frequency loft, not a measured universal head/hair envelope, dense volume or physical solver.'};
}
function sign(g){return Math.sign(g.points.at(-3))||(g.macro.split('/').includes('left')?-1:1);}
function layer(g){return Math.max(0,Math.min(1,(g.points[1]-.27)/.16));}
function localLoft(y,angle,l,f){
 const q=f.loft,e=smooth((.29-y)/.10),flare=q.shoulderFlare*smooth((.23-y)/.10),w=q.width+q.widthEase*e+q.layerWidth*l+flare,d=q.depth-q.depthEase*smooth((.26-y)/.10)+q.layerDepth*l+flare;
 return {p:[Math.sin(angle)*w,y,q.centerZ+Math.cos(angle)*d],width:w,depth:d};
}

function templeLink(source,side,angle){
const sorted=source.filter(g=>(g.zone===6||g.zone===7)&&sign(g)===side).slice().sort((a,b)=>a.routeAngle-b.routeAngle);if(!sorted.length)throw Error('No retained temple reference');
let a=sorted[0],b=a;if(angle>=sorted.at(-1).routeAngle)a=b=sorted.at(-1);else if(angle>sorted[0].routeAngle){let n=1;while(n<sorted.length&&sorted[n].routeAngle<angle)n++;a=sorted[n-1];b=sorted[n];}
const t=a===b?0:Math.max(0,Math.min(1,(angle-a.routeAngle)/(b.routeAngle-a.routeAngle)));return{guideIDs:[a.id,b.id],weights:[1-t,t],referenceHem:a.cut.hem*(1-t)+b.cut.hem*t};
}
export function shapeSilhouette(source,graph,field,near){
 assertSilhouetteField(field);
 const mids=graph.filter(g=>g.level==='mid'),wisps=mids.map(group=>{
  const members=group.guides.map(id=>source.find(g=>g.id===id)),eligible=members.filter(g=>g.zone>1&&g.zone!==6&&g.zone!==7),center=eligible.length?eligible.reduce((s,g)=>s+g.routeAngle,0)/eligible.length:0;
  return {id:'loft/'+group.id,sourceMid:group.id,zone:group.zone,side:sign(members[0]),centerAngle:center,memberCoordinates:eligible.map(g=>({guide:g.id,angleOffset:g.routeAngle-center,radialLayer:layer(g)})),centerCurve:[]};
 });
 const byGuide=new Map();for(const w of wisps)for(const c of w.memberCoordinates)byGuide.set(c.guide,{w,c});
 const changes=[],guides=source.map(old=>{
  const g=structuredClone(old),binding=byGuide.get(g.id);if(!binding){changes.push({id:g.id,edited:false,reason:'fringe/temple geometry retained'});return g;}
  if(field.strength===0){changes.push({id:g.id,edited:false,reason:'zero-strength identity'});return g;}
  const {w,c}=binding,angle=w.centerAngle+c.angleOffset*field.wispSpread,face=field.faceFrame,frontWeight=1-smooth((old.routeAngle-face.angleStart)/face.angleSpan),frontReference=face.enabled&&frontWeight>0?templeLink(source,w.side,old.routeAngle):null,raise=frontReference?Math.max(0,(frontReference.referenceHem-face.tipDrop-old.cut.hem)*frontWeight):0,hem=old.cut.hem+raise*field.strength;
  const span=Math.max(.015,Math.min(field.blendArc,old.length-field.protectedArc-.015));let maxDisplacement=0,projections=0;
  for(let n=1;n<old.arcLengths.length;n++){
   const s=old.arcLengths[n];if(s<=field.protectedArc)continue;
   const p=old.points.slice(n*3,n*3+3),blend=smooth((s-field.protectedArc)/span)*field.strength,y=p[1]+raise*blend,loft=localLoft(y,angle,c.radialLayer,field).p;loft[0]*=w.side;
   let q=mix(p,loft,blend);q[1]=y;
   // Repel only when below the collision clearance; never attract free hair to
   // the neck. The original protected root prefix is never projected or moved.
   const sourceGap=near?Math.min(field.collision.clearance,near(p).signed):field.collision.clearance,requiredGap=sourceGap+(field.collision.clearance-sourceGap)*blend;
   if(near)for(let j=0;j<field.collision.iterations;j++){const hit=near(q);if(hit.signed>=requiredGap-1e-8)break;let normal=unit([hit.n[0],0,hit.n[2]]);if(Math.hypot(...normal)<.5)normal=unit([q[0],0,q[2]-field.loft.centerZ]);q=add(q,mul(normal,Math.min(.006,(requiredGap-hit.signed)/Math.max(.2,dot(normal,hit.n)))));projections++;}
   if(n===old.arcLengths.length-1)q[1]=hem;
   maxDisplacement=Math.max(maxDisplacement,Math.hypot(...sub(q,p)));g.points.splice(n*3,3,...q);
  }
  g.cut={hem,endpoint:g.points.slice(-3),operation:'static-silhouette-route',sourceStudy:'cut-layered',sourceHem:old.cut.hem,faceFrameWeight:face.enabled?frontWeight:0};rebuildGuide(g);
  changes.push({id:g.id,edited:true,sourceMid:w.sourceMid,authoringWisp:w.id,angle,sourceAngle:old.routeAngle,protectedArc:field.protectedArc,maxDisplacementMM:maxDisplacement*1000,sourceLength:old.length,finalLength:g.length,sourceHem:old.cut.hem,finalHem:hem,frontReference,collisionProjections:projections});return g;
 });
 for(const w of wisps){if(!w.memberCoordinates.length)continue;const members=w.memberCoordinates.map(c=>guides.find(g=>g.id===c.guide)),originals=w.memberCoordinates.map(c=>source.find(g=>g.id===c.guide)),end=members.reduce((s,g)=>s+g.cut.hem,0)/members.length,start=Math.max(end+.005,Math.min(.32,originals.reduce((s,g)=>{let n=g.arcLengths.findIndex(a=>a>=field.protectedArc);return s+g.points[n*3+1];},0)/originals.length)),l=w.memberCoordinates.reduce((s,c)=>s+c.radialLayer,0)/members.length;w.centerCurve=Array.from({length:17},(_,n)=>{const p=localLoft(start+(end-start)*n/16,w.centerAngle,l,field).p;p[0]*=w.side;return p;});}
 return {guides,wisps,report:{revision:field.revision,preset:field.preset,changes,editedGuides:changes.filter(c=>c.edited).length,maxDisplacementMM:Math.max(...changes.map(c=>c.maxDisplacementMM||0)),protectedArc:field.protectedArc,method:'source mid-wisp local angle/radial coordinates carried through authored elliptical loft; lower-guide deformation after fixed root prefix',limits:'Static current-length structure only. Body centreline tests do not certify self contact or finite fibre radius.'}};
}
