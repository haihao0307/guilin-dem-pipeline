/**
 * Rebuilt after the 2026-10-21 scratch loss. This is a new wearer-fitting
 * implementation, not a byte restoration of the historical 8689a6af module.
 * All body samples use the original canonical body and complete CSR weights.
 * The same continuous map is applied to every original R14 construction part.
 * It changes geometry only; no pressure, comfort or dynamic cloth claim.
 */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const n=Math.hypot(...a);if(!(n>1e-12))throw Error('Degenerate shoe-fitting direction');return a.map(x=>x/n);};
const xyz=(p,i)=>[p[i*3],p[i*3+1],p[i*3+2]];
const copy=value=>ArrayBuffer.isView(value)?value.slice():Array.isArray(value)?value.map(copy):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)])):value;

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

/** A fixed, low-frequency upper envelope. Depositing at both enclosing knots
 * retains the measured requirement between them; the neighbourhood maximum
 * removes isolated narrow bulges without dropping any original sample. */
function envelope(rows,{minimum=0,knots=33,radius=2}={}) {
  const raw=new Float64Array(knots).fill(minimum);
  for(const [s,v]of rows){const x=clamp(s)*(knots-1),i=Math.min(knots-2,Math.floor(x));raw[i]=Math.max(raw[i],v);raw[i+1]=Math.max(raw[i+1],v);}
  const values=raw.map((_,i)=>{let v=minimum;for(let k=Math.max(0,i-radius);k<=Math.min(knots-1,i+radius);k++)v=Math.max(v,raw[k]);return v;});
  function sample(s){const x=clamp(s)*(knots-1),i=Math.min(knots-2,Math.floor(x)),u=x-i,a=values[i],b=values[i+1];return {value:a+(b-a)*u*u*(3-2*u),derivative:(b-a)*6*u*(1-u)*(knots-1)};}
  return {values:Array.from(values),sample};
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
    // The ankle above the authored open collar must not raise the shoe roof.
    // Tongue coverage starts at the source's real .308 station.
    if(s<.308&&collar>0&&Math.abs(theta)<collar&&q.y>last.soleTop(s)+last.height(s)*Math.pow(Math.cos(collar),.72)) {openAnkleSamples++;continue;}
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
    report:{schema:'native-canvas-wearer-field/rebuilt-1',units:'original mm',knots:width.values.length,
      widthScale:width.values,roofRiseMm:height.values,clearanceTargetM:clearanceM,insoleTargetM:insoleClearanceM,
      minimumJacobianDeterminant:Math.min(...width.values),allFootSamples:foot.allSamples.length,sizingSamples:foot.samples.length,openAnkleSamples,
      restGeometryPreservedSeparately:true,originalSourceGeometryModified:false,validated:false}};
}

function transformMetadata(part,field) {
  const g=part.geometry;
  for(const a of g.userData.apertures||[]){const q=field.evaluate(a.centre);a.centre=q.p;if(a.axis)a.axis=field.normal(a.axis,q.j);}
  if(g.userData.supportPoints)g.userData.supportPoints=g.userData.supportPoints.map((p,i)=>{const q=field.evaluate(p);if(g.userData.supportNormals?.[i])g.userData.supportNormals[i]=field.normal(g.userData.supportNormals[i],q.j);return q.p;});
  const sourceFrame=part.attachment?.frame;
  if(sourceFrame){
    const q=field.evaluate(sourceFrame.center),vector=v=>unit([q.j[0]*v[0]+q.j[2]*v[2],q.j[4]*v[1]+q.j[5]*v[2],v[2]]);
    part.runtimeAttachmentFrame={center:q.p,across:vector(sourceFrame.across),along:vector(sourceFrame.along),normal:field.normal(sourceFrame.normal,q.j)};
    part.apertureCenter=q.p;part.apertureAxis=part.runtimeAttachmentFrame.normal;
  }
}

export function fitNativeShoeGeometry(source,field) {
  let maximumDisplacementMm=0,minimumJacobianDeterminant=Infinity,newTriangleOrientationReversals=0,newDegenerateTriangles=0,triangles=0;
  const parts=source.parts.map(original=>{
    const part=copy({...original,geometry:undefined}),g=original.geometry.clone(),P=g.attributes.position,N=g.attributes.normal,oldP=original.geometry.attributes.position,oldN=original.geometry.attributes.normal;
    // Geometry.clone preserves all original attributes/groups/indices. Copy
    // metadata before touching any current-position diagnostic arrays.
    g.userData=copy(original.geometry.userData);part.geometry=g;
    for(let i=0;i<P.count;i++){
      const p=[oldP.getX(i),oldP.getY(i),oldP.getZ(i)],q=field.evaluate(p);
      P.setXYZ(i,...q.p);N.setXYZ(i,...field.normal([oldN.getX(i),oldN.getY(i),oldN.getZ(i)],q.j));
      maximumDisplacementMm=Math.max(maximumDisplacementMm,Math.hypot(...sub(q.p,p)));
      minimumJacobianDeterminant=Math.min(minimumJacobianDeterminant,q.j[0]*q.j[4]);
    }
    const idx=g.index.array,old=oldP.array,now=P.array;
    for(let k=0;k<idx.length;k+=3){
      const a=xyz(old,idx[k]),b=xyz(old,idx[k+1]),c=xyz(old,idx[k+2]),n0=cross(sub(b,a),sub(c,a)),area0=Math.hypot(...n0);
      const A=xyz(now,idx[k]),B=xyz(now,idx[k+1]),C=xyz(now,idx[k+2]),n1=cross(sub(B,A),sub(C,A));triangles++;
      if(area0<=1e-10)continue;
      if(Math.hypot(...n1)<=1e-10){newDegenerateTriangles++;continue;}
      const middle=a.map((v,j)=>(v+b[j]+c[j])/3),expected=field.normal(n0,field.evaluate(middle).j);
      if(dot(n1,expected)<=0)newTriangleOrientationReversals++;
    }
    P.needsUpdate=N.needsUpdate=true;g.computeBoundingBox();g.computeBoundingSphere();transformMetadata(part,field);
    g.userData.nativeWearerFit={schema:field.report.schema,sourcePart:part.id,restAttributeAndIndexCountsRetained:true};return part;
  });
  if(triangles!==source.report.triangles)throw Error('Native shoe triangle topology changed');
  if(!(minimumJacobianDeterminant>0))throw Error('Nonpositive native shoe fitting Jacobian');
  const fitting={...field.report,maximumDisplacementMm,minimumJacobianDeterminant,newTriangleOrientationReversals,newDegenerateTriangles,
    geometryOrientationPassed:newTriangleOrientationReversals===0&&newDegenerateTriangles===0,sourceParts:source.parts.length,sourceTriangles:source.report.triangles};
  return {...source,parts,sourceModel:source,wearerField:field,report:{...source.report,wearerFit:fitting,wearerFitValidated:false}};
}
