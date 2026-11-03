/**
 * Rebuilt after the 2026-10-21 scratch loss. This is a new wearer-fitting
 * implementation, not a byte restoration of the historical 8689a6af module.
 * All body samples use the original canonical body and complete CSR weights.
 * The same continuous map is applied to every original R14 construction part.
 * It changes geometry only; no pressure, comfort or dynamic cloth claim.
 */
import {MeshContact} from '../../vendor/appearance/cloth-adapted/mesh-contact.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);if(!(n>1e-12))throw Error('Degenerate shoe-fitting direction');return a.map(x=>x/n);};
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const copy=value=>ArrayBuffer.isView(value)?value.slice():Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)])):value;
const determinant=j=>j[0]*(j[4]*j[8]-j[5]*j[7])-j[1]*(j[3]*j[8]-j[5]*j[6])+j[2]*(j[3]*j[7]-j[4]*j[6]);
const multiply=(a,b)=>Array.from({length:9},(_,i)=>{const r=Math.floor(i/3),c=i%3;return a[r*3]*b[c]+a[r*3+1]*b[c+3]+a[r*3+2]*b[c+6];});
const transportedNormal=(n,j)=>{const d=determinant(j);return unit([
 ((j[4]*j[8]-j[5]*j[7])*n[0]+(j[5]*j[6]-j[3]*j[8])*n[1]+(j[3]*j[7]-j[4]*j[6])*n[2])/d,
 ((j[2]*j[7]-j[1]*j[8])*n[0]+(j[0]*j[8]-j[2]*j[6])*n[1]+(j[1]*j[6]-j[0]*j[7])*n[2])/d,
 ((j[1]*j[5]-j[2]*j[4])*n[0]+(j[2]*j[3]-j[0]*j[5])*n[1]+(j[0]*j[4]-j[1]*j[3])*n[2])/d]);};

export function measureNativeFoot(actor,side) {
  const {rig,binding}=actor,footId=rig.index.get('foot.'+side),foot=rig.restP[footId];
  if(!foot||!binding.range||!binding.packed)throw Error('Complete native foot CSR is required');
  const toe=rig.restP[rig.index.get('toe2-1.'+side)];
  const forward=unit([toe[0]-foot[0],toe[1]-foot[1],0]),right=[-forward[1],forward[0],0];
  const descendants=new Set(rig.descendants[footId]);descendants.add(footId);
  const rest=actor.nativeSource.positions,samples=[],allSamples=[];
  let minF=Infinity,maxF=-Infinity,minR=Infinity,maxR=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let id=0;id<actor.nativeSource.bodyCount;id++) {
    let w=0;const outside=[],start=binding.range[id*2],count=binding.range[id*2+1];
    for(let k=0;k<count;k++) {
      const q=(start+k)*8,bone=binding.packed[q+3],weight=binding.packed[q+4];
      if(descendants.has(bone))w+=weight;else if(weight>0)outside.push([bone,weight]);
    }
    if(!(w>0))continue;
    const p=xyz(rest,id),d=sub(p,foot),f=dot(d,forward),r=dot(d,right);
    const row={id,p,f,r,footWeight:w,outsideFootWeights:outside};allSamples.push(row);
    // This limit only sizes the low-cut shoe; it never removes body geometry.
    // All nonzero influences and ankle samples remain available for auditing.
    if(w<.35||p[2]>foot[2]+.009)continue;
    samples.push(row);minF=Math.min(minF,f);maxF=Math.max(maxF,f);
    minR=Math.min(minR,r);maxR=Math.max(maxR,r);minZ=Math.min(minZ,p[2]);maxZ=Math.max(maxZ,p[2]);
  }
  if(samples.length<20)throw Error('Insufficient complete native foot samples '+actor.id+'/'+side);
  return {side,footId,foot,forward,right,minF,maxF,minR,maxR,minZ,maxZ,samples,allSamples,
    length:maxF-minF,width:maxR-minR,centerF:(minF+maxF)/2,centerR:(minR+maxR)/2};
}

