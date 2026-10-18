/** First-party bounded planar coupling test rig. No original mechanics are edited.
 * This solves two revolute-joint positions, not train dynamics or a certified coupler.
 * All generated parts use the locomotive rest world frame. Coach native geometry
 * remains in its own local frame; transforms.coach places that complete assembly.
 */
import {A6Mesh,range,boundsOf} from './a6-shell-geometry.mjs';
export const A6_COUPLING_MOTION_DEFAULTS=Object.freeze({coachOffsetZ:32.34,coachYawDeg:0,linkYawDeg:0,tensionKN:0});
export const A6_COUPLING_JOINTS=Object.freeze({tenderPin:Object.freeze([0,.82,20.18]),coachPinLocal:Object.freeze([0,.82,-11.60]),tenderNativeCentre:Object.freeze([0,1.30,19.977875]),coachNativeHeadLocal:Object.freeze([0,.82,-11.43]),pinRadiusM:.024,boreRadiusM:.026,linkThicknessM:.040,clevisInnerGapM:.052,demonstrationYawLimitDeg:12});
const V={add:(a,b)=>a.map((v,i)=>v+b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),mul:(a,s)=>a.map(v=>v*s),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]};
const len=a=>Math.hypot(...a),norm=a=>V.mul(a,1/len(a)),radians=d=>d*Math.PI/180;
export const rotateA6Yaw=(p,yaw)=>[Math.cos(yaw)*p[0]+Math.sin(yaw)*p[2],p[1],-Math.sin(yaw)*p[0]+Math.cos(yaw)*p[2]];
export function transformA6Point(p,t){return V.add(rotateA6Yaw(p,t.yawRad),t.position);}
const identity=()=>({position:[0,0,0],yawRad:0});
function inputs(input,allowPose=true){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Expected coupling parameter object');
  const allowed=allowPose?Object.keys(A6_COUPLING_MOTION_DEFAULTS):['coachOffsetZ'];
  for(const key of Object.keys(input))if(!allowed.includes(key))throw new RangeError(`Unknown coupling parameter: ${key}`);
  const p={...A6_COUPLING_MOTION_DEFAULTS,...input};
  if(!Object.hasOwn(input,'linkYawDeg'))p.linkYawDeg=p.coachYawDeg/2;
  if(!Object.values(p).every(Number.isFinite))throw new TypeError('Coupling parameters must be finite');
  if(p.coachOffsetZ<32.15||p.coachOffsetZ>32.60)throw new RangeError('coachOffsetZ outside supported rest layout');
  if(Math.abs(p.coachYawDeg)>12||Math.abs(p.linkYawDeg)>12)throw new RangeError('Outside bounded ±12 degree articulation inspection range');
  if(p.tensionKN<0||p.tensionKN>500)throw new RangeError('Illustrative tensile load must be 0–500 kN');
  return p;
}
/** One input angle is the coach body yaw. The optional link angle defaults to the
 * angular bisector; that is an explicit bench prescription, never a track solver.
 * The coach origin is solved from B = A + R(linkYaw)[0,0,L] and O = B-R(coachYaw)b.
 */
