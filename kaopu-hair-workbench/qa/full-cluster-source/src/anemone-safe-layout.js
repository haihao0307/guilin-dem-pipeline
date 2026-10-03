/* Bounded golden-angle initial layout, independent of the preserved r03 core.
 * This is constrained kinematics, not PBD, CCD, FSI, or a general contact solver.
 * Only the named geometry preset is accepted. Its actual 43 shader rings are
 * rebuilt and conservatively checked, rather than trusting measured constants.
 * Regional flow remains continuous and nonzero, with one common amplitude cap.
 * Recompute/export the full certificate without a browser:
 *   node full-cluster/src/anemone-safe-layout.js
 */
(function (root) {
  'use strict';
  const C = typeof module !== 'undefined' && module.exports
    ? require('./anemone-current.js') : root.AnemoneCurrent;
  if (!C) throw Error('Load AnemoneCurrent before AnemoneSafeLayout');
  const VERSION = 'bounded-radial-prefix-1';
  const PRESET = Object.freeze({count:240,length:.7,thickness:.03,curvature:.7,seed:73});
  const DEFAULTS = Object.freeze({...C.DEFAULTS,...PRESET});
  const GEOMETRY_KEYS = Object.freeze(Object.keys(PRESET));
  const RINGS=42, SOCKET_SEGMENTS=3, NUMERICAL_MARGIN=1e-5, FAR_GAP=.1;
  const rawAmplitude = s => Math.hypot(.7*s.current*(1.21+.12*s.turbulence),.5*s.turbulence);
  // A design budget, not a claimed clearance. Certification below must succeed
  // for this budget before any geometry is returned to a renderer.
  const A_ALLOWED=.15*rawAmplitude(DEFAULTS), K=A_ALLOWED/(1-A_ALLOWED/2);
  const trustedRoots=new WeakSet();
  let cachedCertificate=null, canonicalRoots=null;

  function validate(data) {
    if (!data || typeof data!=='object' || Array.isArray(data)) throw Error('海葵参数必须是对象');
    for (const key of GEOMETRY_KEYS) {
      if (data[key]!==PRESET[key]) throw Error('未认证的初始几何：'+key+'；当前仅支持固定安全预设（240 / 0.7 / 0.03 / 0.7 / seed 73），已保留上一有效状态');
    }
    // Do not round or silently repair imported geometry.
    return C.validate(data);
  }
  function makeRoots() {
    const random=C.rng(PRESET.seed), out=[];
    for(let i=0;i<PRESET.count;i++) {
      random(); // Preserve the old angle-jitter RNG draw, but not its displacement.
      const a=i*2.399963229728653;
      random(); // Preserve radial-jitter draw; roots now retain golden-angle spacing.
      const fraction=C.clamp(Math.sqrt(.003+(i+.5)/PRESET.count*.997),.095,.985);
      const r=fraction*C.discRadius(a),x=Math.cos(a)*r,z=Math.sin(a)*r;
      random(); // Old heading jitter.
      const length=PRESET.length*(.77+random()*.4),radius=PRESET.thickness*(.84+random()*.3);
      random(); const variation=random(); random(); random(); // phase/lean/curve draws
      out.push(Object.freeze({x,y:C.discAttachment(x,z),z,a,r,heading:a,length,radius,
        phase:-1.35,variation,lean:.23,curve:PRESET.curvature}));
    }
    return Object.freeze(out);
  }
  function flowEnvelope(s) {
    const raw=rawAmplitude(s),scale=raw>0?Math.min(1,A_ALLOWED/raw):1;
    return {rawAmplitude:raw,allowedAmplitude:A_ALLOWED,effectiveAmplitude:raw*scale,
      effectiveScale:scale,restricted:scale<1,mode:'受限区域微动'};
  }
  function solveUnchecked(s,rs,time,out) {
    const d=s.direction*Math.PI/180,dx=Math.cos(d),dz=Math.sin(d),S=C.SEGMENTS;
    const scale=flowEnvelope(s).effectiveScale,flow={};
    for(let i=0;i<rs.length;i++) {
      const r=rs[i],base=i*(S+1)*4,step=r.length/S;
      let x=r.x,y=r.y,z=r.z;
      out[base]=x;out[base+1]=y;out[base+2]=z;out[base+3]=r.radius;
      for(let j=1;j<=S;j++) {
        const u=(j-.5)/S,flex=u*u;
        C.sampleFlow(s,r.x,r.z,u,time,flow);
        const bend=C.clamp(r.lean+r.curve*Math.pow(u,.82),0,2.3);
        const heading=r.heading+.16*Math.sin(u*2.7+r.phase);
        const vx=Math.cos(heading)*Math.sin(bend)+flex*scale*(dx*flow.streamwise*.7-dz*flow.crosswise*.5);
        const vz=Math.sin(heading)*Math.sin(bend)+flex*scale*(dz*flow.streamwise*.7+dx*flow.crosswise*.5);
        const vy=Math.cos(bend),norm=Math.hypot(vx,vy,vz);
        x+=vx/norm*step;y+=vy/norm*step;z+=vz/norm*step;
        const o=base+j*4;
        out[o]=x;out[o+1]=y;out[o+2]=z;out[o+3]=j===S?r.length:r.radius;
      }
    }
    return out;
  }
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
  const norm=a=>Math.hypot(a[0],a[1],a[2]);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const clamp01=x=>Math.max(0,Math.min(1,x));
  function segmentDistance(p,q,r,s) {
    const ux=q[0]-p[0],uy=q[1]-p[1],uz=q[2]-p[2];
    const vx=s[0]-r[0],vy=s[1]-r[1],vz=s[2]-r[2];
    const wx=p[0]-r[0],wy=p[1]-r[1],wz=p[2]-r[2];
    const a=ux*ux+uy*uy+uz*uz,e=vx*vx+vy*vy+vz*vz;
    const b=ux*vx+uy*vy+uz*vz,c=ux*wx+uy*wy+uz*wz,f=vx*wx+vy*wy+vz*wz;
    let t=0,v=0;
    if(a<1e-24) {v=e<1e-24?0:clamp01(f/e);}
    else if(e<1e-24) {t=clamp01(-c/a);}
    else {
      const den=a*e-b*b;
      t=den>1e-15?clamp01((b*f-c*e)/den):0;
      v=(b*t+f)/e;
      if(v<0){v=0;t=clamp01(-c/a);}else if(v>1){v=1;t=clamp01((b-c)/a);}
    }
    return Math.hypot(wx+t*ux-v*vx,wy+t*uy-v*vy,wz+t*uz-v*vz);
  }
  function renderSegments(rs,data) {
    const S=C.SEGMENTS,prefix=[0],segments=[];
    for(let j=1;j<=S;j++)prefix[j]=prefix[j-1]+Math.pow((j-.5)/S,2)/S;
    for(let i=0;i<rs.length;i++) {
      const r=rs[i],rings=[];
      for(let k=0;k<=RINGS;k++) {
        const param=k/RINGS,capLength=r.radius/r.length;
        const axial=param<.85?param/.85*(1-capLength):1-capLength+capLength*(param-.85)/.15;
        const v=axial*S,j=Math.min(S,Math.floor(v)),f=v-j,b=i*(S+1)*4;
        const j1=Math.min(j+1,S),center=[0,1,2].map(c=>data[b+j*4+c]*(1-f)+data[b+j1*4+c]*f);
        const cap=clamp01((axial-(1-capLength))/capLength);
        const radius=r.radius*(1-.1*axial)*(1+.07*Math.exp(-Math.pow((axial-.9)/.06,2)))*Math.sqrt(Math.max(0,1-cap*cap));
        const B=r.length*(prefix[j]*(1-f)+prefix[j1]*f);
        rings.push({center,radius,axial,B});
      }
      for(let j=0;j<RINGS;j++) {
        const a=rings[j],b=rings[j+1],p=a.center,q=b.center;
        segments.push({id:i*RINGS+j,tube:i,index:j,p,q,center:p.map((v,k)=>(v+q[k])/2),half:distance(p,q)/2,
          radius:Math.max(a.radius,b.radius),loB:a.B,hiB:b.B,B:Math.max(a.B,b.B),loU:a.axial,hiU:b.axial});
      }
    }
    return segments;
  }
  function gridKey(x,y,z){return x+','+y+','+z;}
  function spatialGrid(items,size) {
    const cells=new Map();
    for(const item of items) {
      const c=item.center,key=gridKey(Math.floor(c[0]/size),Math.floor(c[1]/size),Math.floor(c[2]/size));
      if(!cells.has(key))cells.set(key,[]);
      cells.get(key).push(item);
    }
    return {near(center,visit) {
      const x=Math.floor(center[0]/size),y=Math.floor(center[1]/size),z=Math.floor(center[2]/size);
      for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(let c=-1;c<=1;c++) {
        const bucket=cells.get(gridKey(x+a,y+b,z+c));
        if(bucket)for(const item of bucket)visit(item);
      }
    }};
  }
  function interTubeCheck(segments) {
    const extent=Math.max(...segments.map(s=>s.radius+s.half)),maxB=Math.max(...segments.map(s=>s.B));
    const query=2*extent+FAR_GAP,grid=spatialGrid(segments,query);
    // Outside this finite broad phase, capsule gap >= FAR_GAP by triangle inequality.
    let minStatic=FAR_GAP,minBound=FAR_GAP-2*K*maxB,minRatio=FAR_GAP/(2*maxB),pairs=0,worst=null;
    for(const a of segments)grid.near(a.center,b=>{
      if(b.id<=a.id||a.tube===b.tube||distance(a.center,b.center)>query)return;
      const gap=segmentDistance(a.p,a.q,b.p,b.q)-a.radius-b.radius,coefficient=a.B+b.B;
      minStatic=Math.min(minStatic,gap);minRatio=Math.min(minRatio,gap/coefficient);pairs++;
      const bound=gap-K*coefficient;
      if(bound<minBound){minBound=bound;worst={tentacles:[a.tube,b.tube],segments:[a.index,b.index]};}
    });
    return {minStaticClearance:minStatic,minMotionClearance:minBound,reservedMotionClearance:minBound-NUMERICAL_MARGIN,minPrefixRatio:minRatio,
      examinedPairs:pairs,excludedStaticGapLowerBound:FAR_GAP,excludedPrefixRatioLowerBound:FAR_GAP/(2*maxB),worst};
  }
  function selfCheck(segments,rs) {
    let minStatic=Infinity,minBound=Infinity,pairs=0,worst=null;
    for(let i=0;i<rs.length;i++)for(let j=0;j<RINGS;j++)for(let k=j+1;k<RINGS;k++) {
      const a=segments[i*RINGS+j],b=segments[i*RINGS+k];
      if((b.loU-a.hiU)*rs[i].length<=3*rs[i].radius)continue;
      const gap=segmentDistance(a.p,a.q,b.p,b.q)-a.radius-b.radius;
      // Common root-to-earlier-prefix motion cancels in this relative bound.
      const bound=gap-K*(b.hiB-a.loB);pairs++;minStatic=Math.min(minStatic,gap);
      if(bound<minBound){minBound=bound;worst={tentacle:i,segments:[j,k]};}
    }
    return {minStaticClearance:minStatic,minMotionClearance:minBound,reservedMotionClearance:minBound-NUMERICAL_MARGIN,examinedPairs:pairs,worst,
      localContinuation:'Intervals with arc gap <= 3 original root radii are excluded; see localBendGuard'};
  }
  function makeTriangle(a,b,c,id) {
    const ab=sub(b,a),ac=sub(c,a),n=cross(ab,ac),area=norm(n);
    if(area<1e-12)return null;
    const center=a.map((v,k)=>(v+b[k]+c[k])/3);
    return {a,b,c,ab,ac,normal:n.map(v=>v/area),aa:dot(ab,ab),bb:dot(ab,ac),cc:dot(ac,ac),
      center,radius:Math.max(distance(center,a),distance(center,b),distance(center,c)),id};
  }
  function bodyTriangles() {
    const sides=C.DISC_SIDES,columnRows=14,rows=columnRows+C.DISC_RINGS,vertices=[],triangles=[];
    for(let row=0;row<=rows;row++)for(let side=0;side<=sides;side++) {
      const a=side/sides*Math.PI*2,t=row/columnRows;
      if(row>=columnRows)vertices.push(C.discPoint(row-columnRows,side));
      else {const r=.63+(C.discRadius(a)-.63)*t*t*t;vertices.push([r*Math.cos(a),C.discPoint(0,side)[1]*t,r*Math.sin(a)]);}
    }
    const add=(a,b,c)=>{const tr=makeTriangle(a,b,c,triangles.length);if(tr)triangles.push(tr);};
    for(let row=0;row<rows;row++)for(let side=0;side<sides;side++) {
      const k=row*(sides+1)+side;
      add(vertices[k],vertices[k+sides+1],vertices[k+1]);
      add(vertices[k+1],vertices[k+sides+1],vertices[k+sides+2]);
    }
    for(let side=0;side<sides;side++)add([0,0,0],vertices[side],vertices[side+1]);
    return triangles;
  }
  function triangleInside(p,tr) {
    const v=sub(p,tr.a),d=dot(v,tr.ab),e=dot(v,tr.ac),den=tr.aa*tr.cc-tr.bb*tr.bb;
    const u=(tr.cc*d-tr.bb*e)/den,w=(tr.aa*e-tr.bb*d)/den;
    return u>=-1e-9&&w>=-1e-9&&u+w<=1+1e-9;
  }
  function segmentTriangleDistance(p,q,tr) {
    const ds=dot(sub(p,tr.a),tr.normal),de=dot(sub(q,tr.a),tr.normal);
    let best=Infinity;
    for(const [point,d]of [[p,ds],[q,de]]) {
      const projected=point.map((v,k)=>v-d*tr.normal[k]);
      if(triangleInside(projected,tr))best=Math.min(best,Math.abs(d));
    }
    best=Math.min(best,segmentDistance(p,q,tr.a,tr.b),segmentDistance(p,q,tr.b,tr.c),segmentDistance(p,q,tr.c,tr.a));
    if(Math.abs(ds-de)>1e-12) {
      const t=ds/(ds-de);
      if(t>=0&&t<=1&&triangleInside(p.map((v,k)=>v+(q[k]-v)*t),tr))return 0;
    }
    return best;
  }
  function bodyCheck(segments) {
    const triangles=bodyTriangles(),maxExtent=Math.max(...segments.map(s=>s.half+s.radius));
    const query=FAR_GAP+maxExtent+Math.max(...triangles.map(t=>t.radius)),grid=spatialGrid(triangles,query);
    let minStatic=FAR_GAP,minBound=Infinity,pairs=0,worst=null;
    for(const s of segments) {
      if(s.index<SOCKET_SEGMENTS)continue;
      let bestDistance=FAR_GAP+s.radius;
      grid.near(s.center,tr=>{
        const centerDistance=distance(s.center,tr.center);
        if(centerDistance>query||centerDistance-s.half-tr.radius>=bestDistance)return;
        bestDistance=Math.min(bestDistance,segmentTriangleDistance(s.p,s.q,tr));pairs++;
      });
      const gap=bestDistance-s.radius,bound=gap-K*s.B;
      minStatic=Math.min(minStatic,gap);
      if(bound<minBound){minBound=bound;worst={tentacle:s.tube,segment:s.index};}
    }
    return {minStaticClearance:minStatic,minMotionClearance:minBound,reservedMotionClearance:minBound-NUMERICAL_MARGIN,examinedPairs:pairs,worst,
      socketSegments:SOCKET_SEGMENTS,socket:'First three render strips intentionally embed into shallow tissue; no watertight union is claimed',
      excludedStaticGapLowerBound:FAR_GAP};
  }
  function localBendCheck(rs,segments) {
    let maxTurn=0,minRadius=Infinity,minRadiusMargin=Infinity,minAngleMargin=Infinity;
    for(let i=0;i<rs.length;i++) {
      const r=rs[i],step=r.length/C.SEGMENTS;
      const maxRadius=Math.max(...segments.slice(i*RINGS,(i+1)*RINGS).map(s=>s.radius));
      let prior=null;
      for(let j=1;j<=C.SEGMENTS;j++) {
        const u=(j-.5)/C.SEGMENTS,bend=r.lean+r.curve*Math.pow(u,.82),h=r.heading+.16*Math.sin(u*2.7+r.phase);
        const tangent=[Math.cos(h)*Math.sin(bend),Math.cos(bend),Math.sin(h)*Math.sin(bend)];
        if(prior) {
          const angle=Math.acos(C.clamp(dot(prior.tangent,tangent),-1,1))+Math.asin(A_ALLOWED*prior.u*prior.u)+Math.asin(A_ALLOWED*u*u);
          const radius=step/(2*Math.tan(angle/2)),limit=2*Math.atan(step/(2*maxRadius));
          maxTurn=Math.max(maxTurn,angle);minRadius=Math.min(minRadius,radius);
          minRadiusMargin=Math.min(minRadiusMargin,radius-maxRadius);minAngleMargin=Math.min(minAngleMargin,limit-angle);
        }
        prior={tangent,u};
      }
    }
    return {maxTurnBoundRadians:maxTurn,minCurvatureRadiusBound:minRadius,minRadiusMargin,minAngleMargin,
      scope:'Conservative discrete solver-edge bend guard; not a proof of triangle manifold quality or local cap triangulation'};
  }
  function buildCertificate() {
    const rs=makeRoots(),zero={...DEFAULTS,current:0,turbulence:0};
    // Same Float32 storage as the runtime texture, so the finite audit does not
    // quietly test a different higher-precision static curve.
    const rest=solveUnchecked(zero,rs,0,new Float32Array(rs.length*(C.SEGMENTS+1)*4));
    const segments=renderSegments(rs,rest),interTentacle=interTubeCheck(segments),selfContact=selfCheck(segments,rs);
    const body=bodyCheck(segments),localBendGuard=localBendCheck(rs,segments);
    const maxB=Math.max(...segments.map(s=>s.B));
    if([interTentacle.minMotionClearance,selfContact.minMotionClearance,body.minMotionClearance,
      localBendGuard.minRadiusMargin].some(v=>!Number.isFinite(v)||v<=NUMERICAL_MARGIN)) {
      throw Error('安全布局认证失败：静态包络或微动裕量不足；已拒绝生成');
    }
    canonicalRoots=deepFreeze(rs);trustedRoots.add(rs);
    return deepFreeze({version:VERSION,preset:{...PRESET},certified:true,renderRings:RINGS+1,
      renderSegments:RINGS,solverSegments:C.SEGMENTS,allowedAmplitude:A_ALLOWED,prefixFactor:K,
      maxJointDisplacementBound:K*maxB,numericalMargin:NUMERICAL_MARGIN,
      interTentacle,selfContact,body,localBendGuard,
      limitations:['Only this exact geometry preset is accepted','Finite first-three-strip root socket is intentional',
        'Local triangle manifold and watertight welding are not certified','Bounded kinematics is not a contact or physical fluid solver']});
  }
  function deepFreeze(value) {for(const item of Object.values(value))if(item&&typeof item==='object')deepFreeze(item);return Object.freeze(value);}
  function ensureCertificate(){if(!cachedCertificate)cachedCertificate=buildCertificate();return cachedCertificate;}
  function roots(s) {validate(s);ensureCertificate();return canonicalRoots;}
  function solve(s,rs,time,out=new Float32Array(rs.length*(C.SEGMENTS+1)*4)) {
    validate(s);ensureCertificate();
    if(!Number.isFinite(time)||time<0||time>1e6)throw Error('受限区域微动时间必须在 0–1000000 秒内');
    if(!trustedRoots.has(rs))throw Error('未认证的根部几何，必须使用 AnemoneSafeLayout.roots');
    if(!(out instanceof Float32Array)||out.length!==rs.length*(C.SEGMENTS+1)*4)throw Error('无效的曲线输出缓冲区');
    return solveUnchecked(s,rs,time,out);
  }
  function certificate(s=DEFAULTS) {validate(s);return {...ensureCertificate(),flow:flowEnvelope(s)};}
  function metrics(s,rs,data) {return {...C.metrics(s,rs,data),safety:certificate(s)};}
  const api={...C,VERSION,DEFAULTS,PRESET,GEOMETRY_KEYS,validate,roots,solve,metrics,certificate,flowEnvelope};
  if(typeof module!=='undefined'&&module.exports) {
    module.exports=api;
    // Build tooling may capture this result and bind it to source hashes. Runtime
    // still performs its scan; no unverified pasted-certificate shortcut exists.
    if(require.main===module)process.stdout.write(JSON.stringify(certificate(),null,2)+'\n');
  }
  else root.AnemoneSafeLayout=api;
})(typeof window!=='undefined'?window:globalThis);
