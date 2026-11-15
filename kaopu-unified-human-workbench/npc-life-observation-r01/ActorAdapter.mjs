/**
 * NPC observation R01 — snapshots of the complete R07 generated person.
 * Construction computes each native identity once; animation changes only the
 * actor's 104 rigid bone matrices. No replacement person, top-4 weights, physics,
 * object ownership, UI, or per-frame model.compute is introduced here.
 */
import {NativeBinding, THREE} from './NativeBinding.mjs';
import {NativeRig, math} from './NativeRig.mjs';
export {THREE};

const {clamp, add, sub, scale, dot, cross, norm, unit, pos, mv, basisRotation} = math;
const SIDES = ['L', 'R'];
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
  if(!frozenProgramSources.has(source))frozenProgramSources.set(source,`npc-r01-frozen-source-${frozenProgramSources.size+1}`);
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
function findPalmSupport(geometry,binding,rig,side,handVertices) {
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
function fitCylinderGrasp({rig,binding,fingers,patch,handVertices,side,shape}) {
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
    rig.fk();binding.animate(rig.skinMatrices);
  }
  function evaluate(values,open,details=false) {
    pose(values,open);const anchor=samplePatch();let minimum=Infinity,minY=Infinity,deepest=null;
    const distances=details?new Map():null;
    for(const id of handVertices) {
      const delta=sub(binding.sampleVertex(id,true),anchor);
      const x=sign*dot(delta,frame.forward),y=-sign*dot(delta,across)+shape.gripHeight,
        z=dot(delta,frame.palm)-shape.radius;
      const radial=Math.hypot(x,z)-shape.radius,axial=Math.abs(y)-shape.height*.5;
      const distance=Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0);
      if(distance<minimum){minimum=distance;deepest=id;}minY=Math.min(minY,y);
      if(details)distances.set(id,distance);
    }
    return {minimumSignedDistanceM:minimum,minimumYMFromBottleCenter:minY,deepestVertex:deepest,
      ...(details?{fingerSurfaceMinimumSignedDistanceM:digitVertices.map(ids=>Math.min(...ids.map(i=>distances.get(i)))),
        fingerNearVertexCounts:digitVertices.map(ids=>ids.filter(i=>Math.abs(distances.get(i))<=.003).length)}:{})};
  }
  const zero=[0,0,0,0,0];let open=null,openCheck=null;
  // Native zero already contains curved fingers. Thumb extension/opposition
  // is searched explicitly; no geometry, bone length or collision tolerance
  // is altered to manufacture an admissible result.
  for(const candidate of [{angle:-35,opposition:-35},{angle:-35,opposition:-45},
    {angle:-45,opposition:-35},{angle:-45,opposition:-45},{angle:-25,opposition:-45}]) {
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
  const trajectory=Array.from({length:21},(_,i)=>evaluate(closure.map(v=>v*i/20),open));
  const closed=evaluate(closure,open,true),minimum=Math.min(...trajectory.map(x=>x.minimumSignedDistanceM));
  const touchingFingers=closed.fingerNearVertexCounts.slice(1).filter(n=>n>=3).length;
  const admissible=minimum>=-.0011&&touchingFingers>=3&&closure.slice(1).every(v=>v>=.05);
  return {admissible,reason:admissible?null:'Native open-to-close envelope lacks clearance or sufficient finger surface contacts',
    side,shape,open,closure,openCheck,closed,trajectorySamples:trajectory.length,
    minimumSignedDistanceM:minimum,minimumYMFromBottleCenter:Math.min(...trajectory.map(x=>x.minimumYMFromBottleCenter)),
    touchingNonThumbFingers:touchingFingers,boneLengthErrorM:rig.validate().maxBoneLengthError,
    scope:'complete weighted hand vertex samples; first-contact per-finger bisection; no force/friction or continuous-triangle guarantee'};
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
  const active={side:spec.side,grip:0};let last={},lastGoal=null,lastSolution=null,graspReport=null;
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
  function orientFor(side) {return basisRotation(rig.hand[side].forward,rig.hand[side].palm,
    directionNative([side==='L'?1:-1,0,0]),directionNative([0,0,1]));}
  function fingerPose(side,amount) {
    const fit=graspReport?.sides[side];
    if(!fit?.admissible)return;
    for(let f=1;f<=5;f++) {
      const finger=fingers[side+f],t=fit.closure[f-1]*amount;
      const angles=f===1?[fit.open.angle+(22-fit.open.angle)*t,34*t,28*t]:[60*t,76*t,45*t];
      finger.ids.forEach((id,k)=>{rig.rotationDeltas[id]=scale(finger.axes[k],angles[k]);});
    }
    const thumb=rig.index.get(`finger1-1.${side}`),sign=side==='L'?1:-1;
    const opposition=fit.open.opposition+(28-fit.open.opposition)*fit.closure[0]*amount;
    rig.rotationDeltas[thumb]=add(rig.rotationDeltas[thumb],scale(rig.hand[side].forward,sign*opposition));
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
    id:spec.id,label:spec.label,root,mesh,binding,rig,side:spec.side,floorOffset:binding.floorOffset,
    identity:{id:spec.id,label:spec.label,presetId:preset.id,stage:preset.stage,build:preset.build,
      phenotypes:structuredClone(preset.phenotypes),localChanges:structuredClone(preset.localChanges),
      portraitId:spec.portrait,portraitName:window.portraitBank.presets().find(p=>p.id===spec.portrait)?.name,
      source:'R07 complete native generated person',shapeCalibratedToRealPerson:false},
    measurements:{...measurements,heightM:binding.height,heightCM:binding.height*100,
      floorOffsetM:binding.floorOffset,armL:rig.limbs.armL.upper+rig.limbs.armL.lower,
      armR:rig.limbs.armR.upper+rig.limbs.armR.lower},
    materialReport:frozen.map(f=>f.report),
    contactReport:{kind:'display skin triangle barycentric anchors',palms:Object.fromEntries(SIDES.map(s=>[s,patches[s].palm])),
      fingers:Object.fromEntries(SIDES.map(s=>[s,patches[s].fingers])),
      forceOrFrictionMeasured:false,closure:'requires per-native-shape finite-cylinder contact calibration'},
    graspReport:null,
    configureGrasp({radius,height,gripHeight=0}={}){
      if(![radius,height,gripHeight].every(Number.isFinite)||radius<=0||height<=0||Math.abs(gripHeight)>=height*.5)
        throw Error('Native grasp calibration requires a positive cylinder and an interior axial gripHeight');
      const shape={kind:'upright-cylinder',radius,height,gripHeight},sides={};
      try {
        for(const side of SIDES) {
          const patch=findPalmSupport(geometry,binding,rig,side,handSurfaceVertices[side]);
          patches[side].palm=patch;
          sides[side]=fitCylinderGrasp({rig,binding,fingers,patch,handVertices:handSurfaceVertices[side],side,shape});
        }
        graspReport={shape,sides,admissible:SIDES.every(s=>sides[s].admissible)};
        this.graspReport=graspReport;
        this.contactReport.palms=Object.fromEntries(SIDES.map(s=>[s,patches[s].palm]));
        this.contactReport.closure='shape-specific weighted hand surface fit with first-contact bisection';
        return graspReport;
      } finally {this.rest();}
    },
    setSide(side){if(!SIDES.includes(side))throw Error('Native reach side must be L or R');active.side=side;this.side=side;return this;},
    handAnchor(side=active.side){return toWorld(sample(patches[side].palm));},
    fingerAnchors(side=active.side){return patches[side].fingers.map(p=>toWorld(sample(p)));},
    contactAnchors(side=active.side){return {palm:this.handAnchor(side),fingers:this.fingerAnchors(side)};},
    rest(){active.grip=0;lastGoal=null;lastSolution=null;resetRig();binding.animate(rig.skinMatrices);return diagnostic();},
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
    diagnostics({tableTopY=null,tableBounds=null,bottle=null}={}){
      // Sample the actual weighted hand surface only on diagnostic requests,
      // not at every physics substep. This catches a curled intermediate
      // phalanx below the table even when the fingertip itself is above it.
      if(tableBounds&&!['minX','maxX','minZ','maxZ'].every(k=>Number.isFinite(tableBounds[k])))
        throw Error('Table bounds require finite minX/maxX/minZ/maxZ');
      if(tableBounds&&(tableBounds.minX>tableBounds.maxX||tableBounds.minZ>tableBounds.maxZ))throw Error('Table bounds are reversed');
      let cylinder=null;
      if(bottle){
        const center=asVector(bottle.position),q=bottle.quaternion;
        const values=Array.isArray(q)||ArrayBuffer.isView(q)?Array.from(q):q?[q.x,q.y,q.z,q.w]:null;
        if(!center.toArray().every(Number.isFinite)||!values||values.length!==4||!values.every(Number.isFinite)||
          Math.hypot(...values)<1e-9||!(bottle.radius>0)||!(bottle.height>0)||!Number.isFinite(bottle.radius)||!Number.isFinite(bottle.height))
          throw Error('Bottle geometry requires finite position/quaternion and positive radius/height');
        const inverse=new THREE.Quaternion(...values).normalize().invert();
        cylinder={center,inverse,radius:bottle.radius,halfHeight:bottle.height*.5};
      }
      const cylinderDistance = p => {
        const local=p.clone().sub(cylinder.center).applyQuaternion(cylinder.inverse);
        // Exact signed distance to the finite local-Y cylinder, including caps.
        const radial=Math.hypot(local.x,local.z)-cylinder.radius,axial=Math.abs(local.y)-cylinder.halfHeight;
        return {distance:Math.hypot(Math.max(radial,0),Math.max(axial,0))+Math.min(Math.max(radial,axial),0),local};
      };
      root.updateWorldMatrix(true,false);let handSurfaceMinimumYM=Infinity,tableMinimumYM=Infinity,tableSampleCount=0;
      let minCylinderDistance=Infinity,penetratingCount=0,deepestPoint=null,deepestLocal=null,deepestVertex=null;
      const fingerSurfaceMinimum=Array(5).fill(Infinity),fingerNearCounts=Array(5).fill(0),fingerContactPoints=Array(5).fill(null);
      for(const id of handSurfaceVertices[active.side]) {
        const p=display(binding.sampleVertex(id,true)).applyMatrix4(root.matrixWorld);
        handSurfaceMinimumYM=Math.min(handSurfaceMinimumYM,p.y);
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
        graspFit:graspReport?.sides[active.side]||null,
        geometricDiagnosticScope:'weighted rendered hand vertices; finite-cylinder signed distance and table XZ projection; not continuous triangle collision or contact force'};
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
  while(performance.now()-started<300000) {
    qa=window.__IDENTITY_QA__;viewer=qa?.viewer?.();model=qa?.model?.();controller=qa?.controller?.();
    if(viewer?.mesh&&model?.positions?.length&&controller&&window.__LIP_P3__?.ready&&
      window.headProceduralSkin&&window.bodyProceduralSkin&&window.portraitBank?.apply&&window.__HEAD_PROC__?.gpuVerified)break;
    if(performance.now()-lastProgress>2000){onProgress('正在载入原生 R07 人物，等待完整皮肤与 GPU 首帧');lastProgress=performance.now();}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  if(!viewer?.mesh||!model?.positions?.length||!controller)throw Error('R07 native viewer/model did not finish loading');
  if(!window.headProceduralSkin||!window.bodyProceduralSkin||!window.__HEAD_PROC__?.gpuVerified)
    throw Error('R07 complete procedural skin did not finish GPU linking: '+(window.__HEAD_PROC__?.errors||[]).join('; '));
  if(!window.portraitBank?.apply||!model.r05Stream?.prepare)throw Error('R07 native portrait / complete coefficient pager is unavailable');
  await viewer.skin.faceReady;await viewer.skin.naturalEyesReady;
  window.lifelikeIdle?.pause?.(true);
  const catalog=window.fullCommonWorkbench?.allPresets?.();if(!catalog)throw Error('Native R02 identity catalogue is unavailable');
  const specs=[{id:'A',label:'A · 高瘦',build:'tall-slim',portrait:'P01',side:'L',x:-.40,z:-.06},
    {id:'B',label:'B · 矮壮',build:'short-heavy',portrait:'P02',side:'R',x:.40,z:-.06},
    {id:'C',label:'C · 结实',build:'sturdy',portrait:'P05',side:'R',x:1.45,z:-.10}];
  const saved=controller.archive(),base=controller.state(),actors=[];
  const wasVisible=viewer.mesh.visible;
  try {
    for(const spec of specs) {
      onProgress(`正在生成 ${spec.label}：完整 R07 人物与原生骨架`);
      const preset=catalog.find(p=>p.collection==='r02'&&p.stage==='adult'&&p.build===spec.build&&p.phenotypes.gender===0);
      if(!preset)throw Error(`Native adult male preset is missing: ${spec.build}`);
      const state=structuredClone(base);
      state.anny.phenotypes={...state.anny.phenotypes,...preset.phenotypes};
      state.anny.localChanges=structuredClone(preset.localChanges);
      state.anny.pose={};state.anny.translations={};
      if(state.gnm){state.gnm.rotation=state.gnm.rotation.map(()=>0);state.gnm.translation=[0,0,0];}
      await model.r05Stream.prepare(state);
      await controller.commit(state);viewer.render();await pauseFrame();
      const bodySignature=JSON.stringify([model.state.anny.phenotypes,model.state.anny.localChanges]);
      onProgress(`正在应用 ${spec.label} 的原生脸型 ${spec.portrait}`);
      const applied=await window.portraitBank.apply(spec.portrait);
      if(applied?.id!==spec.portrait||window.portraitBank.selected()!==spec.portrait)throw Error('Native portrait application was cancelled');
      if(JSON.stringify([model.state.anny.phenotypes,model.state.anny.localChanges])!==bodySignature)
        throw Error('Portrait application unexpectedly changed native body identity');
      viewer.render();await pauseFrame();
      viewer.render();
      const measurement=structuredClone(window.fullCommonWorkbench.measurements?.()||{});
      const actor=makeActor(model,viewer,spec,preset,measurement);actors.push(actor);
      onProgress(`${spec.label} 已冻结：${actor.binding.report.displayVertices.toLocaleString()} 表面顶点 / 104 原生骨`);
      await pauseFrame();
    }
  } catch(error) {
    for(const actor of actors)actor.dispose();throw error;
  } finally {
    await controller.restore(saved);viewer.mesh.visible=wasVisible;viewer.render();
  }
  viewer.mesh.visible=false;
  // Host commits/portrait updates above draw only their current native model.
  // All snapshots become renderable together after the host is restored. The
  // Workbench's next frame draws them with its final camera/world setup.
  for(const actor of actors)actor.root.visible=true;
  onProgress('三个完整人物已就绪；后续只更新各自骨矩阵');
  return {actors,viewer};
}
