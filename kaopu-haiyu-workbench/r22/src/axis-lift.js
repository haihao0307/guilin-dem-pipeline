/* R21 candidate thoracic skeleton. Exact source APIs are preserved; skeletal
 * interpretation, dimensions, transport frames and depth are explicit design
 * choices, not measured anatomy or a species claim. Camera-independent. */
(function (root) {
  'use strict';

  const PI = Math.PI;
  const TWO_PI = 2 * PI;
  const AUTHOR_PERIOD = 16 * PI;
  const AUTHOR_STEP = PI / 30;
  const SOURCE_COUNT = 20000;
  const SOURCE_MAX_Y = (SOURCE_COUNT - 1) / 598;
  const EPS = 1e-12;
  const defaults = Object.freeze({ thickness: 0.5, depth: 0.5, detail: 0.5, motion: 1 });

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function length(a) { return Math.hypot(a[0], a[1], a[2]); }
  function unit(a, fallback) {
    const n = length(a);
    return n > EPS && Number.isFinite(n) ? scale(a, 1 / n) : fallback.slice();
  }
  function clamp01(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }
  function parameters(params) {
    params = params || {};
    return {
      thickness: clamp01(params.thickness, defaults.thickness),
      depth: clamp01(params.depth, defaults.depth),
      detail: clamp01(params.detail, defaults.detail),
      motion: clamp01(params.motion, defaults.motion)
    };
  }
  function checkKind(kind) {
    if (kind !== 'multifrequency' && kind !== 'biomotion') {
      throw new TypeError('HaiyuAxisLift kind must be multifrequency or biomotion');
    }
  }
  function authorTime(t) {
    if (typeof t !== 'number' || !Number.isFinite(t)) throw new TypeError('HaiyuAxisLift requires finite author time');
    // Preserve the author's 480-frame/16π loop; do not multiply t by motion.
    const wrapped = t % AUTHOR_PERIOD;
    return wrapped < 0 ? wrapped + AUTHOR_PERIOD : wrapped;
  }

  // The source equations are kept together, with no candidate geometry mixed in.
  function fields(kind, y, u, t) {
    const e = y / 5 - 11;
    const k = (5 + Math.sin(y)) * u;
    const d = Math.hypot(k, e) / 0.6 - 6;
    const harmonic = 3 * Math.sin(e) + e * Math.sin(2 * e) + Math.sin(4 * d);
    const qEven = 99 + d * Math.sin(t - d);
    const qOdd = y / 23 * k * harmonic;
    const q = qEven + qOdd;
    const basePhase = d / 4 - t / 8;
    // This is the sole formula difference between 04 and 05.
    const phaseCorrection = kind === 'biomotion' ? Math.cos(t + e) / 9 : 0;
    const c = basePhase + phaseCorrection;
    return { y, u, e, k, d, harmonic, qEven, qOdd, q, c, basePhase, phaseCorrection,
      point: [q * Math.sin(c) + 200, q * Math.cos(c) + 200, 0] };
  }

  function sourceSample(kind, y, u, t) {
    checkKind(kind);
    if (!Number.isFinite(y) || y < 0 || y > SOURCE_MAX_Y || !Number.isFinite(u) || Math.abs(u) > 1) {
      throw new RangeError('Source material coordinates require 0 <= y <= SOURCE_MAX_Y and -1 <= u <= 1');
    }
    return fields(kind, y, u, authorTime(t));
  }

  function sourcePointByIndex(kind, i, t) {
    if (!Number.isInteger(i) || i < 0 || i >= SOURCE_COUNT) throw new RangeError('Source index outside 0..19999');
    return sourceSample(kind, i / 598, Math.cos(i / 7), t).point;
  }

  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const vertebralStations=Array.from({length:24},(_,i)=>0.03+0.94*i/23);
  const ribIndices=Array.from({length:16},(_,i)=>i+3);
  function axisPoint(kind,s,t,p){
    const f=fields(kind,s*SOURCE_MAX_Y,0,t),rest=fields(kind,s*SOURCE_MAX_Y,0,0);
    const q=rest.qEven+p.motion*(f.qEven-rest.qEven);
    const correction=rest.phaseCorrection+p.motion*(f.phaseCorrection-rest.phaseCorrection);
    const c=f.d/4+correction;
    const z=kind==='biomotion'&&p.motion!==0?12*p.depth*p.motion*(f.phaseCorrection-rest.phaseCorrection)*Math.sin(PI*s):0;
    return [200+q*Math.sin(c),200+q*Math.cos(c),z];
  }
  function rotate(v,axis,angle){const c=Math.cos(angle),s=Math.sin(angle);return add(add(scale(v,c),scale(cross(axis,v),s)),scale(axis,dot(axis,v)*(1-c)));}
  function makeFrames(kind,t,p){
    const sample=[];
    function tangentAt(s){const h=1e-5;return unit(sub(axisPoint(kind,s+h,t,p),axisPoint(kind,s-h,t,p)),[0,1,0]);}
    let previousT=tangentAt(0),V=unit([previousT[1],-previousT[0],0],[1,0,0]);
    for(let i=0;i<=128;i++){
      const s=i/128,T=tangentAt(s),turn=cross(previousT,T),n=length(turn);
      if(n>1e-12)V=rotate(V,scale(turn,1/n),Math.atan2(n,clamp(dot(previousT,T),-1,1)));
      V=unit(sub(V,scale(T,dot(T,V))),V);sample.push({T,V});previousT=T;
    }
    const cache=new Map();
    return function frame(s){
      if(cache.has(s))return cache.get(s);
      const q=clamp(s,0,1)*128,i=Math.min(127,Math.floor(q)),u=q-i,T=tangentAt(s);
      let V=add(scale(sample[i].V,1-u),scale(sample[i+1].V,u));V=unit(sub(V,scale(T,dot(T,V))),sample[i].V);
      const L=unit(cross(V,T),[0,0,1]),h=0.0001,A=axisPoint(kind,s,t,p),before=axisPoint(kind,s-h,t,p),after=axisPoint(kind,s+h,t,p);
      const d1=scale(sub(after,before),1/(2*h)),d2=scale(add(sub(after,scale(A,2)),before),1/(h*h));
      const curvatureRadius=length(d1)**3/Math.max(1e-10,length(cross(d1,d2)));
      const out={T,L,V,tangent:T,normal:L,binormal:V,curvatureRadius,speed:length(d1)};cache.set(s,out);return out;
    };
  }
  function unique(values){return Array.from(new Set(values.map(s=>+s.toFixed(12)))).sort((a,b)=>a-b);}

  function evaluate(kind,t,inputParams){
    checkKind(kind);t=Number(authorTime(t).toFixed(12));if(t>=AUTHOR_PERIOD)t=0;
    // Canonicalize only mesh time so finite-difference curvature is stable at
    // repeated loop phases. The original source sampling APIs stay untouched.
    const p=parameters(inputParams),frame=makeFrames(kind,t,p);
    const positions=[],faces=[],faceKinds=[],faceComponents=[],vertexS=[],components=[],junctions=[],lines=[],sections=[];
    const caliber=0.65+0.65*p.thickness,marrowRadius=0.65*caliber,canalRadius=1.14*caliber;
    const boneOuter=2.40*caliber,boneHalfSpan=0.94/23*0.285;
    const boneAround=8+2*Math.round(2*p.detail),ribRows=10+Math.round(8*p.detail),ribAround=6;
    const dimensionCache=new Map();
    function dims(s){
      if(dimensionCache.has(s))return dimensionCache.get(s);
      const f=fields(kind,s*SOURCE_MAX_Y,0,t),r=fields(kind,s*SOURCE_MAX_Y,0,0),edge=fields(kind,s*SOURCE_MAX_Y,1,t),odd=fields(kind,s*SOURCE_MAX_Y,0.75,t).qOdd;
      const q=r.qEven+p.motion*(f.qEven-r.qEven),span=2*q*Math.sin((edge.d-f.d)/8);
      const chest=Math.max(0,Math.sin(PI*clamp((s-0.08)/0.80,0,1)))**0.58;
      const signed=Math.tanh(odd/22),fine=Math.sin(4*f.d);
      const asym=(kind==='multifrequency'?0.105:0.055)*signed;
      const wave=1+p.motion*(kind==='multifrequency'?0.055:0.025)*(Math.sin(t-f.d)-Math.sin(-f.d));
      let W=(4.4+0.18*span*chest)*(kind==='multifrequency'?1+0.075*fine:1.05)*wave;
      let D=(7.5+0.24*span*chest)*(0.82+0.36*p.depth)*(kind==='biomotion'?1.10:1-0.035*fine)*wave;
      const margin=1.65*caliber,radius=frame(s).curvatureRadius;
      const rawExtent=Math.hypot(W*(1+Math.abs(asym))+boneOuter,D+margin);
      const fit=Math.min(1,0.42*radius/rawExtent);W*=fit;D*=fit;
      // Rib cages retain a positive cavity even at minimum depth/caliber.
      W=Math.max(W,3.6*caliber);D=Math.max(D,5.3*caliber);
      const left=W*(1+asym),right=W*(1-asym),pedicle=0.86*boneOuter;
      const out={W,D,left,right,pedicle,margin,sourceOdd:odd,sourceEven:q,sourcePhase:f.c,fit};dimensionCache.set(s,out);return out;
    }
    function point(P,s){vertexS.push(s);positions.push(P);return positions.length-1;}
    function face(a,b,c,tag,id){faces.push([a,b,c]);faceKinds.push(tag);faceComponents.push(id);}
    function tube(id,tag,levels,around,sectionAt,metadata={}){
      const startVertex=positions.length,startFace=faces.length,rings=[],centers=[],sectionFrames=[];
      for(const v of levels){const q=sectionAt(v),ring=[];centers.push(q.center);sectionFrames.push(q);
        for(let j=0;j<around;j++){const a=TWO_PI*j/around;ring.push(point(add(q.center,add(scale(q.normal,q.width*Math.cos(a)),scale(q.binormal,q.depth*Math.sin(a)))),q.s));}rings.push(ring);}
      for(let row=0;row<rings.length-1;row++)for(let j=0;j<around;j++){
        const k=(j+1)%around,a=rings[row][j],b=rings[row][k],c=rings[row+1][k],d=rings[row+1][j];
        if(j<around/2){face(a,b,c,tag,id);face(a,c,d,tag,id);}else{face(a,b,d,tag,id);face(b,c,d,tag,id);}
      }
      const lower=point(centers[0].slice(),sectionFrames[0].s),upper=point(centers.at(-1).slice(),sectionFrames.at(-1).s);
      for(let j=0;j<around;j++){let k=(j+1)%around;face(lower,rings[0][k],rings[0][j],tag,id);face(upper,rings.at(-1)[j],rings.at(-1)[k],tag,id);}
      const c={id,kind:tag,startVertex,vertexCount:positions.length-startVertex,startFace,faceCount:faces.length-startFace,rings,centers,...metadata};components.push(c);return c;
    }
    const marrowLevels=unique([0,1,...vertebralStations.flatMap(s=>[s-boneHalfSpan,s,s+boneHalfSpan])]);
    const marrow=tube('marrow','marrow',marrowLevels,8,s=>{const f=frame(s);return {center:axisPoint(kind,s,t,p),normal:f.L,binormal:f.V,width:marrowRadius,depth:marrowRadius,s};},{radius:marrowRadius,role:'continuous marrow inside vertebral canals',cutawayVisible:true});
    const boneByStation=[];
    for(let bi=0;bi<vertebralStations.length;bi++){
      const s=vertebralStations[bi],id='vertebra-'+bi,tag='vertebra',startVertex=positions.length,startFace=faces.length;
      const outer=[],inner=[],levels=[s-boneHalfSpan,s,s+boneHalfSpan];
      for(const [li,at]of levels.entries()){
        const A=axisPoint(kind,at,t,p),f=frame(at),ro=boneOuter*(li===1?1.045:0.96),outside=[],inside=[];
        for(let j=0;j<boneAround;j++){const a=TWO_PI*j/boneAround,radial=add(scale(f.L,Math.cos(a)),scale(f.V,Math.sin(a)));outside.push(point(add(A,scale(radial,ro)),at));inside.push(point(add(A,scale(radial,canalRadius)),at));}
        outer.push(outside);inner.push(inside);
      }
      for(let row=0;row<2;row++)for(let j=0;j<boneAround;j++){
        const k=(j+1)%boneAround,a=outer[row][j],b=outer[row][k],c=outer[row+1][k],d=outer[row+1][j];face(a,b,c,tag,id);face(a,c,d,tag,id);
        const e=inner[row][j],f=inner[row][k],g=inner[row+1][k],h=inner[row+1][j];face(e,g,f,tag,id);face(e,h,g,tag,id);
      }
      for(const row of [0,2])for(let j=0;j<boneAround;j++){
        const k=(j+1)%boneAround,a=outer[row][j],b=outer[row][k],c=inner[row][k],d=inner[row][j];
        if(row===0){face(a,c,b,tag,id);face(a,d,c,tag,id);}else{face(a,b,c,tag,id);face(a,c,d,tag,id);}
      }
      const bone={id,kind:tag,startVertex,vertexCount:positions.length-startVertex,startFace,faceCount:faces.length-startFace,s,levels,outerRings:outer,innerRings:inner,canalRadius,outerRadius:1.045*boneOuter,role:'closed annular vertebral shell; marrow is inside its real canal'};components.push(bone);boneByStation.push(bone);
    }
    const ribStations=ribIndices.map(i=>vertebralStations[i]);
    const sternumLevels=unique([...ribStations,...ribStations.slice(1).map((s,i)=>(s+ribStations[i])/2)]);
    function sternumPoint(s){return add(axisPoint(kind,s,t,p),scale(frame(s).V,dims(s).D));}
    const sternumRadius=0.80*caliber;
    const sternum=tube('sternum','sternum',sternumLevels,8,s=>{
      const h=1e-5,T=unit(sub(sternumPoint(s+h),sternumPoint(s-h)),frame(s).T),L=unit(sub(frame(s).L,scale(T,dot(T,frame(s).L))),frame(s).L),V=cross(T,L);
      return {center:sternumPoint(s),normal:L,binormal:V,width:sternumRadius,depth:sternumRadius,s};
    },{radius:sternumRadius,role:'continuous ventral sternum joining all left/right rib tips'});
    for(let ri=0;ri<ribIndices.length;ri++){
      const bi=ribIndices[ri],s=vertebralStations[bi],A=axisPoint(kind,s,t,p),f=frame(s),d=dims(s),ribs={};
      const source=fields(kind,s*SOURCE_MAX_Y,0,t),ribRadius=(0.49+0.035*Math.sin(4*source.d))*caliber;
      for(const side of [-1,1]){
        const id='rib-'+(side<0?'left-':'right-')+ri,tag=side<0?'rib-left':'rib-right',W=side<0?d.left:d.right;
        function center(u){return add(A,add(scale(f.L,side*(d.pedicle*(1-u)**2+W*Math.sin(PI*u))),scale(f.V,d.D*(1-Math.cos(PI*u))/2)));}
        const levels=Array.from({length:ribRows+1},(_,j)=>j/ribRows);
        const rib=tube(id,tag,levels,ribAround,u=>{
          const derivative=add(scale(f.L,side*(-2*d.pedicle*(1-u)+W*PI*Math.cos(PI*u))),scale(f.V,d.D*PI*Math.sin(PI*u)/2));
          const T=unit(derivative,f.L),normal=f.T,binormal=cross(T,normal),gauge=ribRadius*(1+0.12*(1-u)**3);
          return {center:center(u),normal,binormal,width:gauge,depth:gauge,s};
        },{s,side,sourceOdd:d.sourceOdd,radius:ribRadius,root:center(0),ventralJoin:center(1),role:'volumetric half-hoop; dorsal vertebral root to ventral sternum'});
        ribs[side<0?'left':'right']=rib;
        junctions.push({id:id+'-vertebra',components:[id,'vertebra-'+bi],center:center(0),radius:2.2*ribRadius+(boneOuter-d.pedicle),kind:'dorsal-costovertebral',rule:'actual intersection point must be inside this sphere'});
        junctions.push({id:id+'-sternum',components:[id,'sternum'],center:sternumPoint(s),radius:sternumRadius+ribRadius+0.10*caliber,kind:'ventral-costosternal',rule:'actual intersection point must be inside this sphere'});
      }
      junctions.push({id:'ventral-rib-pair-'+ri,components:[ribs.left.id,ribs.right.id],center:sternumPoint(s),radius:2.1*ribRadius,kind:'shared-ventral-junction',rule:'actual intersection point must be inside this sphere'});
      const marrowIndex=marrowLevels.findIndex(v=>Math.abs(v-s)<1e-10),sternumIndex=sternumLevels.findIndex(v=>Math.abs(v-s)<1e-10);
      sections.push({s,y:s*SOURCE_MAX_Y,material:s,origin:A,A,center:A,T:f.T,L:f.L,V:f.V,frame:f,
        marrow:marrow.rings[marrowIndex].map(i=>positions[i]),vertebraOuter:boneByStation[bi].outerRings[1].map(i=>positions[i]),vertebraInner:boneByStation[bi].innerRings[1].map(i=>positions[i]),
        ribLeft:ribs.left.centers,ribRight:ribs.right.centers,ribLeftIndices:ribs.left.rings,ribRightIndices:ribs.right.rings,
        sternum:sternum.rings[sternumIndex].map(i=>positions[i]),sternumPoint:sternumPoint(s),dorsalRootLeft:ribs.left.root,dorsalRootRight:ribs.right.root,
        widths:{left:d.left,right:d.right,ventral:d.D},area:PI*(d.left+d.right)/2*d.D/2,boneId:'vertebra-'+bi,
        sectionSource:'actual center-station bone/marrow rings and actual rib tube center curves; no independently generated diagram'});
    }
    // Bone-only scope: center curves are taken from the actual rib tubes.
    for(const section of sections)section.points=section.ribLeft.concat(section.ribRight.slice().reverse());
    const spine=marrow.centers;
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const a of positions)for(let j=0;j<3;j++){bounds.min[j]=Math.min(bounds.min[j],a[j]);bounds.max[j]=Math.max(bounds.max[j],a[j]);}
    const origin=positions[0];
    for(const component of components){let volume=0;for(let i=component.startFace;i<component.startFace+component.faceCount;i++){const f=faces[i];volume+=dot(sub(positions[f[0]],origin),cross(sub(positions[f[1]],origin),sub(positions[f[2]],origin)))/6;}component.signedVolume=volume;}
    const defaultSection=sections.reduce((a,b)=>Math.abs(b.s-0.42)<Math.abs(a.s-0.42)?b:a);
    return {positions,faces,faceKinds,faceComponents,vertexS,components,junctions,lines,spine,sections,section:defaultSection,
      diagnostics:{kind,authorTime:t,authorPeriod:AUTHOR_PERIOD,periodFrames:480,params:p,vertexCount:positions.length,faceCount:faces.length,bounds,
        vertebraCount:vertebralStations.length,ribPairs:ribIndices.length,ribStations,marrowRadius,canalRadius,canalClearance:canalRadius-marrowRadius,
        minRibArea:Math.min(...sections.map(s=>s.area)),maxDepth:Math.max(Math.abs(bounds.min[2]),Math.abs(bounds.max[2])),
        localFrame:'rotation-minimizing parallel transport; T longitudinal, L left/right, V dorsal to ventral; T cross L = V',
        candidate:'Three-dimensional thoracic skeleton: real annular vertebrae around marrow, paired tubular rib half-hoops and a ventral sternum; no soft-tissue envelope is included; an explicit interpretation, not measured anatomy or a species',
        sourceFidelity:'Exact source scalar/projection APIs retained; even phase span and qEven drive cavity dimensions, signed qOdd drives differentiated rib span; local pose removes rigid -t/8 spin; 05 correction also drives bounded depth bending',
        motionMeaning:'0 freezes all geometry; source internal phase motion is blended from rest and repeats exactly over 16π',
        depthMeaning:'Changes positive chest depth and 05 depth bend; minimum stays volumetric',thicknessMeaning:'Positive bone/tube caliber range, never a planar-ribbon collapse',
        contactRule:'Only actual intersection points inside an explicit junction sphere for that component pair are intentional; no broad root-fraction exclusions',
        crossSectionMeaning:'Snaps to an actual rib and vertebral station; curves come from the same packet mesh'} };
  }
  function crossSection(kind,t,params,s=0.42){
    if(!Number.isFinite(s))throw new TypeError('Section station must be finite');
    const packet=evaluate(kind,t,params),selected=packet.sections.reduce((a,b)=>Math.abs(b.s-s)<Math.abs(a.s-s)?b:a);
    return {...selected,requestedS:s,snapped:true,stationIndex:packet.sections.indexOf(selected),availableStations:packet.diagnostics.ribStations};
  }
  const api=Object.freeze({evaluate,crossSection,sourceSample,sourcePointByIndex,defaults,AUTHOR_PERIOD,AUTHOR_STEP,SOURCE_COUNT,SOURCE_MAX_Y});
  root.HaiyuAxisLift=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis==='undefined'?this:globalThis);
