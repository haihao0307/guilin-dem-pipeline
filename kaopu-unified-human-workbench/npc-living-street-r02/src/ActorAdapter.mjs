/**
 * NPC observation R02 — six distinct snapshots of the complete R07 generated person.
 * Construction computes each native identity once; animation changes only the
 * actor's 104 rigid bone matrices. No replacement person, top-4 weights, physics,
 * object ownership, UI, or per-frame model.compute is introduced here.
 */
import {NativeBinding, THREE} from './NativeBinding.mjs';
import {NativeRig, math} from './NativeRig.mjs';
import {ACTOR_PROFILES} from './ActorProfiles.mjs';
import {prepareActorMotion} from './NativeMotionLibrary.mjs';
export {ACTOR_PROFILES};
export {THREE};

const {clamp, add, sub, scale, dot, cross, norm, unit, pos, mv, basisRotation} = math;
const SIDES = ['L', 'R'];

/** Keep physical prop dimensions separate from their axes in the palm frame.
 * The original loaf is taken at its long-axis end with a quarter-turn wrist;
 * its actual mesh and Cannon hull are not rotated or resized by this fit. */
export function createNativeGraspShape({radius,height,gripHeight=0,profile='bottle',halfExtentsM=null}={}) {
  if(profile==='bread') {
    if(!Array.isArray(halfExtentsM)||halfExtentsM.length!==3||halfExtentsM.some(v=>!Number.isFinite(v)||v<=0))
      throw Error('Native bread calibration requires three positive physical half extents');
    return {kind:'ellipsoid',halfExtentsM:[halfExtentsM[2],halfExtentsM[1],halfExtentsM[0]],
      physicalHalfExtentsM:halfExtentsM.slice(),contactYawRadians:Math.PI/2,gripHeight:0};
  }
  if(![radius,height,gripHeight].every(Number.isFinite)||radius<=0||height<=0||Math.abs(gripHeight)>=height*.5)
    throw Error('Native grasp calibration requires a positive cylinder and an interior axial gripHeight');
  return {kind:'upright-cylinder',radius,height,gripHeight,contactYawRadians:0};
}
const native = p => [p.x, -p.z, p.y];
const display = p => new THREE.Vector3(p[0], p[2], -p[1]);
const asVector = p => p?.isVector3 ? p.clone() : p && 'x' in p ? new THREE.Vector3(p.x,p.y,p.z) : new THREE.Vector3(...p);
const pauseFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const hash = text => { let h = 2166136261; for (let i=0;i<text.length;i++) h = Math.imul(h ^ text.charCodeAt(i),16777619); return (h>>>0).toString(16); };
// Program identity depends on exact shader source, never on the person using
// it. Three retains its normal material/defines/light variants around this
// key. The exact-source Map also avoids treating a short hash collision as
// equivalent code; only the small stable token enters Three's program key.
const frozenProgramSources = new Map();
function frozenProgramKey(vertexShader,fragmentShader) {
  const source=JSON.stringify([vertexShader,fragmentShader]);
  if(!frozenProgramSources.has(source))frozenProgramSources.set(source,`npc-r02-frozen-source-${frozenProgramSources.size+1}`);
  return frozenProgramSources.get(source);
}

/** Material.clone does NOT copy onBeforeCompile. Capture the original chained
 * shader now, while its morphology fields still belong to this identity. Only
 * custom uniforms are frozen; Three retains its own live light/camera uniforms.
 */
function freezeMaterial(source, renderer, actorId, textureCopies) {
  const template = THREE.ShaderLib[source.isMeshPhysicalMaterial ? 'physical' : 'standard'];
  if (!template) throw Error('R07 native physical ShaderLib is unavailable');
  const uniforms = THREE.UniformsUtils.clone(template.uniforms);
  const initial = {...uniforms};
  const shader = {uniforms, vertexShader:template.vertexShader, fragmentShader:template.fragmentShader,
    defines:{...source.defines}};
  source.onBeforeCompile(shader, renderer);
  const ownedTextures = [];
  function copy(value) {
    if (value === null || value === undefined || typeof value !== 'object') return value;
    if (value.isTexture) {
      if (textureCopies.has(value)) return textureCopies.get(value);
      const result = value.clone();
      // Data-backed geometry fields must not share mutable pixel storage with
      // the next generated identity. Image-backed appearance assets are static.
      if (value.image?.data && ArrayBuffer.isView(value.image.data)) {
        const image = {...value.image, data:value.image.data.slice()};
        result.source = new THREE.Source(image);
      }
      result.needsUpdate = true;
      textureCopies.set(value, result); ownedTextures.push(result); return result;
    }
    if (ArrayBuffer.isView(value)) return value.slice();
    if (Array.isArray(value)) return value.map(copy);
    if (value.clone) return value.clone();
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v)]));
  }
  const frozen = {};
  for (const [key, uniform] of Object.entries(shader.uniforms)) {
    if (!(key in initial) || initial[key] !== uniform) frozen[key] = {value:copy(uniform.value)};
  }
  const material = source.clone(), vertexShader=shader.vertexShader, fragmentShader=shader.fragmentShader;
  const programKey = frozenProgramKey(vertexShader,fragmentShader);
  material.name = `${source.name || source.type}/npc-${actorId}`;
  material.defines = {...source.defines, ...shader.defines};
  material.onBeforeCompile = live => {
    live.vertexShader = vertexShader; live.fragmentShader = fragmentShader;
    Object.assign(live.uniforms, frozen);
  };
  // Each material still owns its frozen uniform objects and copied data
  // textures; sharing the GPU program does not share these material values.
  material.customProgramCacheKey = () => programKey;
  material.needsUpdate = true;
  return {material, ownedTextures, report:{sourceType:source.type, sourceName:source.name,
    frozenCustomUniforms:Object.keys(frozen), vertexShaderHash:hash(vertexShader),
    fragmentShaderHash:hash(fragmentShader), programCacheKey:programKey,
    chainedR07ShaderRetained:true}};
}

function restVertex(geometry, id) {
  const p=geometry.attributes.position;
  return [p.getX(id), -p.getZ(id), p.getY(id)];
}
function average(points) { return scale(points.reduce((out,p)=>add(out,p),[0,0,0]),1/points.length); }

/** Select a real display triangle, not a joint-space proxy. Its barycentric
 * point remains on the linearly skinned rendered hand triangle at every pose.
 * R07 hand detail changes shading normals, not hand vertex displacement.
 */
function findSkinPatch(geometry, target, {maxDistance, forward, palm, wrist, alongMin, alongMax}={}) {
  const indices=geometry.index.array, P=geometry.attributes.position.array;
  const near=maxDistance*maxDistance, normalAttribute=geometry.attributes.normal;
  let chosen=null, best=Infinity;
  for(let k=0;k<indices.length;k+=3) {
    const a=indices[k],b=indices[k+1],c=indices[k+2];
    const center=[(P[a*3]+P[b*3]+P[c*3])/3,
      -(P[a*3+2]+P[b*3+2]+P[c*3+2])/3,
      (P[a*3+1]+P[b*3+1]+P[c*3+1])/3];
    const delta=sub(center,target), d2=dot(delta,delta);
    if(d2>near) continue;
    if(wrist) { const t=dot(sub(center,wrist),forward); if(t<alongMin||t>alongMax) continue; }
    let alignment=1;
    if(palm) {
      const n=normalAttribute ? unit([normalAttribute.getX(a)+normalAttribute.getX(b)+normalAttribute.getX(c),
        -(normalAttribute.getZ(a)+normalAttribute.getZ(b)+normalAttribute.getZ(c)),
        normalAttribute.getY(a)+normalAttribute.getY(b)+normalAttribute.getY(c)]) :
        unit(cross(sub(restVertex(geometry,b),restVertex(geometry,a)),sub(restVertex(geometry,c),restVertex(geometry,a))));
      alignment=dot(n,palm); if(alignment<.12) continue;
    }
    const score=d2+(1-alignment)*near*.025;
    if(score<best) { best=score;chosen={indices:[a,b,c],barycentric:[1/3,1/3,1/3],rest:center,normalAlignment:alignment}; }
  }
  if(!chosen) throw Error('The generated native hand has no valid skin contact triangle');
  return chosen;
}