export function solveA6CouplingPose(input={}){
  const p=inputs(input),a=[...A6_COUPLING_JOINTS.tenderPin],b=[...A6_COUPLING_JOINTS.coachPinLocal],restB=V.add(b,[0,0,p.coachOffsetZ]);
  const lengthM=restB[2]-a[2],coachYaw=radians(p.coachYawDeg),linkYaw=radians(p.linkYawDeg),endB=V.add(a,rotateA6Yaw([0,0,lengthM],linkYaw));
  const coach={position:V.sub(endB,rotateA6Yaw(b,coachYaw)),yawRad:coachYaw};
  const drawbar={position:V.sub(a,rotateA6Yaw(a,linkYaw)),yawRad:linkYaw,pivot:a};
  const coachDesign={position:V.sub(coach.position,rotateA6Yaw([0,0,p.coachOffsetZ],coachYaw)),yawRad:coachYaw};
  const fromCoach=transformA6Point(b,coach),fromDrawbar=transformA6Point(restB,drawbar),force=V.mul(norm(V.sub(a,endB)),p.tensionKN);
  const closureErrorM=Math.max(len(V.sub(fromCoach,endB)),len(V.sub(fromDrawbar,endB)),Math.abs(len(V.sub(endB,a))-lengthM));
  return {schema:'kaopu.a6-planar-coupling-pose/1.0',parameters:p,transforms:{fixed:identity(),drawbar,coach,coachDesign},
    joints:[{id:'tender-pin',position:a,axis:[0,1,0],angleDeg:p.linkYawDeg,type:'revolute-y'},{id:'coach-pin',position:endB,axis:[0,1,0],angleDeg:p.coachYawDeg-p.linkYawDeg,type:'revolute-y'}],
    lengthM,actualLengthM:len(V.sub(endB,a)),closureErrorM,
    forcePath:{kind:'illustrative-static-two-force-member',prescribedTensionKN:p.tensionKN,coachForceKN:force,tenderForceKN:V.mul(force,-1),netInternalForceKN:[0,0,0],
      dropHeightM:.48,illustrativeTenderMomentKNm:V.cross([0,-.48,0],V.mul(force,-1)),
      orderedComponents:['native tender rear dragbox','new drop saddle and gussets','tender vertical pin in double-shear clevis','constant-length two-eye drawbar','coach vertical pin in double-shear clevis','new split clamp around native coach shank','native coach shank and drawgear','native coach headstock'],
      topologyDefined:true,attachmentAndStrengthVerified:false,loadDrivenMotion:false},
    validation:{planarJointClosureSolved:true,fullTrainKinematicsSolved:false,railWheelContactSolved:false,locomotiveTenderArticulation:false,greenShroudEndpointGeometry:'separate buildA6FlexibleTransitions({couplingPose}) output required for this pose',greenShroudMaterialElasticitySolved:false,
      status:'prescribed-angle coupling inspection; collision result required separately',
      limitations:['Loco and tender remain one rigid inspection unit: three native parallel links cannot be yawed independently without resolving their constraints.','Coach yaw and optional link yaw are prescribed inputs; coach translation is solved, never an ornamental offset.','Whole coach, including bogies, wheels, shell, native head and gangway, moves rigidly; no rolling-on-track claim.','Pitch, roll, slack, buffing, clamp preload, exact coupler compatibility and structural strength remain unresolved.','The visible green transition must be built with this couplingPose to follow both endpoints; a fixed shroud is retained only as a failed comparison case.']}};
}
const META={originalMechanicalComponent:false,provisional:true,sourceGeometryUsed:false,mechanicalEngineeringValidated:false};
function mesh(name,body,material='brushedMetal',extra={}){return new A6Mesh(name,material,'design-planar-coupling',{...META,motionBody:body,...extra});}
function box(name,c,size,body,material='blackPaint'){
  const m=mesh(name,body,material),q=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(v=>v.map((x,i)=>c[i]+x*size[i]/2));
  for(const [ids,n]of [[[0,3,2,1],[0,0,-1]],[[4,5,6,7],[0,0,1]],[[0,4,7,3],[-1,0,0]],[[1,2,6,5],[1,0,0]],[[0,1,5,4],[0,-1,0]],[[3,7,6,2],[0,1,0]]])m.quad(ids.map((i,k)=>({point:q[i],normal:n,uv:[[0,0],[1,0],[1,1],[0,1]][k]})));
  return m.finish();
}
function ring(name,c,inner,outer,thickness,body,axis='y',arc=[0,2*Math.PI]){
  const m=mesh(name,body,'brushedMetal',{openBore:true,boreRadiusM:inner}),angs=range(...arc,32),map=([x,y,z])=>axis==='z'?[x,z,y]:[x,y,z],P=(r,y,a)=>V.add(c,map([r*Math.cos(a),y,r*Math.sin(a)]));
  for(let i=0;i<32;i++){
    const a=angs[i],b=angs[i+1];
    for(const s of [-1,1]){const y=s*thickness/2;m.quad([[inner,a],[outer,a],[outer,b],[inner,b]].map(([r,t])=>({point:P(r,y,t),normal:map([0,s,0]),uv:[r,t]})));}
    for(const [r,s]of [[outer,1],[inner,-1]])m.quad([[a,-thickness/2],[b,-thickness/2],[b,thickness/2],[a,thickness/2]].map(([t,y])=>({point:P(r,y,t),normal:map([s*Math.cos(t),0,s*Math.sin(t)]),uv:[t*r,y]})));
  }
  for(const [a,s]of [[arc[0],-1],[arc[1],1]])if(arc[1]-arc[0]<2*Math.PI-1e-5)m.quad([[inner,-thickness/2],[outer,-thickness/2],[outer,thickness/2],[inner,thickness/2]].map(([r,y])=>({point:P(r,y,a),normal:map([s*-Math.sin(a),0,s*Math.cos(a)]),uv:[r,y]})));
  return m.finish();
}
function cylinder(name,c,r,h,body){
  const m=mesh(name,body,'brushedMetal',{jointPin:true}),angs=range(0,2*Math.PI,32),P=(a,y)=>[c[0]+r*Math.cos(a),c[1]+y,c[2]+r*Math.sin(a)];
  for(let i=0;i<32;i++){const a=angs[i],b=angs[i+1];m.quad([[a,-h/2],[b,-h/2],[b,h/2],[a,h/2]].map(([t,y])=>({point:P(t,y),normal:[Math.cos(t),0,Math.sin(t)],uv:[t*r,y]})));for(const s of [-1,1])m.triangle([[c[0],c[1]+s*h/2,c[2]],P(a,s*h/2),P(b,s*h/2)],[[0,s,0],[0,s,0],[0,s,0]],[[0,0],[r,a],[r,b]]);}
  return m.finish();
}
function xCylinder(name,c,r,h,body){const part=cylinder(name,c,r,h,body);for(let i=0;i<part.positions.length;i+=3){const x=part.positions[i]-c[0],y=part.positions[i+1]-c[1];part.positions[i]=c[0]+y;part.positions[i+1]=c[1]-x;const nx=part.normals[i],ny=part.normals[i+1];part.normals[i]=ny;part.normals[i+1]=-nx;}return part;}
/** .parts and .partsByBody are all rest-WORLD geometry. Apply transforms.fixed,
 * transforms.drawbar, transforms.coachDesign respectively. Existing coach local
 * groups use transforms.coach instead. No frozen native components are replaced. */