/** Positive cubic B-spline upper envelope. Every control point active at an
 * actual measurement receives its full requirement. Their positive weights
 * sum to one, so smoothing cannot lower that measurement's required margin.
 * C2 continuity avoids the former per-cell smoothstep slope resets. */
function envelope(rows,{minimum=0,knots=17}={}) {
  const values=new Float64Array(knots).fill(minimum);
  for(const [s,v]of rows){const i=Math.min(knots-2,Math.floor(clamp(s)*(knots-1)));for(let k=i-1;k<=i+2;k++){const q=clamp(k,0,knots-1);values[q]=Math.max(values[q],v);}}
  function sample(s){
    const x=clamp(s)*(knots-1),i=Math.min(knots-2,Math.floor(x)),u=x-i,v=1-u;
    const weights=[v*v*v/6,(3*u*u*u-6*u*u+4)/6,(-3*u*u*u+3*u*u+3*u+1)/6,u*u*u/6];
    const derivatives=[-v*v/2,(9*u*u-12*u)/6,(-9*u*u+6*u+3)/6,u*u/2];
    let value=0,derivative=0;for(let k=0;k<4;k++){const a=values[clamp(i+k-1,0,knots-1)];value+=weights[k]*a;derivative+=derivatives[k]*a;}
    return {value,derivative:s<0||s>1?0:derivative*(knots-1)};
  }
  return {values:Array.from(values),sample};
}

/** Positive C2 tensor envelope in height and periodic azimuth. The full
 * measured requirement is assigned to every active coefficient, so the
 * convex combination never falls below an input requirement. Directions
 * without a requirement no longer inherit the opposite tongue's maximum. */
function directionalEnvelope(rows,{heightKnots=9,angleKnots=12}={}) {
  const values=Array.from({length:heightKnots},()=>new Float64Array(angleKnots));
  const wrap=i=>(i%angleKnots+angleKnots)%angleKnots;
  const angleCell=theta=>((theta/(2*Math.PI))%1+1)%1*angleKnots;
  const basis=u=>{const v=1-u;return{
    w:[v*v*v/6,(3*u*u*u-6*u*u+4)/6,(-3*u*u*u+3*u*u+3*u+1)/6,u*u*u/6],
    d:[-v*v/2,(9*u*u-12*u)/6,(-9*u*u+6*u+3)/6,u*u/2]};};
  for(const [height,theta,requirement]of rows){
    const hi=Math.min(heightKnots-2,Math.floor(clamp(height)*(heightKnots-1))),ai=Math.floor(angleCell(theta));
    for(let h=hi-1;h<=hi+2;h++)for(let a=ai-1;a<=ai+2;a++){
      const row=values[clamp(h,0,heightKnots-1)],index=wrap(a);row[index]=Math.max(row[index],requirement);
    }
  }
  function sample(height,theta){
    const h=clamp(height)*(heightKnots-1),hi=Math.min(heightKnots-2,Math.floor(h)),a=angleCell(theta),ai=Math.floor(a),H=basis(h-hi),A=basis(a-ai);
    let value=0,heightDerivative=0,angleDerivative=0;
    for(let j=0;j<4;j++)for(let k=0;k<4;k++){
      const v=values[clamp(hi+j-1,0,heightKnots-1)][wrap(ai+k-1)];
      value+=v*H.w[j]*A.w[k];heightDerivative+=v*H.d[j]*A.w[k];angleDerivative+=v*H.w[j]*A.d[k];
    }
    return{value,heightDerivative:height<0||height>1?0:heightDerivative*(heightKnots-1),angleDerivative:angleDerivative*angleKnots/(2*Math.PI)};
  }
  return{values:values.map(row=>Array.from(row)),sample,heightKnots,angleKnots};
}

/** Positions are in the original unmirrored R14 millimetre frame. Left/right
 * reflection belongs to the renderer's one existing shoe scale, exactly once. */