/** A convex palm pad must reach the prop before the central palm hollow.
 * Select an actual vertex of a rendered triangle in the distal palm, using
 * native shape, normals and all CSR influences. Finger/thenar influences are
 * excluded here because those surfaces move during thumb opposition. */
export function findPalmSupport(geometry,binding,rig,side,handVertices) {
  const wrist=rig.restP[rig.index.get(`wrist.${side}`)],frame=rig.hand[side];
  const length=norm(sub(rig.restP[rig.index.get(`finger3-1.${side}`)],wrist));
  const normals=geometry.attributes.normal;let id=-1,support=-Infinity,alignment=0;
  for(const i of handVertices) {
    const p=restVertex(geometry,i),along=dot(sub(p,wrist),frame.forward);
    if(along<length*.52||along>length*.8)continue;
    const normal=unit([normals.getX(i),-normals.getZ(i),normals.getY(i)]),a=dot(normal,frame.palm);
    if(a<.3)continue;
    const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];let moving=0;
    for(let k=0;k<count;k++) {
      const j=binding.displayPacked[(start+k)*8+3],w=binding.displayPacked[(start+k)*8+4];
      if(/finger[1-5]|metacarpal1/.test(rig.names[j]))moving+=w;
    }
    if(moving>1e-6)continue;
    const distance=dot(sub(p,wrist),frame.palm);
    if(distance>support){id=i;support=distance;alignment=a;}
  }
  if(id<0)throw Error(`Native ${side} palm has no stable convex contact pad`);
  const index=geometry.index.array;
  for(let k=0;k<index.length;k+=3)for(let v=0;v<3;v++)if(index[k+v]===id) {
    const barycentric=[0,0,0];barycentric[v]=1;
    return {indices:[index[k],index[k+1],index[k+2]],barycentric,
      rest:restVertex(geometry,id),normalAlignment:alignment,vertex:id,
      selection:'shape-derived convex distal-palm support; actual rendered triangle vertex'};
  }
  throw Error('The native palm support is not part of a rendered triangle');
}

/** Offline per-identity/side fit. Every candidate uses the complete native
 * skin, including blended joint-conditioned rest points. It fits an upright
 * finite cylinder in the palm frame; runtime World still verifies the actual
 * prop pose. This is a geometric assisted-grip envelope, not a force solver. */