export function buildA6CouplingMotion(input={}){
  const p=inputs(input,false),a=[...A6_COUPLING_JOINTS.tenderPin],b=V.add(A6_COUPLING_JOINTS.coachPinLocal,[0,0,p.coachOffsetZ]),parts=[];
  parts.push(box('a6-joint-tender-drop-backplate',[0,1.09,20.087875],[.32,.54,.020],'fixed'));
  for(const side of [-1,1])parts.push(cylinder(`a6-joint-tender-drop-vertical-weld-${side}`,[side*.16,1.25,20.078],.008,.22,'fixed'));
  parts.push(xCylinder('a6-joint-tender-drop-upper-weld',[0,1.36,20.078],.008,.32,'fixed'));
  // The two vertical flanges carry the offset conceptually. Original dragbox
  // machining/bolted or welded attachment is deliberately not claimed verified.
  for(const s of [-1,1])parts.push(box(`a6-joint-tender-drop-side-web-${s}`,[s*.137,.99,20.14],[.045,.34,.115],'fixed'));
  for(const [id,c,body,direction]of [['tender',a,'fixed',-1],['coach',b,'coach',1]]){
    for(const s of [-1,1]){
      const y=c[1]+s*.0435;
      parts.push(ring(`a6-joint-${id}-clevis-eye-${s}`,[c[0],y,c[2]],.026,.068,.035,body));
      // Neck meets the eye outside its bore, not through the moving pin.
      parts.push(box(`a6-joint-${id}-clevis-neck-${s}`,[c[0],y,c[2]+direction*(id==='coach'?.070:.082)],[.090,.035,id==='coach'?.056:.080],body));
    }
    parts.push(cylinder(`a6-joint-${id}-vertical-pin`,c,.024,.16,body));
    parts.push(ring(`a6-joint-${id}-pin-retainer`,[c[0],c[1]+.085,c[2]],.021,.040,.012,body));
  }
  for(const [id,c]of [['tender',a],['coach',b]])parts.push(ring(`a6-joint-drawbar-${id}-eye`,c,.026,.062,.04,'drawbar'));
  parts.push(box('a6-joint-fixed-length-drawbar',[0,.82,(a[2]+b[2])/2],[.066,.040,b[2]-a[2]-.088],'drawbar','brushedMetal'));
  // A new two-piece clamp preserves rather than replaces the unresolved native
  // head. Its bore follows the actual .067 m shank radius. Clamp preload and
  // axial grip are open engineering requirements, not a completed attachment.
  const clampZ=p.coachOffsetZ-11.30;
  for(const s of [-1,1]){
    const arc=s===1?[-Math.PI/2+.01,Math.PI/2-.01]:[Math.PI/2+.01,3*Math.PI/2-.01];
    parts.push(ring(`a6-joint-coach-split-shank-clamp-${s}`,[0,.82,clampZ],.067,.105,.040,'coach','z',arc));
    parts.push(box(`a6-joint-coach-clamp-side-arm-${s}`,[s*.116,.82,(b[2]+.085+clampZ)/2],[.033,.045,clampZ-b[2]-.085],'coach','brushedMetal'));
  }
  for(const ySide of [-1,1]){
    for(const xSide of [-1,1])parts.push(box(`a6-joint-coach-clamp-ear-${ySide}-${xSide}`,[xSide*.04,.82+ySide*.115,clampZ],[.070,.042,.060],'coach','brushedMetal'));
    parts.push(xCylinder(`a6-joint-coach-clamp-tightening-bolt-${ySide}`,[0,.82+ySide*.115,clampZ],.012,.18,'coach'));
    parts.push(xCylinder(`a6-joint-coach-clamp-tightening-nut-${ySide}`,[.081,.82+ySide*.115,clampZ],.021,.018,'coach'));
  }
  parts.push(box('a6-joint-coach-clevis-crossbar',[0,.82,b[2]+.085],[.264,.125,.035],'coach','brushedMetal'));
  const partsByBody=Object.fromEntries(['fixed','drawbar','coach'].map(body=>[body,parts.filter(p=>p.metadata.motionBody===body)]));
  const pose=solveA6CouplingPose({coachOffsetZ:p.coachOffsetZ});
  return {schema:'kaopu.a6-planar-coupling-concept/1.0',parts,partsByBody,parameters:{coachOffsetZ:p.coachOffsetZ},bounds:boundsOf(parts),restPose:pose,
    evidence:{nativeTenderAnchor:[0,1.30,19.977875],nativeTenderRearBeamFaceZ:20.077875,nativeCoachShankRadiusM:.067,nativeCoachHeadLocal:[0,.82,-11.43],newCoachPinLocal:[0,.82,-11.60],newPinSpacingM:pose.lengthM,heightOffsetM:.48,eyeDiametralClearanceM:.004,linkClevisSideClearanceM:.006,
      newPartCount:parts.length,originalMechanicalPartsChanged:0,teacherGeometryBytes:0,workingJointScope:'two prescribed planar revolute joints and exactly closed rigid link',
      nativeMountingStatus:'new tender drop saddle has explicit weld seams; coach split clamp has two tightening bolts and four ears. Weld size, clamp preload/axial grip and strength require engineering; native attachment is not load-validated'},
    forcePath:pose.forcePath,limitations:pose.validation.limitations};
}