export function createNativeShoeField(foot,last,{scaleM,centerF,centerR,clearanceM=.0015,insoleClearanceM=.0025}={}) {
  if(!(scaleM>0)||last.style.id!=='canvas')throw Error('This measured recovery fit requires the original canvas model');
  const mirror=foot.side==='L'?-1:1,L=last.L,margin=clearanceM/scaleM;
  const station=row=>(row.f-centerF)/(L*scaleM)+.5;
  // Use the actual full foot bottom against the complete curved insole, not
  // only the ankle station. Toe spring is therefore included in sole lift.
  let baseZ=Infinity;
  for(const row of foot.samples)baseZ=Math.min(baseZ,row.p[2]-(last.soleTop(clamp(station(row)))+1.3)*scaleM-insoleClearanceM);
  const points=foot.samples.map(row=>({row,s:station(row),x:mirror*(row.r-centerR)/scaleM,y:(row.p[2]-baseZ)/scaleM}));
  const widthRequirements=[];
  for(const q of points){
    const s=clamp(q.s),asym=1+(q.x<last.center(s)?.028:-.016)*(clamp((s-.28)/(.65-.28))**2)*(3-2*clamp((s-.28)/(.65-.28)));
    // Retain room for the full original inner lining on either side.
    widthRequirements.push([s,(Math.abs(q.x-last.center(s))+margin+last.params.thickness)/(last.width(s)*asym)]);
  }
  const width=envelope(widthRequirements,{minimum:1}),heightRequirements=[];
  const rampMm=last.style.sole;
  let openAnkleSamples=0;
  for(const q of points){
    const s=clamp(q.s),a=width.sample(s).value,c=last.center(s),x=c+(q.x-c)/a;
    const t=clamp((s-.28)/(.65-.28)),asym=1+(x<c?.028:-.016)*t*t*(3-2*t);
    const xn=clamp((x-c)/(last.width(s)*asym),-1,1),theta=Math.asin(xn),collar=last.collarAngle(s);
    const roof=last.soleTop(s)+last.height(s)*Math.pow(Math.max(0,1-xn*xn),.36);
    // Before the source tongue starts, the quarter's highest point is its
    // authored open collar. Skin above that whole edge does not belong to a
    // closed roof, even if its X lies outside the opening's vertical shadow.
    // The original full samples remain in the independent surface audit.
    const throat=Math.max(collar,.235*((clamp((s-.24)/(.37-.24)))**2)*(3-2*clamp((s-.24)/(.37-.24))));
    const tongueHalf=Math.min(1.20,throat+.21),tongueW=Math.abs(theta)/tongueHalf;
    const beforeTongue=s<.308+.020*Math.min(1,tongueW*tongueW);
    if(beforeTongue&&collar>0&&q.y>last.soleTop(s)+last.height(s)*Math.pow(Math.cos(collar),.72)) {openAnkleSamples++;continue;}
    const u=clamp((roof-last.soleTop(s))/rampMm),weight=u*u*(3-2*u);
    if(weight>1e-8)heightRequirements.push([s,Math.max(0,(q.y+margin+last.params.thickness-roof)/weight)]);
  }
  const height=envelope(heightRequirements),longitudinal=new Map();
  function at(z){
    let q=longitudinal.get(z);if(q)return q;
    const s=clamp(z/L+.5),e=1e-5,lo=Math.max(0,s-e),hi=Math.min(1,s+e),den=hi-lo;
    const a=width.sample(s),d=height.sample(s);
    q={s,a:a.value,da:a.derivative/L,d:d.value,dd:d.derivative/L,c:last.center(s),dc:(last.center(hi)-last.center(lo))/den/L,
      y0:last.soleTop(s),dy0:(last.soleTop(hi)-last.soleTop(lo))/den/L};longitudinal.set(z,q);return q;
  }
  function evaluate(p){
    const q=at(p[2]),u=clamp((p[1]-q.y0)/rampMm),w=u*u*(3-2*u),wy=u>0&&u<1?6*u*(1-u)/rampMm:0;
    return {p:[q.c+q.a*(p[0]-q.c),p[1]+q.d*w,p[2]],j:[q.a,0,q.dc*(1-q.a)+q.da*(p[0]-q.c),0,1+q.d*wy,q.dd*w-q.d*wy*q.dy0,0,0,1]};
  }
  const normal=(n,j)=>{const x=n[0]/j[0],y=n[1]/j[4];return unit([x,y,n[2]-j[2]*x-j[5]*y]);};
  return {evaluate,normal,baseZ,scaleM,centerF,centerR,mirror,
    report:{schema:'native-canvas-wearer-field/rebuilt-2',units:'original mm',knots:width.values.length,interpolation:'positive cubic B-spline C2 upper envelope',
      widthScale:width.values,roofRiseMm:height.values,clearanceTargetM:clearanceM,insoleTargetM:insoleClearanceM,
      minimumJacobianDeterminant:Math.min(...width.values),allFootSamples:foot.allSamples.length,sizingSamples:foot.samples.length,openAnkleSamples,
      restGeometryPreservedSeparately:true,originalSourceGeometryModified:false,validated:false}};
}