export function fitCylinderGrasp({rig,binding,fingers,patch,handVertices,side,shape}) {
  const frame=rig.hand[side],sign=side==='L'?1:-1,across=unit(cross(frame.forward,frame.palm));
  const digitVertices=Array.from({length:5},(_,f)=>handVertices.filter(i=>{
    const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];
    for(let k=0;k<count;k++)if(rig.names[binding.displayPacked[(start+k)*8+3]].startsWith(`finger${f+1}-`)&&binding.displayPacked[(start+k)*8+4]>1e-6)return true;
    return false;
  }));
  function samplePatch(){let p=[0,0,0];for(let k=0;k<3;k++)if(patch.barycentric[k])p=add(p,scale(binding.sampleVertex(patch.indices[k],true),patch.barycentric[k]));return p;}
  function pose(values,open) {
    for(const v of rig.rotationDeltas)v.fill(0);rig.rootTranslation.fill(0);
    for(let f=1;f<=5;f++) {
      const t=values[f-1],finger=fingers[side+f];
      const a=f===1?[open.angle+(22-open.angle)*t,34*t,28*t]:[60*t,76*t,45*t];
      finger.ids.forEach((id,k)=>{rig.rotationDeltas[id]=scale(finger.axes[k],a[k]);});
    }
    const thumb=rig.index.get(`finger1-1.${side}`),opposition=open.opposition+(28-open.opposition)*values[0];
    rig.rotationDeltas[thumb]=add(rig.rotationDeltas[thumb],scale(frame.forward,sign*opposition));
    // The rounded native hand's thenar pad is predominantly bound to the
    // existing thumb metacarpal. Extend that actual joint only when all
    // original open poses fail; taper it with the same calibrated thumb
    // closure at runtime. No skin position or bone length is changed.
    rig.rotationDeltas[rig.index.get(`metacarpal1.${side}`)]=
      scale(frame.forward,sign*(open.metacarpalOpposition??0)*(1-values[0]));
    rig.fk();binding.animate(rig.skinMatrices);
  }
  function evaluate(values,open,details=false) {
    pose(values,open);const anchor=samplePatch();let minimum=Infinity,minY=Infinity,deepest=null,horizontalReachM=0,maximumPalmRadiusM=0;
    const distances=details?new Map():null;
    for(const id of handVertices) {
      const delta=sub(binding.sampleVertex(id,true),anchor);
      const x=sign*dot(delta,frame.forward),y=-sign*dot(delta,across)+shape.gripHeight,
        z=dot(delta,frame.palm)-(shape.kind==='ellipsoid'?shape.halfExtentsM[2]:shape.radius);
      let distance;
      if(shape.kind==='ellipsoid'){
        const h=shape.halfExtentsM,k0=Math.hypot(x/h[0],y/h[1],z/h[2]),k1=Math.hypot(x/(h[0]*h[0]),y/(h[1]*h[1]),z/(h[2]*h[2]));
        distance=k1<1e-12?-Math.min(...h):k0*(k0-1)/k1;
      }else{
        const radial=Math.hypot(x,z)-shape.radius,axial=Math.abs(y)-shape.height*.5;
        distance=Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0);
      }
      if(distance<minimum){minimum=distance;deepest=id;}minY=Math.min(minY,y);
      horizontalReachM=Math.max(horizontalReachM,Math.hypot(x,dot(delta,frame.palm)));
      maximumPalmRadiusM=Math.max(maximumPalmRadiusM,norm(delta));
      if(details)distances.set(id,distance);
    }
    return {minimumSignedDistanceM:minimum,minimumYMFromBottleCenter:minY,horizontalReachM,maximumPalmRadiusM,deepestVertex:deepest,
      ...(details?{fingerSurfaceMinimumSignedDistanceM:digitVertices.map(ids=>Math.min(...ids.map(i=>distances.get(i)))),
        fingerNearVertexCounts:digitVertices.map(ids=>ids.filter(i=>Math.abs(distances.get(i))<=.003).length)}:{})};
  }
  const zero=[0,0,0,0,0];let open=null,openCheck=null;
  // Native zero already contains curved fingers. Thumb extension/opposition
  // is searched explicitly; no geometry, bone length or collision tolerance
  // is altered to manufacture an admissible result.
  for(const candidate of [{angle:-35,opposition:-35},{angle:-35,opposition:-45},
    {angle:-45,opposition:-35},{angle:-45,opposition:-45},{angle:-25,opposition:-45},
    // This single bounded fallback was derived from measured original-hand
    // clearance at -8/-10 degrees, with a 0.1 mm open-pose margin. It remains
    // subject to every unchanged open, closure and surface-contact gate.
    {angle:-45,opposition:-45,metacarpalOpposition:-11.6}]) {
    const check=evaluate(zero,candidate,true);
    if(check.minimumSignedDistanceM>=-.0005){open=candidate;openCheck=check;break;}
  }
  if(!open)return {admissible:false,reason:'No tested native open-thumb pose clears the actual cylinder',shape};
  const closure=zero.slice(),tolerance=.001;
  for(let f=0;f<5;f++) {
    let accepted=0,rejected=null;
    for(let i=1;i<=40;i++) {
      const candidate=closure.slice();candidate[f]=i/40;
      if(evaluate(candidate,open).minimumSignedDistanceM < -tolerance){rejected=i/40;break;}
      accepted=i/40;
    }
    if(rejected!==null) {
      let lo=accepted,hi=rejected;
      for(let i=0;i<12;i++){const mid=(lo+hi)*.5,candidate=closure.slice();candidate[f]=mid;
        if(evaluate(candidate,open).minimumSignedDistanceM>=-tolerance)lo=mid;else hi=mid;}
      accepted=lo;
    }
    closure[f]=accepted;
  }
  const contactRetention=[];
  if(shape.kind==='ellipsoid') {
    let current=evaluate(closure,open,true);
    const touching=check=>check.fingerNearVertexCounts.slice(1).filter(n=>n>=3).length;
    // A curved native digit can touch a convex surface shallowly, then curl
    // clear again without ever exceeding the original 1 mm penetration stop.
    // Retain that existing surface contact only if the final fit lacks the
    // required three fingers. Reuse the original [0,1] scalar curl path and
    // forty calibration intervals; no extra joint range or contact tolerance.
    for(let f=1;f<5&&touching(current)<3;f++) {
      if(current.fingerNearVertexCounts[f]>=3)continue;
      const before=closure[f];let previous=null,exit=null;
      for(let i=0;i<=40;i++) {
        const t=before*i/40,candidate=closure.slice();candidate[f]=t;
        const check=evaluate(candidate,open,true),gap=check.fingerSurfaceMinimumSignedDistanceM[f];
        if(previous&&previous.gap<=0&&gap>0&&
          previous.minimum>=-tolerance&&check.minimumSignedDistanceM>=-tolerance)exit=[previous.t,t];
        previous={t,gap,minimum:check.minimumSignedDistanceM};
      }
      if(!exit)continue;
      let [lo,hi]=exit;
      for(let i=0;i<24;i++) {
        const mid=(lo+hi)*.5,candidate=closure.slice();candidate[f]=mid;
        if(evaluate(candidate,open,true).fingerSurfaceMinimumSignedDistanceM[f]<=0)lo=mid;else hi=mid;
      }
      const candidate=closure.slice();candidate[f]=(lo+hi)*.5;
      const check=evaluate(candidate,open,true);
      if(check.minimumSignedDistanceM>=-tolerance&&check.fingerNearVertexCounts[f]>=3&&touching(check)>touching(current)) {
        contactRetention.push({finger:f+1,originalClosure:before,retainedClosure:candidate[f],exitBracket:exit,
          gapBeforeM:current.fingerSurfaceMinimumSignedDistanceM[f],gapAfterM:check.fingerSurfaceMinimumSignedDistanceM[f],
          nearVertices:check.fingerNearVertexCounts[f],method:'last measured shallow contact exit on the unchanged original curl path'});
        closure[f]=candidate[f];current=check;
      }
    }
  }
  const trajectory=Array.from({length:21},(_,i)=>evaluate(closure.map(v=>v*i/20),open));
  const closed=evaluate(closure,open,true),minimum=Math.min(...trajectory.map(x=>x.minimumSignedDistanceM));
  const touchingFingers=closed.fingerNearVertexCounts.slice(1).filter(n=>n>=3).length;
  const admissible=minimum>=-.0011&&touchingFingers>=3&&closure.slice(1).every(v=>v>=.05);
  return {admissible,reason:admissible?null:'Native open-to-close envelope lacks clearance or sufficient finger surface contacts',
    side,shape,open,closure,openCheck,closed,contactRetention,trajectorySamples:trajectory.length,
    minimumSignedDistanceM:minimum,minimumYMFromBottleCenter:Math.min(...trajectory.map(x=>x.minimumYMFromBottleCenter)),
    horizontalReachM:Math.max(...trajectory.map(x=>x.horizontalReachM)),
    maximumPalmRadiusM:Math.max(...trajectory.map(x=>x.maximumPalmRadiusM)),
    touchingNonThumbFingers:touchingFingers,boneLengthErrorM:rig.validate().maxBoneLengthError,
    scope:'complete weighted hand vertex samples; first-contact per-finger bisection; no force/friction or continuous-triangle guarantee'};
}

/** The same calibrated native finger composition is used by the live actor
 * and numerical geometry verification. All sixteen native finger/thumb
 * joints remain native; this function changes rotation deltas only. */
export function applyNativeFittedGrip(rig,fingers,fit,side,amount){
  if(!fit?.admissible)return;
  for(let f=1;f<=5;f++) {
    const finger=fingers[side+f],t=fit.closure[f-1]*amount;
    const angles=f===1?[fit.open.angle+(22-fit.open.angle)*t,34*t,28*t]:[60*t,76*t,45*t];
    finger.ids.forEach((id,k)=>{rig.rotationDeltas[id]=scale(finger.axes[k],angles[k]);});
  }
  const thumb=rig.index.get(`finger1-1.${side}`),sign=side==='L'?1:-1;
  const opposition=fit.open.opposition+(28-fit.open.opposition)*fit.closure[0]*amount;
  rig.rotationDeltas[thumb]=add(rig.rotationDeltas[thumb],scale(rig.hand[side].forward,sign*opposition));
  rig.rotationDeltas[rig.index.get(`metacarpal1.${side}`)]=scale(rig.hand[side].forward,
    sign*(fit.open.metacarpalOpposition??0)*(1-fit.closure[0]*amount));
}

/** The native L5 rails classify the actual frozen display geometry. Selecting
 * from the body-prefix or a guessed head offset misses the refined lips. */
export function findNativeMouthSupport(geometry,model){
  const rails=model.lipStructure?.rails,R=geometry.attributes.fRest,T=geometry.attributes.csType;
  if(!rails?.sample||!R||!T)throw Error('The original native lip rails are unavailable');
  const selected={upper:null,lower:null};let candidates=0;
  for(let id=0;id<R.count;id++){
    if(T.getX(id)>=.5)continue;
    const q=rails.sample([R.getX(id),R.getY(id),R.getZ(id)],T.getX(id));
    if(!q.roi||q.front<.8||Math.abs(q.u)>.20||q.v<.12||q.v>.78)continue;
    candidates++;const p=restVertex(geometry,id),key=q.upper?'upper':'lower';
    const score=p[1]+Math.abs(q.u)*.002;
    if(!selected[key]||score<selected[key].score)selected[key]={id,rest:p,score,region:{u:q.u,v:q.v,upper:q.upper,front:q.front}};
  }
  if(!selected.upper||!selected.lower)throw Error('The actual native central vermilion support is incomplete');
  const chosen=selected.upper.rest[1]<=selected.lower.rest[1]?selected.upper:selected.lower;
  return {vertex:chosen.id,rest:chosen.rest.slice(),region:chosen.region,
    upperVertex:selected.upper.id,lowerVertex:selected.lower.id,candidates,
    source:'original R07 L5 rails.sample on actual fRest/csType display attributes',
    originalDisplayVertices:R.count,selection:'actual central vermilion surface support; complete display CSR retained'};
}