// Mesh-based interference audit. All original vertices are retained. AABB trees
// prune triangle pairs; remaining surface distances use vertex/triangle,
// edge/edge and segment/triangle tests. This reports surface contact/intersection,
// not penetration depth, volume containment, elasticity or operational safety.
function triBounds(t){return {min:[0,1,2].map(j=>Math.min(...t.map(p=>p[j]))),max:[0,1,2].map(j=>Math.max(...t.map(p=>p[j])))};}
function union(boxes){const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];for(const b of boxes)for(let j=0;j<3;j++){min[j]=Math.min(min[j],b.min[j]);max[j]=Math.max(max[j],b.max[j]);}return {min,max};}
function boxDist2(a,b){let d=0;for(let k=0;k<3;k++){const x=Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k]);d+=x*x;}return d;}
function triangles(part,t=identity()){
  const out=[],a=part.positions,ids=part.indices;
  for(let i=0;i<ids.length;i+=3){const points=[0,1,2].map(j=>{const k=ids[i+j]*3;return transformA6Point([a[k],a[k+1],a[k+2]],t);}),box=triBounds(points);out.push({points,box,triangle:i/3});}
  return out;
}
function bvh(tris){
  if(!tris.length)return null;
  const box=union(tris.map(t=>t.box));if(tris.length<=8)return {box,tris};
  const size=box.max.map((v,i)=>v-box.min[i]),axis=size.indexOf(Math.max(...size)),sort=[...tris].sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis])),mid=Math.floor(sort.length/2);
  return {box,left:bvh(sort.slice(0,mid)),right:bvh(sort.slice(mid))};
}
function pointTriangle2(p,a,b,c){
  const ab=V.sub(b,a),ac=V.sub(c,a),ap=V.sub(p,a),d1=V.dot(ab,ap),d2=V.dot(ac,ap);
  if(d1<=0&&d2<=0)return V.dot(ap,ap);
  const bp=V.sub(p,b),d3=V.dot(ab,bp),d4=V.dot(ac,bp);if(d3>=0&&d4<=d3)return V.dot(bp,bp);
  const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const q=V.sub(p,V.add(a,V.mul(ab,d1/(d1-d3))));return V.dot(q,q);}
  const cp=V.sub(p,c),d5=V.dot(ab,cp),d6=V.dot(ac,cp);if(d6>=0&&d5<=d6)return V.dot(cp,cp);
  const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const q=V.sub(p,V.add(a,V.mul(ac,d2/(d2-d6))));return V.dot(q,q);}
  const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const q=V.sub(p,V.add(b,V.mul(V.sub(c,b),(d4-d3)/((d4-d3)+(d5-d6)))));return V.dot(q,q);}
  const den=va+vb+vc;if(Math.abs(den)<1e-24)return Math.min(...[a,b,c].map(q=>V.dot(V.sub(p,q),V.sub(p,q))));
  const q=V.sub(p,V.add(a,V.add(V.mul(ab,vb/den),V.mul(ac,vc/den))));return V.dot(q,q);
}
function segmentSegment2(p1,q1,p2,q2){
  const d1=V.sub(q1,p1),d2=V.sub(q2,p2),r=V.sub(p1,p2),a=V.dot(d1,d1),e=V.dot(d2,d2),f=V.dot(d2,r),clamp=x=>Math.max(0,Math.min(1,x));let s,t;
  if(a<=1e-24&&e<=1e-24)return V.dot(r,r);
  if(a<=1e-24){s=0;t=clamp(f/e);}else{const c=V.dot(d1,r);if(e<=1e-24){t=0;s=clamp(-c/a);}else{const b=V.dot(d1,d2),den=a*e-b*b;s=Math.abs(den)>1e-24?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
  const q=V.sub(V.add(p1,V.mul(d1,s)),V.add(p2,V.mul(d2,t)));return V.dot(q,q);
}
function segmentHitsTriangle(p,q,a,b,c){
  const d=V.sub(q,p),e1=V.sub(b,a),e2=V.sub(c,a),h=V.cross(d,e2),det=V.dot(e1,h);if(Math.abs(det)<1e-12)return false;
  const f=1/det,s=V.sub(p,a),u=f*V.dot(s,h);if(u< -1e-9||u>1+1e-9)return false;
  const v=f*V.dot(d,V.cross(s,e1));if(v< -1e-9||u+v>1+1e-9)return false;
  const t=f*V.dot(e2,V.cross(s,e1));return t>=-1e-9&&t<=1+1e-9;
}
export function a6TriangleDistanceSquared(a,b){
  for(let i=0;i<3;i++)if(segmentHitsTriangle(a[i],a[(i+1)%3],...b)||segmentHitsTriangle(b[i],b[(i+1)%3],...a))return 0;
  let d=Math.min(...a.map(p=>pointTriangle2(p,...b)),...b.map(p=>pointTriangle2(p,...a)));
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)d=Math.min(d,segmentSegment2(a[i],a[(i+1)%3],b[j],b[(j+1)%3]));return Math.max(0,d);
}
function meshDistance(moving,fixed,threshold){
  let best=threshold*threshold,hit=null,triangleTests=0;
  function visit(tri,node){if(!node||boxDist2(tri.box,node.box)>best)return;
    if(node.tris){for(const other of node.tris){if(boxDist2(tri.box,other.box)>best)continue;triangleTests++;const d=a6TriangleDistanceSquared(tri.points,other.points);if(d<=best){best=d;hit={movingTriangle:tri.triangle,fixedTriangle:other.triangle,distanceM:Math.sqrt(d)};}if(best<=1e-18)return;}}
    else {const kids=[node.left,node.right].sort((a,b)=>boxDist2(tri.box,a.box)-boxDist2(tri.box,b.box));visit(tri,kids[0]);if(best>1e-18)visit(tri,kids[1]);}}
  for(const tri of moving){visit(tri,fixed);if(best<=1e-18)break;}return {hit,triangleTests};
}
/** fixedParts: rest-world loco+tender (all parts preferred). movingParts: local
 * complete coach (shell+mechanics+gangway). shroudParts: world-space green transition at this pose,
 * either the archived fixed version or the endpoint-constrained output, kept visible. New coupling parts are audited in a separate category;
 * intentional bearing contacts must never be treated as vehicle clearances.
 * One audit searches all cross-body surface distances within searchDistanceM;
 * no match means greater than search distance, not an invented exact distance. */
export function prepareA6CouplingInterference({fixedParts=[],movingParts=[],shroudParts=[],searchDistanceM=.025,touchToleranceM=1e-5}={}){
  if(!Array.isArray(fixedParts)||!Array.isArray(movingParts)||!Array.isArray(shroudParts))throw new TypeError('Expected native mesh arrays');
  if(!Number.isFinite(searchDistanceM)||searchDistanceM<=0||!Number.isFinite(touchToleranceM)||touchToleranceM<0||touchToleranceM>searchDistanceM)throw new RangeError('Invalid clearance tolerance');
  const fixed=[...fixedParts.map(part=>({part,category:'fixed-native-and-shell'})),...shroudParts.map(part=>({part,category:'green-transition-shroud'}))].map(x=>({...x,box:boundsOf([x.part]),tree:null}));
  return {inputCounts:{fixed:fixedParts.length,moving:movingParts.length,shroud:shroudParts.length},audit(pose){
    if(pose?.schema!=='kaopu.a6-planar-coupling-pose/1.0')throw new TypeError('Expected solved coupling pose');
    const pairs=[];let triangleTests=0,partPairsConsidered=0;
    for(const part of movingParts){
      const local= boundsOf([part]),corners=[];for(const x of [local.min[0],local.max[0]])for(const y of [local.min[1],local.max[1]])for(const z of [local.min[2],local.max[2]])corners.push(transformA6Point([x,y,z],pose.transforms.coach));
      const movingBox=triBounds(corners),candidates=fixed.filter(f=>boxDist2(movingBox,f.box)<=searchDistanceM*searchDistanceM);if(!candidates.length)continue;
      const moving=triangles(part,pose.transforms.coach);
      for(const f of candidates){partPairsConsidered++;f.tree??=bvh(triangles(f.part));const result=meshDistance(moving,f.tree,searchDistanceM);triangleTests+=result.triangleTests;if(result.hit)pairs.push({movingPart:part.name,fixedPart:f.part.name,category:f.category,...result.hit,status:result.hit.distanceM<=touchToleranceM?'surface-contact-or-intersection':'near-clearance'});}
    }
    pairs.sort((a,b)=>a.distanceM-b.distanceM);const contacts=pairs.filter(p=>p.status==='surface-contact-or-intersection');
    return {schema:'kaopu.a6-mesh-coupling-interference/1.0',coachYawDeg:pose.parameters.coachYawDeg,linkYawDeg:pose.parameters.linkYawDeg,closureErrorM:pose.closureErrorM,
      status:contacts.length?'interference-detected':'no-surface-intersection-detected',clearanceStatus:contacts.length?'interference':(pairs[0]?.distanceM??searchDistanceM)<.005?'below-5mm-inspection-reserve':'at-least-5mm-at-this-pose',inspectionReserveM:.005,surfaceIntersections:contacts.length,minimumMeasuredSurfaceDistanceM:pairs[0]?.distanceM??null,noPairWithinSearchDistance:pairs.length===0,searchDistanceM,touchToleranceM,pairs,triangleTests,partPairsConsidered,
      meshBased:true,wholeCoachPreserved:true,greenShroudIncluded:shroudParts.length>0,greenShroudEndpointWarpApplied:shroudParts.some(p=>p.metadata?.endpointKinematicGeometrySolved),greenShroudRemainedFixedAndIncluded:shroudParts.length>0&&!shroudParts.some(p=>p.metadata?.endpointKinematicGeometrySolved),
      exclusions:['Within-assembly contacts and defects are not cleared by this cross-body test.','Added joint bearing/mount contacts require their own engineering clearance review.','Surface-distance tests do not measure penetration depth or closed-volume containment.','No elastic shroud deformation, gangway compression, track contact, pitch/roll or structural load validation.']};
  }};
}
export function sweepA6CouplingInterference(auditor,{minYawDeg=-6,maxYawDeg=6,stepDeg=.5,coachOffsetZ=32.34}={}){
  if(!Number.isFinite(minYawDeg)||!Number.isFinite(maxYawDeg)||!Number.isFinite(stepDeg)||stepDeg<=0||minYawDeg>maxYawDeg||minYawDeg< -12||maxYawDeg>12)throw new RangeError('Invalid bounded sweep');
  const count=Math.ceil((maxYawDeg-minYawDeg)/stepDeg);if(count>480)throw new RangeError('Sweep resolution exceeds bounded CPU inspection');
  const angles=Array.from({length:count+1},(_,i)=>Math.min(maxYawDeg,minYawDeg+i*stepDeg));if(!angles.includes(0)&&minYawDeg<0&&maxYawDeg>0)angles.push(0);angles.sort((a,b)=>a-b);
  const samples=angles.map(coachYawDeg=>auditor.audit(solveA6CouplingPose({coachYawDeg,coachOffsetZ}))),hits=samples.filter(s=>s.surfaceIntersections);
  return {schema:'kaopu.a6-sampled-coupling-sweep/1.0',rangeDeg:[minYawDeg,maxYawDeg],maximumStepDeg:stepDeg,sampleCount:samples.length,samples,interferingSampleCount:hits.length,
    nearestToStraightInterferenceDeg:hits.length?hits.reduce((a,b)=>Math.abs(a.coachYawDeg)<Math.abs(b.coachYawDeg)?a:b).coachYawDeg:null,
    maxClosureErrorM:Math.max(...samples.map(s=>s.closureErrorM)),certifiedContinuousSafeRange:null,
    statement:'Discrete actual-mesh samples only. No continuous swept-volume or operational safe-range claim. Inspect all reported contacts; fixed shroud is never hidden.'};
}