/** Expand the existing ankle aperture horizontally using actual complete-body
 * exits. The foot/toe roof and the original closed construction remain intact.
 * This is a frozen neutral wearer transform, never a per-frame collision push.
 * A single radial field applies to all original parts and their attachments. */
export function createNativeShoeApertureField(actor,source,base,foot) {
  const body=new MeshContact(actor.nativeSource.positions,actor.nativeSource.faces),scaleM=base.scaleM;
  const cx=-base.mirror*base.centerR/scaleM,cz=-base.centerF/scaleM,r1=foot.length*.7/scaleM;let r0=Infinity;
  const target=base.report.clearanceTargetM,query=new Float64Array(4),requirements=[],angularRequirements=[],measured=[],failures=[];let largestRequirement=null;
  const native=p=>{const r=base.mirror*p[0]*scaleM+base.centerR,f=p[2]*scaleM+base.centerF;return[foot.foot[0]+foot.right[0]*r+foot.forward[0]*f,foot.foot[1]+foot.right[1]*r+foot.forward[1]*f,p[1]*scaleM+base.baseZ];};
  const radial=r=>{const u=clamp(r<r0?r/r0:(r-r0)/(r1-r0)),s=u*u*u*(10+u*(-15+6*u)),d=30*u*u*(1-u)*(1-u);return r<r0?{g:s,dg:d/r0}:{g:1-s,dg:-d/(r1-r0)};};
  // Exact ray exits through the same original body triangles as the nearest
  // query. The original BVH is reused; no body subset or reduced skin is made.
  function exitRay(origin,direction){
    let best=Infinity,hit=null;const stack=[0],P=body.p,I=body.faces;
    while(stack.length){const node=body.nodes[stack.pop()],box=node.box;let lo=0,hi=best;
      for(let k=0;k<3;k++){if(Math.abs(direction[k])<1e-14){if(origin[k]<box[k]||origin[k]>box[k+3]){hi=-1;break;}}else{let a=(box[k]-origin[k])/direction[k],b=(box[k+3]-origin[k])/direction[k];if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);}}if(hi<lo)continue;
      if(node.left>=0){stack.push(node.left,node.right);continue;}
      for(let k=node.lo;k<node.hi;k++){const fi=body.tri[k],a=xyz(P,I[fi]),u=sub(xyz(P,I[fi+1]),a),v=sub(xyz(P,I[fi+2]),a),n=cross(u,v),normalLength=Math.hypot(...n),out=dot(n,direction);
        if(out<=1e-14)continue;const h=cross(direction,v),den=dot(u,h);if(Math.abs(den)<1e-20)continue;
        const s=sub(origin,a),b=dot(s,h)/den;if(b<0||b>1)continue;const q=cross(s,u),c=dot(direction,q)/den;if(c<0||b+c>1)continue;
        const t=dot(v,q)/den;if(t>=0&&t<best){best=t;hit={distance:t,normalCosine:out/normalLength,triangle:fi/3};}
      }
    }return hit;
  }
  const samples=[],seen=new Set(),seenEdges=new Set();let ymax=0,minimumBefore=Infinity,nearSamples=0;
  for(const part of source.parts){if(!/^canvas-(quarter-|rounded-vamp|independent-tongue)/.test(part.id))continue;
    const P=part.geometry.attributes.position.array,I=part.geometry.index.array;
    for(const group of part.geometry.groups.filter(g=>g.materialIndex===1))for(let k=group.start;k<group.start+group.count;k+=3){
      const vertices=[I[k],I[k+1],I[k+2]],points=vertices.map(id=>base.evaluate(xyz(P,id)).p);
      for(let n=0;n<3;n++){const key=part.id+'/'+vertices[n];if(!seen.has(key)){seen.add(key);samples.push(points[n]);}}
      samples.push([0,1,2].map(c=>(points[0][c]+points[1][c]+points[2][c])/3));
      for(let n=0;n<3;n++){const m=(n+1)%3,a=vertices[n],b=vertices[m],key=part.id+'/'+Math.min(a,b)+'/'+Math.max(a,b);if(!seenEdges.has(key)){seenEdges.add(key);samples.push(points[n].map((v,c)=>(v+points[m][c])*.5));}}
    }
  }
  for(const p of samples)ymax=Math.max(ymax,p[1]);
  for(const p of samples){const q=native(p);body.sample(...q,query);minimumBefore=Math.min(minimumBefore,query[0]);if(query[0]>=target)continue;nearSamples++;
    const x=p[0]-cx,z=p[2]-cz,r=Math.hypot(x,z);
    if(r<1e-7||r>=r1){failures.push({point:p,distanceM:query[0],reason:'outside supported ankle field'});continue;}
    const direction=[(foot.right[0]*base.mirror*x+foot.forward[0]*z)/r,(foot.right[1]*base.mirror*x+foot.forward[1]*z)/r,0];
    let move;
    if(query[0]<0){const hit=exitRay(q,direction);if(!hit||hit.normalCosine<=.05){failures.push({point:p,distanceM:query[0],reason:'no well-directed complete-body exit'});continue;}move=hit.distance+target/hit.normalCosine;}
    else{const cosine=dot(direction,Array.from(query.subarray(1)));if(cosine<=.05){failures.push({point:p,distanceM:query[0],reason:'near surface does not face radial direction'});continue;}move=(target-query[0])/cosine;}
    measured.push({p,r,move,distanceM:query[0]});r0=Math.min(r0,r);
  }
  if(failures.length)throw Error('Measured ankle fitting could not preserve a radial exit: '+JSON.stringify(failures.slice(0,3)));
  if(!measured.length)r0=r1*.25;
  if(!(r1>r0))throw Error('Native ankle aperture radial support is degenerate');
  for(const {p,r,move,distanceM}of measured){const rad=radial(r),requirement=move/scaleM/rad.g;requirements.push([p[1]/ymax,requirement]);
    angularRequirements.push([p[1]/ymax,Math.atan2(p[0]-cx,p[2]-cz),requirement]);
    if(!largestRequirement||requirement>largestRequirement.displacementMm)largestRequirement={pointMm:p,distanceM,radialDistanceMm:r,weight:rad.g,rayMoveM:move,displacementMm:requirement};
  }
  const displacement=envelope(requirements,{knots:9}),maximum=Math.max(...displacement.values),radialDerivativeLowerBound=1-maximum*1.875/(r1-r0);
  if(!(radialDerivativeLowerBound>0))throw Error('Measured ankle fitting would fold its continuous radial map: '+JSON.stringify({actor:actor.id,side:foot.side,maximumDisplacementMm:maximum,radialSupportMm:[r0,r1],radialDerivativeLowerBound,largestRequirement}));
  const directional=directionalEnvelope(angularRequirements),soleBlendMm=source.last.style.sole;let soleCeilingMm=-Infinity;
  for(const part of source.parts){if(!/sole|heel|rubber|welt/.test(part.id+' '+part.role))continue;
    const p=part.geometry.attributes.position;for(let i=0;i<p.count;i++)soleCeilingMm=Math.max(soleCeilingMm,base.evaluate([p.getX(i),p.getY(i),p.getZ(i)]).p[1]);
  }
  if(!Number.isFinite(soleCeilingMm))throw Error('Actual complete sole is required for the aperture transition');
  function atHeightAngle(y,theta){
    const h=displacement.sample(y/ymax),u=clamp((y-soleCeilingMm)/soleBlendMm);
    // Preserve the previous complete sole positions exactly, including X/Z.
    if(u===0)return{d:h.value,dy:h.derivative/ymax,da:0};
    const a=directional.sample(y/ymax,theta),w=u*u*u*(10+u*(-15+6*u)),dw=30*u*u*(1-u)*(1-u)/soleBlendMm;
    return{d:h.value+(a.value-h.value)*w,dy:h.derivative/ymax+(a.heightDerivative/ymax-h.derivative/ymax)*w+(a.value-h.value)*dw,da:a.angleDerivative*w};
  }
  function evaluate(p){const q=base.evaluate(p),x=q.p[0]-cx,z=q.p[2]-cz,r=Math.hypot(x,z),rad=radial(r),{d,dy,da}=atHeightAngle(q.p[1],Math.atan2(x,z));
    if(r<1e-10)return q;
    const f=1+d*rad.g/r,a=d*(rad.dg*r-rad.g)/(r*r*r),b=dy*rad.g/r,c=da*rad.g/(r*r*r),dx=a*x+c*z,dz=a*z-c*x;
    const j=[f+x*dx,b*x,x*dz,0,1,0,z*dx,b*z,f+z*dz];
    return {p:[cx+x*f,q.p[1],cz+z*f],j:multiply(j,q.j)};
  }
  return {...base,evaluate,normal:transportedNormal,report:{...base.report,schema:'native-canvas-wearer-field/rebuilt-4',
    aperture:{schema:'complete-body-neutral-directional-aperture/1',allBodyVertices:actor.nativeSource.bodyCount,allBodyTriangles:actor.nativeSource.faces.length/3,
      measuredInnerSamples:samples.length,nearSamples,minimumSignedDistanceBeforeM:minimumBefore,axisMm:[cx,cz],radialSupportMm:[r0,r1],heightRangeMm:ymax,
      displacementMm:displacement.values,directionalDisplacementMm:directional.values,heightKnots:directional.heightKnots,angleKnots:directional.angleKnots,
      soleCeilingMm,soleBlendMm,solePositionsPreserved:true,verticalPositionsPreserved:true,
      maximumRadialDisplacementMm:maximum,radialDerivativeLowerBound,largestRequirement,actualBodyExitMeasured:true,perFrameProjection:false}}};
}