function makeActor(model, viewer, spec, preset, measurements) {
  // The rendered R07 mesh carries its two sorted material groups. Cloning only
  // viewer.geometry would discard that full-body procedural-skin selection.
  const originalMesh=viewer.mesh, geometry=originalMesh.geometry.clone();
  const sources=Array.isArray(originalMesh.material)?originalMesh.material:[originalMesh.material];
  if(sources.length!==2||geometry.groups.length!==2) throw Error('R07 complete two-group procedural skin is not active');
  const textureCopies=new Map();
  const frozen=sources.map(source=>freezeMaterial(source,viewer.renderer,spec.id,textureCopies));
  const mesh=new THREE.Mesh(geometry,frozen.map(f=>f.material));
  mesh.name=`NPC-${spec.id}-R07-complete-native-person`;mesh.castShadow=true;mesh.receiveShadow=true;
  const binding=new NativeBinding(model,{...viewer,mesh,geometry});binding.activate(true);
  const rig=new NativeRig({...binding.rig,stature:binding.height});
  if(rig.count!==104) throw Error(`R07 native bone count changed: ${rig.count}`);
  const root=new THREE.Group();root.name=`NPC-${spec.id}`;root.visible=false;
  root.position.set(spec.x,binding.floorOffset,spec.z);root.add(mesh);
  viewer.scene.add(root);root.updateMatrixWorld(true);
  const fingers={},patches={},handSurfaceVertices={},handFingerMembership={};
  for(const side of SIDES) {
    const wrist=rig.restP[rig.index.get(`wrist.${side}`)], frame=rig.hand[side];
    const palmLength=norm(sub(rig.restP[rig.index.get(`finger3-1.${side}`)],wrist));
    const palmGoal=add(add(wrist,scale(frame.forward,palmLength*.59)),scale(frame.palm,binding.height*.005));
    const palmPatch=findSkinPatch(geometry,palmGoal,{maxDistance:palmLength*.44,
      forward:frame.forward,palm:frame.palm,wrist,alongMin:palmLength*.32,alongMax:palmLength*.8});
    patches[side]={palm:palmPatch,fingers:[]};
    const handJoints=new Set(rig.descendants[rig.index.get(`wrist.${side}`)]),handVertices=[];
    for(let i=0;i<geometry.attributes.position.count;i++) {
      const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];
      for(let k=0;k<count;k++)if(handJoints.has(binding.displayPacked[(start+k)*8+3])&&binding.displayPacked[(start+k)*8+4]>1e-6){handVertices.push(i);break;}
    }
    handSurfaceVertices[side]=handVertices;
    handFingerMembership[side]=new Map(handVertices.map(i=>{
      const start=binding.displayRange[i*4],count=binding.displayRange[i*4+1];let mask=0;
      for(let k=0;k<count;k++) {
        const joint=rig.names[binding.displayPacked[(start+k)*8+3]],match=joint.match(/^finger([1-5])-/);
        if(match&&binding.displayPacked[(start+k)*8+4]>1e-6)mask|=1<<(Number(match[1])-1);
      }
      return [i,mask];
    }));
    for(let f=1;f<=5;f++) {
      const ids=[1,2,3].map(k=>rig.index.get(`finger${f}-${k}.${side}`));
      const points=ids.map(id=>rig.restP[id]), tip=add(points[2],scale(sub(points[2],points[1]),.65));
      fingers[side+f]={ids,axes:ids.map((j,k)=>unit(cross(unit(k<2?sub(points[k+1],points[k]):sub(points[2],points[1])),frame.palm)))};
      patches[side].fingers.push(findSkinPatch(geometry,add(tip,scale(frame.palm,binding.height*.002)),
        {maxDistance:binding.height*.017,palm:frame.palm}));
    }
  }
  const feet=SIDES.map(side=>{
    const foot=rig.restP[rig.index.get(`foot.${side}`)];let id=-1,lowest=Infinity,best=Infinity;
    for(let i=0;i<binding.N;i++){
      const p=restVertex(geometry,i);if(p[0]*foot[0]<=0||p[2]>-binding.floorOffset+.025)continue;
      const d=norm(sub(p,foot));if(p[2]<lowest-1e-7||(Math.abs(p[2]-lowest)<1e-7&&d<best)){lowest=p[2];best=d;id=i;}
    }
    if(id<0)throw Error('Native planted foot surface is unavailable');
    return {id,side,rest:restVertex(geometry,id)};
  });
  const soleSurfaceIds={L:[],R:[]};
  for(let i=0;i<binding.N;i++) {
    const z=binding.positions[i*3+2];if(z>-binding.floorOffset+binding.height*.13)continue;
    for(const side of SIDES){let weight=0;for(let k=0;k<binding.range[i*2+1];k++){
      const slot=(binding.range[i*2]+k)*8,name=rig.names[binding.packed[slot+3]];
      if(/^(foot|toe)/.test(name)&&name.endsWith('.'+side))weight+=binding.packed[slot+4];
    }if(weight>.5)soleSurfaceIds[side].push(i);}
  }
  const mouthSupport=findNativeMouthSupport(geometry,model);
  const graspProfiles={};
  const active={side:spec.side,grip:0,profile:'bottle'};let last={},lastGoal=null,lastSolution=null,graspReport=null;
  const toLocal = target => {root.updateWorldMatrix(true,false);return native(root.worldToLocal(asVector(target)));};
  const toWorld = target => {root.updateWorldMatrix(true,false);return root.localToWorld(display(target));};
  const directionNative = direction => {
    const a=toLocal([0,0,0]),b=toLocal(direction);return unit(sub(b,a));
  };
  function sample(patch) {
    const out=[0,0,0];
    for(let i=0;i<patch.indices.length;i++) {
      const p=binding.sampleVertex(patch.indices[i],true),w=patch.barycentric[i];
      for(let k=0;k<3;k++)out[k]+=w*p[k];
    }
    return out;
  }
  // Read the same full CSR skinning equation as the renderer, but from the
  // current CPU rig. Motion composition can correct a foot or palm before
  // submitting the complete 104-bone pose to the GPU once. No top-4 reduction.
  function sampleLiveVertex(id) {
    const range=binding.displayRange,entries=binding.displayPacked,out=[0,0,0];
    for(let n=0;n<range[id*4+1];n++) {
      const k=(range[id*4]+n)*8,m=rig.skinMatrices[entries[k+3]],w=entries[k+4];
      for(let q=0;q<3;q++)out[q]+=w*(m[q*4]*entries[k]+m[q*4+1]*entries[k+1]+m[q*4+2]*entries[k+2]+m[q*4+3]);
    }
    return out;
  }
  function sampleLivePatch(patch) {
    const out=[0,0,0];
    for(let i=0;i<patch.indices.length;i++) {
      const p=sampleLiveVertex(patch.indices[i]),w=patch.barycentric[i];
      for(let k=0;k<3;k++)out[k]+=w*p[k];
    }
    return out;
  }
  function orientFor(side) {return basisRotation(rig.hand[side].forward,rig.hand[side].palm,
    directionNative([side==='L'?1:-1,0,0]),directionNative([0,0,1]));}
  function fingerPose(side,amount) {
    applyNativeFittedGrip(rig,fingers,graspReport?.sides[side],side,amount);
  }
  function resetRig(grip=0,side=active.side,reaching=false) {
    for(const v of rig.rotationDeltas)v.fill(0);rig.rootTranslation.fill(0);
    if(reaching)fingerPose(side,grip);
    rig.fk();
    // Both arms hang beside the native body. The untouched torso and lower
    // hierarchy keep both feet at exactly their generated rest coordinates.
    for(const s of SIDES) {
      const limb=rig.limbs['arm'+s],shoulder=pos(rig.posedMatrices[limb.a]),sign=s==='L'?1:-1;
      const length=limb.upper+limb.lower;
      const target=add(shoulder,[sign*length*.16,-length*.075,-length*.955]);
      rig.solveLimb(limb,target,add(shoulder,[sign*length*.55,-length*.12,-length*.45]),.995);
      rig.orientSkin(limb.c,basisRotation(rig.hand[s].forward,rig.hand[s].palm,[0,0,-1],[-sign,0,0]));
    }
  }
  function diagnostic(target=null,solved=null) {
    const checked=rig.validate();let footSurfaceErrorM=0;const footWorld={};
    for(const foot of feet){const point=binding.sampleVertex(foot.id,true);footSurfaceErrorM=Math.max(footSurfaceErrorM,norm(sub(point,foot.rest)));footWorld[foot.side]=toWorld(point).toArray();}
    const palm=toWorld(sample(patches[active.side].palm));
    const fingertips=patches[active.side].fingers.map(p=>toWorld(sample(p)));
    last={side:active.side,grip01:active.grip,palm:palm.toArray(),
      handErrorM:target?palm.distanceTo(asVector(target)):0,reachClamped:!!solved?.clamped,
      boneLengthErrorM:checked.maxBoneLengthError,footSurfaceErrorM,
      footAnchorsWorld:footWorld,footWorldYM:Object.fromEntries(Object.entries(footWorld).map(([side,p])=>[side,p[1]])),
      fingerAnchors:fingertips.map(p=>p.toArray()),fingerMinimumYM:Math.min(...fingertips.map(p=>p.y)),
      graspAdmissible:!!graspReport?.sides[active.side]?.admissible,
      finite:checked.finite,orientation:'world palm +Z; fingers +X for L / -X for R during cylindrical reach'};
    return last;
  }
  const actor={
    id:spec.id,label:spec.label,profile:spec.profile,root,mesh,binding,rig,side:spec.side,floorOffset:binding.floorOffset,
    identity:{id:spec.id,name:spec.profile.name,sex:spec.profile.sex,hair:spec.profile.hair,label:spec.label,presetId:preset.id,stage:preset.stage,build:preset.build,
      phenotypes:structuredClone(preset.phenotypes),localChanges:structuredClone(preset.localChanges),
      portraitId:spec.portrait,portraitName:window.portraitBank.presets().find(p=>p.id===spec.portrait)?.name,
      source:'R07 complete native generated person',shapeCalibratedToRealPerson:false},
    measurements:{...measurements,heightM:binding.height,heightCM:binding.height*100,
      floorOffsetM:binding.floorOffset,armL:rig.limbs.armL.upper+rig.limbs.armL.lower,
      armR:rig.limbs.armR.upper+rig.limbs.armR.lower},
    nativeSource:{positions:binding.positions,faces:model.faces.slice(),bodyCount:model.bodyCount,
      headTransform:structuredClone(model.canonical.headTransform),gnmRecipes:structuredClone(model.canonical.gnmRecipes),
      gnm:{template:model.gnm.template?.slice(),triangles:model.gnm.triangles?.slice(),componentId:model.gnm.componentId?.slice(),numVertices:model.gnm.numVertices},
      source:'CURRENT_HUMAN R07 exact per-identity native snapshot; positions are not the subdivided display mesh'},
    materialReport:frozen.map(f=>f.report),
    contactReport:{kind:'display skin triangle barycentric anchors',palms:Object.fromEntries(SIDES.map(s=>[s,patches[s].palm])),
      fingers:Object.fromEntries(SIDES.map(s=>[s,patches[s].fingers])),
      mouth:mouthSupport,
      forceOrFrictionMeasured:false,closure:'requires per-native-shape finite-cylinder contact calibration'},
    graspReport:null,graspProfiles,
    // Body/legs/arms are composed by NativeMotion. clear() intentionally does
    // not run FK, reset the arms, or submit matrices. commit() is the single
    // renderer submission after all native limb constraints have been solved.
    poseTools:{
      feet:feet.map(f=>({...f,rest:f.rest.slice()})),soleSurfaceIds,
      toLocal,toWorld,
      restVertex:id=>restVertex(geometry,id),
      sampleVertex:sampleLiveVertex,
      samplePalm:(side='R')=>sampleLivePatch(patches[side].palm),
      sampleMouth:()=>sampleLiveVertex(mouthSupport.vertex),
      mouthSupport,
      palmRest:(side='R')=>patches[side].palm.rest.slice(),
      selectGrasp:profile=>actor.selectGrasp(profile),
      clear({side='R',grip=0,handActive=false}={}){
        for(const v of rig.rotationDeltas)v.fill(0);rig.rootTranslation.fill(0);
        active.side=side;active.grip=clamp(grip,0,1);
        if(handActive)fingerPose(side,active.grip);
      },
      applyGrip(side,amount){fingerPose(side,clamp(amount,0,1));},
      commit({side='R',grip=0,target=null,solution=null}={}){
        active.side=side;active.grip=clamp(grip,0,1);
        lastGoal=target?asVector(target):null;lastSolution=solution;
        binding.animate(rig.skinMatrices);
      }
    },
    configureGrasp({radius,height,gripHeight=0,profile='bottle',halfExtentsM=null}={}){
      const shape=createNativeGraspShape({radius,height,gripHeight,profile,halfExtentsM}),sides={};
      try {
        for(const side of SIDES) {
          const patch=findPalmSupport(geometry,binding,rig,side,handSurfaceVertices[side]);
          patches[side].palm=patch;
          sides[side]=fitCylinderGrasp({rig,binding,fingers,patch,handVertices:handSurfaceVertices[side],side,shape});
        }
        graspReport={profile,shape,sides,admissible:SIDES.every(s=>sides[s].admissible)};
        graspProfiles[profile]=graspReport;active.profile=profile;
        this.graspReport=graspReport;
        if(!graspReport.admissible){
          // Capture the exact rendered hand ancestry on failure. This is a
          // read-only diagnostic fixture; it never changes a pose or a gate.
          const ids=[...new Set(SIDES.flatMap(s=>[...handSurfaceVertices[s],...patches[s].palm.indices]))].sort((a,b)=>a-b),
            remap=new Map(ids.map((id,i)=>[id,i])),P=geometry.attributes.position,N=geometry.attributes.normal,
            ranges=[],entries=[];
          for(const id of ids){const start=binding.displayRange[id*4],count=binding.displayRange[id*4+1];
            ranges.push(entries.length/8,count,0,0);
            for(let k=0;k<count;k++)entries.push(...binding.displayPacked.subarray((start+k)*8,(start+k+1)*8));}
          this.graspFailureFixture={schema:'npc-exact-displayed-hands/1',actor:spec.id,shape,
            sourceDisplayVertices:P.count,originalVertexIds:ids,
            positions:ids.flatMap(id=>[P.getX(id),P.getY(id),P.getZ(id)]),
            normals:ids.flatMap(id=>[N.getX(id),N.getY(id),N.getZ(id)]),
            rig:structuredClone(binding.rig),displayRange:ranges,displayPacked:entries,
            fingers:structuredClone(fingers),
            sides:Object.fromEntries(SIDES.map(s=>[s,{handVertices:handSurfaceVertices[s].map(id=>remap.get(id)),
              patch:{...structuredClone(patches[s].palm),indices:patches[s].palm.indices.map(id=>remap.get(id))}}])),
            sourceFit:structuredClone(graspReport),weightsTruncated:false,
            scope:'Every displayed hand vertex and every native CSR influence from this actual failed actor; no generated substitute hand'};
        }
        this.contactReport.palms=Object.fromEntries(SIDES.map(s=>[s,patches[s].palm]));
        this.contactReport.closure='shape-specific weighted hand surface fit with first-contact bisection';
        return graspReport;
      } finally {this.rest();}
    },
    selectGrasp(profile='bottle'){
      const selected=graspProfiles[profile];
      if(!selected?.admissible)throw Error(`NPC ${spec.id} has no admissible native ${profile} grasp`);
      graspReport=selected;this.graspReport=selected;active.profile=profile;return selected;
    },
    setSide(side){if(!SIDES.includes(side))throw Error('Native reach side must be L or R');active.side=side;this.side=side;return this;},
    handAnchor(side=active.side){return toWorld(sample(patches[side].palm));},
    fingerAnchors(side=active.side){return patches[side].fingers.map(p=>toWorld(sample(p)));},
    contactAnchors(side=active.side){return {palm:this.handAnchor(side),fingers:this.fingerAnchors(side)};},
    rest(){active.grip=0;lastGoal=null;lastSolution=null;resetRig();binding.animate(rig.skinMatrices);return diagnostic();},
    mouthContactFixture(){
      // Read only: preserve the exact refined native lip supports and every
      // CSR influence so numerical arm/food checks can use these same lips.
      const ids=[...new Set([mouthSupport.vertex,mouthSupport.upperVertex,mouthSupport.lowerVertex])];
      root.updateWorldMatrix(true,false);
      return {schema:'native-refined-mouth-support-fixture/1',actor:spec.id,identity:structuredClone(this.identity),
        sourceDisplayVertices:geometry.attributes.position.count,nativeVertices:binding.N,
        heightM:binding.height,floorOffsetM:binding.floorOffset,weightsTruncated:false,mutation:false,
        mouthSupport:structuredClone(mouthSupport),rig:structuredClone(binding.rig),
        vertices:ids.map(id=>{const start=binding.displayRange[id*4],count=binding.displayRange[id*4+1];
          return {id,rest:restVertex(geometry,id),entries:Array.from(binding.displayPacked.subarray(start*8,(start+count)*8)),
            currentNative:sampleLiveVertex(id),currentWorld:toWorld(sampleLiveVertex(id)).toArray()};}),
        currentSkinMatrices:rig.skinMatrices.map(m=>Array.from(m)),currentWorldMatrix:root.matrixWorld.toArray(),
        scope:'Actual original R07 L5 selected refined lip vertices with full CSR. This read-only fixture does not assert whole-head collision, material, rendering or eating completion.'};
    },
    reachability(target,side=active.side){
      if(!SIDES.includes(side))throw Error('Native reach side must be L or R');
      const limb=rig.limbs['arm'+side],wrist=rig.restP[limb.c],rotation=orientFor(side);
      const goal=sub(toLocal(target),mv(rotation,sub(patches[side].palm.rest,wrist)));
      const distanceM=norm(sub(goal,rig.restP[limb.a])),minM=Math.abs(limb.upper-limb.lower)+1e-5,
        maxM=(limb.upper+limb.lower)*.995,errorM=Math.max(0,minM-distanceM,distanceM-maxM);
      return {reachable:errorM<.002,distanceM,minM,maxM,errorM,side,definition:'native shoulder-to-wrist reach with actual palm offset'};
    },
    setReach(target,grip01=0,side=active.side){
      if(!SIDES.includes(side))throw Error('Native reach side must be L or R');
      const worldTarget=asVector(target);if(!worldTarget.toArray().every(Number.isFinite)||!Number.isFinite(grip01))throw Error('Non-finite hand goal');
      if(!graspReport?.sides[side]?.admissible)throw Error(`NPC ${spec.id} ${side} hand has no admissible calibrated cylinder grasp`);
      active.side=side;active.grip=clamp(grip01,0,1);resetRig(active.grip,side,true);
      const limb=rig.limbs['arm'+side],rotation=orientFor(side),localGoal=toLocal(worldTarget);
      const shoulder=pos(rig.posedMatrices[limb.a]),sign=side==='L'?1:-1,length=limb.upper+limb.lower;
      const pole=add(shoulder,[sign*length*.58,-length*.08,-length*.43]);
      let wristTarget=sub(localGoal,mv(rotation,sub(patches[side].palm.rest,rig.restP[limb.c]))),solved;
      // Correction is based on the weighted visible palm triangle. It changes
      // only upper/lower arm rotations; an unreachable target remains an error.
      for(let i=0;i<3;i++) {
        solved=rig.solveLimb(limb,wristTarget,pole,.995);rig.orientSkin(limb.c,rotation);
        binding.animate(rig.skinMatrices);
        const error=sub(localGoal,sample(patches[side].palm));
        if(norm(error)<.00035||solved.clamped)break;
        wristTarget=add(wristTarget,error);
      }
      lastGoal=worldTarget.clone();lastSolution=solved;return diagnostic(lastGoal,lastSolution);
    },
    diagnostics({tableTopY=null,tableBounds=null,bottle=null,prop=null,fixtures=[]}={}){
      // Sample the actual weighted hand surface only on diagnostic requests,
      // not at every physics substep. This catches a curled intermediate
      // phalanx below the table even when the fingertip itself is above it.
      if(tableBounds&&!['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(tableBounds[k])))
        throw Error('Table bounds require finite minX/maxX/minZ/maxZ');
      if(tableBounds&&(tableBounds.minX>tableBounds.maxX||tableBounds.minZ>tableBounds.maxZ))throw Error('Table bounds are reversed');
      if(bottle&&prop)throw Error('Choose exactly one actual diagnostic prop');
      const object=prop||bottle;let cylinder=null;
      if(object){
        const center=asVector(object.position),q=object.quaternion;
        const values=Array.isArray(q)||ArrayBuffer.isView(q)?Array.from(q):q?[q.x,q.y,q.z,q.w]:null;
        if(!center.toArray().every(Number.isFinite)||!values||values.length!==4||!values.every(Number.isFinite)||
          Math.hypot(...values)<1e-9)throw Error('Prop geometry requires a finite position and quaternion');
        if(object.kind==='bread'?!Array.isArray(object.halfExtentsM)||object.halfExtentsM.length!==3||object.halfExtentsM.some(v=>!Number.isFinite(v)||v<=0):
          !(object.radius>0)||!(object.height>0)||!Number.isFinite(object.radius)||!Number.isFinite(object.height))
          throw Error('Prop geometry requires positive actual dimensions');
        const inverse=new THREE.Quaternion(...values).normalize().invert();
        cylinder={center,inverse,kind:object.kind||'bottle',radius:object.radius,halfHeight:object.height*.5,halfExtentsM:object.halfExtentsM};
      }
      const cylinderDistance = p => {
        const local=p.clone().sub(cylinder.center).applyQuaternion(cylinder.inverse);
        if(cylinder.kind==='bread'){
          const h=cylinder.halfExtentsM,v=local.toArray(),k0=Math.hypot(...v.map((x,i)=>x/h[i])),k1=Math.hypot(...v.map((x,i)=>x/(h[i]*h[i])));
          return {distance:k1<1e-12?-Math.min(...h):k0*(k0-1)/k1,local};
        }
        // Exact signed distance to the finite local-Y cylinder, including caps.
        const radial=Math.hypot(local.x,local.z)-cylinder.radius,axial=Math.abs(local.y)-cylinder.halfHeight;
        return {distance:Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0),local};
      };
      root.updateWorldMatrix(true,false);let handSurfaceMinimumYM=Infinity,tableMinimumYM=Infinity,tableSampleCount=0;
      let minCylinderDistance=Infinity,penetratingCount=0,deepestPoint=null,deepestLocal=null,deepestVertex=null;
      const fingerSurfaceMinimum=Array(5).fill(Infinity),fingerNearCounts=Array(5).fill(0),fingerContactPoints=Array(5).fill(null);
      const fixtureChecks=fixtures.map(f=>{
        if(!Array.isArray(f.min)||!Array.isArray(f.max)||f.min.length!==3||f.max.length!==3||[...f.min,...f.max].some(v=>!Number.isFinite(v)))throw Error('Actual fixture AABB is incomplete');
        return {id:f.id,min:f.min.slice(),max:f.max.slice(),insideVertices:0,maximumPenetrationM:0,deepestVertex:null};
      });
      for(const id of handSurfaceVertices[active.side]) {
        const p=display(binding.sampleVertex(id,true)).applyMatrix4(root.matrixWorld);
        handSurfaceMinimumYM=Math.min(handSurfaceMinimumYM,p.y);
        for(const fixture of fixtureChecks){
          const v=p.toArray();if(v.every((x,i)=>x>fixture.min[i]&&x<fixture.max[i])){
            fixture.insideVertices++;const depth=Math.min(...v.flatMap((x,i)=>[x-fixture.min[i],fixture.max[i]-x]));
            if(depth>fixture.maximumPenetrationM){fixture.maximumPenetrationM=depth;fixture.deepestVertex=id;}
          }
        }
        if(!tableBounds||(p.x>=tableBounds.minX&&p.x<=tableBounds.maxX&&p.z>=tableBounds.minZ&&p.z<=tableBounds.maxZ)){
          tableMinimumYM=Math.min(tableMinimumYM,p.y);tableSampleCount++;
        }
        if(cylinder){const result=cylinderDistance(p);if(result.distance<0)penetratingCount++;
          if(result.distance<minCylinderDistance){minCylinderDistance=result.distance;deepestPoint=p.toArray();deepestLocal=result.local.toArray();deepestVertex=id;}
          const mask=handFingerMembership[active.side].get(id);
          for(let f=0;f<5;f++)if(mask&(1<<f)){
            if(result.distance<fingerSurfaceMinimum[f]){fingerSurfaceMinimum[f]=result.distance;fingerContactPoints[f]=p.toArray();}
            if(Math.abs(result.distance)<=.003)fingerNearCounts[f]++;
          }
        }
      }
      const live=diagnostic(lastGoal,lastSolution);
      const minimumInsideTable=tableSampleCount?tableMinimumYM:null;
      return {...live,binding:binding.report,handSurfaceMinimumYM,
        handSurfaceSampleCount:handSurfaceVertices[active.side].length,
        handTableMinimumYM:minimumInsideTable,handTableSampleCount:tableSampleCount,
        handTableClearanceM:Number.isFinite(tableTopY)&&tableSampleCount?tableMinimumYM-tableTopY:null,
        bottleMinimumSignedDistanceM:cylinder?minCylinderDistance:null,
        bottleMaxPenetrationM:cylinder?Math.max(0,-minCylinderDistance):null,
        bottlePenetratingVertexCount:cylinder?penetratingCount:null,
        bottleSampleCount:cylinder?handSurfaceVertices[active.side].length:0,
        bottleDeepestPointWorld:deepestPoint,bottleDeepestPointLocal:deepestLocal,bottleDeepestVertex:deepestVertex,
        fingerBottleSignedDistanceM:cylinder?live.fingerAnchors.map(p=>cylinderDistance(asVector(p)).distance):null,
        fingerSurfaceMinimumSignedDistanceM:cylinder?fingerSurfaceMinimum:null,
        fingerNearBottleVertexCounts:cylinder?fingerNearCounts:null,
        fingerClosestBottlePointsWorld:cylinder?fingerContactPoints:null,
        propKind:cylinder?.kind||null,propMinimumSignedDistanceM:cylinder?minCylinderDistance:null,
        propMaximumPenetrationM:cylinder?Math.max(0,-minCylinderDistance):null,
        propSampleCount:cylinder?handSurfaceVertices[active.side].length:0,
        fixtureChecks,graspProfile:active.profile,
        mouthSupport,actualMouthSurface:toWorld(sampleLiveVertex(mouthSupport.vertex)).toArray(),
        graspFit:graspReport?.sides[active.side]||null,
        geometricDiagnosticScope:'every weighted rendered hand vertex; actual prop-local cylinder/ellipsoid surface and authored fixture AABBs; no continuous-triangle or independent friction claim'};
    },
    dispose(){root.removeFromParent();binding.dispose();geometry.dispose();for(const f of frozen)f.material.dispose();for(const texture of textureCopies.values())texture.dispose();}
  };
  binding.report.materialShaderSnapshots=frozen.map(f=>f.report);
  actor.rest();
  return actor;
}