function transformMetadata(part,field) {
  const g=part.geometry;
  for(const a of g.userData.apertures||[]){const q=field.evaluate(a.centre);a.centre=q.p;if(a.axis)a.axis=field.normal(a.axis,q.j);}
  if(g.userData.supportPoints)g.userData.supportPoints=g.userData.supportPoints.map((p,i)=>{const q=field.evaluate(p);if(g.userData.supportNormals?.[i])g.userData.supportNormals[i]=field.normal(g.userData.supportNormals[i],q.j);return q.p;});
  const sourceFrame=part.attachment?.frame;
  if(sourceFrame){
    const q=field.evaluate(sourceFrame.center),vector=v=>unit([0,1,2].map(r=>dot(q.j.slice(r*3,r*3+3),v)));
    part.runtimeAttachmentFrame={center:q.p,across:vector(sourceFrame.across),along:vector(sourceFrame.along),normal:field.normal(sourceFrame.normal,q.j)};
    part.apertureCenter=q.p;part.apertureAxis=part.runtimeAttachmentFrame.normal;
  }
}

export function fitNativeShoeGeometry(source,field) {
  const profile={cloneMs:0,actualVertexNormalMapMs:0,triangleAuditMs:0,boundsMetadataMs:0};let profileMark=performance.now();
  let maximumDisplacementMm=0,minimumJacobianDeterminant=Infinity,newTriangleOrientationReversals=0,newDegenerateTriangles=0,triangles=0;
  const parts=source.parts.map(original=>{
    const part=copy({...original,geometry:undefined}),g=original.geometry.clone(),P=g.attributes.position,N=g.attributes.normal,oldP=original.geometry.attributes.position,oldN=original.geometry.attributes.normal;
    // Geometry.clone preserves all original attributes/groups/indices. Copy
    // metadata before touching any current-position diagnostic arrays.
    g.userData=copy(original.geometry.userData);part.geometry=g;
    profile.cloneMs+=performance.now()-profileMark;profileMark=performance.now();
    for(let i=0;i<P.count;i++){
      const p=[oldP.getX(i),oldP.getY(i),oldP.getZ(i)],q=field.evaluate(p);
      P.setXYZ(i,...q.p);N.setXYZ(i,...field.normal([oldN.getX(i),oldN.getY(i),oldN.getZ(i)],q.j));
      maximumDisplacementMm=Math.max(maximumDisplacementMm,Math.hypot(...sub(q.p,p)));
      minimumJacobianDeterminant=Math.min(minimumJacobianDeterminant,determinant(q.j));
    }
    profile.actualVertexNormalMapMs+=performance.now()-profileMark;profileMark=performance.now();
    const idx=g.index.array,old=oldP.array,now=P.array;
    for(let k=0;k<idx.length;k+=3){
      const a=xyz(old,idx[k]),b=xyz(old,idx[k+1]),c=xyz(old,idx[k+2]),n0=cross(sub(b,a),sub(c,a)),area0=Math.hypot(...n0);
      const A=xyz(now,idx[k]),B=xyz(now,idx[k+1]),C=xyz(now,idx[k+2]),n1=cross(sub(B,A),sub(C,A));triangles++;
      if(area0<=1e-10)continue;
      if(Math.hypot(...n1)<=1e-10){newDegenerateTriangles++;continue;}
      const middle=a.map((v,j)=>(v+b[j]+c[j])/3),expected=field.normal(n0,field.evaluate(middle).j);
      if(dot(n1,expected)<=0)newTriangleOrientationReversals++;
    }
    profile.triangleAuditMs+=performance.now()-profileMark;profileMark=performance.now();
    P.needsUpdate=N.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();transformMetadata(part,field);
    g.userData.nativeWearerFit={schema:field.report.schema,sourcePart:part.id,restAttributeAndIndexCountsRetained:true};profile.boundsMetadataMs+=performance.now()-profileMark;profileMark=performance.now();return part;
  });
  if(triangles!==source.report.triangles)throw Error('Native shoe triangle topology changed');
  if(!(minimumJacobianDeterminant>0))throw Error('Nonpositive native shoe fitting Jacobian');
  const fitting={...field.report,profile,maximumDisplacementMm,minimumJacobianDeterminant,newTriangleOrientationReversals,newDegenerateTriangles,
    geometryOrientationPassed:newTriangleOrientationReversals===0&&newDegenerateTriangles===0,sourceParts:source.parts.length,sourceTriangles:source.report.triangles};
  return {...source,parts,sourceModel:source,wearerField:field,report:{...source.report,wearerFit:fitting,wearerFitValidated:false}};
}