/** R07 must finish its native loading and surface installation before this
 * runs. Identity generation is deliberately sequential because the existing
 * generator owns one mutable output. The captured actors do not retain it as
 * their animation source. */
export async function createActors({onProgress=()=>{}}={}) {
  let qa,viewer,model,controller;
  const started=performance.now();let lastProgress=-Infinity;
  const startup=window.__NPC_STARTUP__={version:'npc-native-startup-raster@1',startedAtMS:started,
    completed:false,error:null,phase:'waiting-for-native-viewer',timings:[],
    raster:{capPixelRatio:.5,originalPixelRatio:null,restoredPixelRatio:null,limiting:false,changes:[]}};
  let raster=null,prepared=false;const actors=[];
  const sample=()=>{
    const renderer=raster?.renderer||viewer?.renderer;if(!renderer)return null;
    const size=renderer.getSize(new THREE.Vector2());
    return {pixelRatio:renderer.getPixelRatio(),logicalSize:[size.x,size.y],
      canvasSize:[renderer.domElement.width,renderer.domElement.height],hostRenderCount:viewer?.renders??null};
  };
  const mark=(phase,detail={})=>{
    const atMS=performance.now()-started,previous=startup.timings.at(-1);
    if(previous)previous.durationMS=atMS-previous.atMS;
    startup.phase=phase;startup.timings.push({phase,atMS,raster:sample(),...detail});
  };
  const limitRaster=()=>{
    if(raster||!viewer?.renderer)return;
    const renderer=viewer.renderer,originalPixelRatio=renderer.getPixelRatio(),setPixelRatio=renderer.setPixelRatio;
    if(!(originalPixelRatio>0)||!Number.isFinite(originalPixelRatio))throw Error('Native renderer has an invalid pixel ratio');
    raster={renderer,originalPixelRatio,setPixelRatio};startup.raster.originalPixelRatio=originalPixelRatio;
    // R07's ResizeObserver calls setSize(), which retains this pixel ratio.
    // Guard any additional native ratio request until the original host has
    // been restored and hidden. Geometry, shaders and GPU readiness stay native.
    renderer.setPixelRatio=function(value){
      const result=setPixelRatio.call(this,value===undefined?value:Math.min(value,.5));
      startup.raster.changes.push({atMS:performance.now()-started,requested:value??null,actual:sample()});
      return result;
    };
    startup.raster.limiting=true;renderer.setPixelRatio(originalPixelRatio);
    mark('native-bootstrap-at-limited-raster');
  };
  mark('waiting-for-native-viewer');
  try {
    while(performance.now()-started<300000) {
      qa=window.__IDENTITY_QA__;viewer=qa?.viewer?.();model=qa?.model?.();controller=qa?.controller?.();
      limitRaster();
      if(viewer?.mesh&&model?.positions?.length&&controller&&window.__LIP_P3__?.ready&&
        window.headProceduralSkin&&window.bodyProceduralSkin&&window.portraitBank?.apply&&window.__HEAD_PROC__?.gpuVerified)break;
      if(performance.now()-lastProgress>2000){onProgress('正在载入原生 R07 人物，等待完整皮肤与 GPU 首帧');lastProgress=performance.now();}
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!viewer?.mesh||!model?.positions?.length||!controller)throw Error('R07 native viewer/model did not finish loading');
    if(!window.headProceduralSkin||!window.bodyProceduralSkin||!window.__HEAD_PROC__?.gpuVerified)
      throw Error('R07 complete procedural skin did not finish GPU linking: '+(window.__HEAD_PROC__?.errors||[]).join('; '));
    if(!window.portraitBank?.apply||!model.r05Stream?.prepare)throw Error('R07 native portrait / complete coefficient pager is unavailable');
    mark('native-skin-ready');await viewer.skin.faceReady;await viewer.skin.naturalEyesReady;
    window.lifelikeIdle?.pause?.(true);
    const catalog=window.fullCommonWorkbench?.allPresets?.();if(!catalog)throw Error('Native R02 identity catalogue is unavailable');
    const specs=ACTOR_PROFILES.map((profile,i)=>({...profile,profile,label:profile.name+' · '+profile.description.split(' · ')[0],portrait:profile.faceId,side:'R',x:(i-2.5)*1.2,z:0}));
    const saved=controller.archive(),base=controller.state(),wasVisible=viewer.mesh.visible;
    let generated=false,restored=false;
    try {
      for(const spec of specs) {
        mark(spec.id+':prepare-native-coefficients');
        onProgress(`正在生成 ${spec.label}：完整 R07 人物与原生骨架`);
        const preset=catalog.find(p=>p.id===spec.presetId&&p.collection==='r02'&&p.stage===spec.stage&&p.phenotypes.gender===spec.gender);
        if(!preset)throw Error(`Native catalogue identity is missing: ${spec.presetId}`);
        const state=structuredClone(base);
        state.anny.phenotypes={...state.anny.phenotypes,...preset.phenotypes};
        state.anny.localChanges=structuredClone(preset.localChanges);
        state.anny.pose={};state.anny.translations={};
        if(state.gnm){state.gnm.rotation=state.gnm.rotation.map(()=>0);state.gnm.translation=[0,0,0];}
        await model.r05Stream.prepare(state);
        mark(spec.id+':commit-native-body');
        await controller.commit(state);viewer.render();await pauseFrame();
        const bodySignature=JSON.stringify([model.state.anny.phenotypes,model.state.anny.localChanges]);
        mark(spec.id+':apply-native-portrait');
        onProgress(`正在应用 ${spec.label} 的原生脸型 ${spec.portrait}`);
        const applied=await window.portraitBank.apply(spec.portrait);
        if(applied?.id!==spec.portrait||window.portraitBank.selected()!==spec.portrait)throw Error('Native portrait application was cancelled');
        if(JSON.stringify([model.state.anny.phenotypes,model.state.anny.localChanges])!==bodySignature)
          throw Error('Portrait application unexpectedly changed native body identity');
        viewer.render();await pauseFrame();
        viewer.render();
        mark(spec.id+':freeze-complete-native-actor');
        const measurement=structuredClone(window.fullCommonWorkbench.measurements?.()||{});
        const actor=makeActor(model,viewer,spec,preset,measurement);actors.push(actor);
        mark(spec.id+':prepare-existing-native-motion');
        await prepareActorMotion(actor,message=>onProgress(spec.label+' · '+message));
        mark(spec.id+':native-actor-frozen',{displayVertices:actor.binding.report.displayVertices,nativeBones:actor.binding.report.nativeBones});
        onProgress(`${spec.label} 已冻结：${actor.binding.report.displayVertices.toLocaleString()} 表面顶点 / 104 原生骨`);
        await pauseFrame();
      }
      generated=true;
    } finally {
      mark('restore-original-native-host');
      try {await controller.restore(saved);restored=true;}
      finally {
        viewer.mesh.visible=generated&&restored?false:wasVisible;
        startup.hostRestored=restored;startup.originalMeshHidden=!viewer.mesh.visible;
        mark('original-native-host-restoration-settled');
      }
      viewer.render();
    }
    // Host commits/portrait updates above draw only their current native model.
    // The Workbench draws all six snapshots with its final camera/world setup,
    // after the outer finally restores the renderer's original pixel ratio.
    for(const actor of actors)actor.root.visible=true;
    onProgress('六个完整人物已就绪；后续只更新各自骨矩阵');
    prepared=true;return {actors,viewer};
  } catch(error) {
    startup.error=String(error?.message||error);
    for(const actor of actors)actor.dispose();throw error;
  } finally {
    try {
      if(raster){
        const {renderer,setPixelRatio,originalPixelRatio}=raster;
        renderer.setPixelRatio=setPixelRatio;
        setPixelRatio.call(renderer,originalPixelRatio);
        startup.raster.limiting=false;startup.raster.restoredPixelRatio=renderer.getPixelRatio();
        if(startup.raster.restoredPixelRatio!==originalPixelRatio)throw Error('Native startup pixel ratio did not restore');
      }
    } catch(error) {startup.error=String(error?.message||error);throw error;}
    finally {
      startup.completed=prepared&&!startup.error;startup.elapsedMS=performance.now()-started;
      mark(startup.completed?'native-actors-ready-at-restored-raster':'native-startup-failed');
    }
  }
}
