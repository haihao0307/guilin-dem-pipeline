import {validateWeatherDomain,toParentMetres,makeGridLayout,createWeatherStateCache,cacheFromNumericSamples} from './cache.mjs';
import {V26_SOURCE_LOCK,V26_WATER_WEATHER_FUNCTION_PROVENANCE} from '../weather-audit/original-water-weather.mjs';

export const RUNOFF_LIMITS=Object.freeze({maxSourcesPerWall:8,maxWallHeight:4,maxFallLength:2.4,maxTotalCacheNodes:262144});
export const RUNOFF_DEFAULTS=Object.freeze({windowFall:.9,eaveFall:1.35,outletFall:1.6,widthFade:.08,lateralSpreadPerMetre:.025,entryFade:.035,tailStart:.68,decayLengthFraction:.65,exteriorDepthStart:.005,exteriorDepthFull:.035});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error('Finite '+label+' required');return v;};
const normalFor=w=>({front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0]})[w.side];
const receiverPoint=(w,u,y)=>w.alongX?[u,y,w.fixed]:[w.fixed,y,u];

export function makeWallRunoffDomain(wall,parentDomain){
  for(const k of ['start','end','bottom','height','fixed'])finite(wall[k],'wall '+k);
  if(typeof wall.alongX!=='boolean'||!normalFor(wall)||wall.end<=wall.start||wall.height<=0||wall.height>RUNOFF_LIMITS.maxWallHeight)throw Error('Runoff requires an axis-aligned real wall of height <=4m');
  const parent=validateWeatherDomain(parentDomain),width=wall.end-wall.start;
  return validateWeatherDomain({
    id:parent.id+'/'+wall.id+'/runoff',
    parentOriginMetres:receiverPoint(wall,(wall.start+wall.end)/2,wall.bottom+wall.height/2),
    parentBasis:[[1,0,0],[0,1,0],[0,0,1]],
    fullDimensionsMetres:wall.alongX?[width,wall.height,.32]:[.32,wall.height,width],
    fieldScaleMetres:parent.fieldScaleMetres,waterSeed:parent.waterSeed,weatherSeed:parent.weatherSeed,
    parentNormal:normalFor(wall),
  });
}

/** Read actual sill solids, slab undersides and explicitly identified outlets.
 * Pipe routes, supply terminals and the tank are not presumed to be leaking.
 */
export function deriveWallRunoffSources(recipe,wall,options={}){
  const o={...RUNOFF_DEFAULTS,...options},sources=[],excluded=[];
  for(const k of Object.keys(RUNOFF_DEFAULTS))finite(o[k],k);
  for(const k of ['windowFall','eaveFall','outletFall'])if(o[k]<=.04||o[k]>RUNOFF_LIMITS.maxFallLength)throw Error('Bounded physical fall length required');
  if(o.widthFade<=0||o.widthFade>.3||o.lateralSpreadPerMetre<0||o.lateralSpreadPerMetre>.1||o.entryFade<=0||o.entryFade>.1||o.tailStart<=0||o.tailStart>=1||o.decayLengthFraction<=0||o.decayLengthFraction>1||o.exteriorDepthStart<0||o.exteriorDepthFull<=o.exteriorDepthStart||o.exteriorDepthFull>.055)throw Error('Invalid finite runoff envelope bounds');
  const add=(source)=>{
    if(![source.u0,source.u1,source.y,source.fallLength,source.strength].every(Number.isFinite)||source.fallLength<=0||source.fallLength>RUNOFF_LIMITS.maxFallLength||source.strength<0||source.strength>1)throw Error('Invalid physical runoff source');
    const u0=Math.max(wall.start,source.u0),u1=Math.min(wall.end,source.u1),fallLength=Math.min(source.fallLength,source.y-wall.bottom);
    if(u1<=u0||fallLength<=o.entryFade||source.y<wall.bottom||source.y>wall.bottom+wall.height+.36)return;
    sources.push(Object.freeze({...source,u0,u1,fallLength,originMetres:Object.freeze([...source.sourcePositionMetres]),receiverProjectionMetres:Object.freeze(receiverPoint(wall,(u0+u1)/2,source.y))}));
  };
  for(const opening of wall.openings||[]){
    if(opening.kind!=='window')continue;
    const sill=recipe.wood?.find(object=>object.id===opening.id+'-sill');
    if(!sill){excluded.push({id:opening.id,reason:'No actual sill solid in recipe'});continue;}
    const sourcePositionMetres=[...sill.position],normal=normalFor(wall);sourcePositionMetres[1]-=sill.size[1]/2;
    sourcePositionMetres[wall.alongX?2:0]+=normal[wall.alongX?2:0]*sill.size[2]/2;
    add({id:sill.id,kind:'window-sill',u0:opening.center-sill.size[0]/2,u1:opening.center+sill.size[0]/2,y:sourcePositionMetres[1],fallLength:o.windowFall,strength:.8,evidenceIds:[sill.id],sourcePositionMetres});
  }
  const outward=wall.side==='front'||wall.side==='right'?1:-1,top=wall.bottom+wall.height;
  const slabs=[];
  for(const slab of recipe.floors||[]){
    const y=slab.y-slab.thickness;if(y<top-.02||y>top+.36)continue;
    const along0=wall.alongX?slab.x0:slab.z0,along1=wall.alongX?slab.x1:slab.z1;
    const normal0=wall.alongX?slab.z0:slab.x0,normal1=wall.alongX?slab.z1:slab.x1;
    const outer=outward>0?normal1:normal0,edgeOffset=(outer-wall.fixed)*outward;
    // An actual nearby slab edge, with the slab extending inward from the wall.
    if(edgeOffset<-.08||edgeOffset>.35||wall.fixed<normal0-.08||wall.fixed>normal1+.08)continue;
    const u0=Math.max(wall.start,along0),u1=Math.min(wall.end,along1);if(u1-u0<.08)continue;
    // A storey slab hidden beneath another wall is not an exposed rain collector.
    // Subtract covered intervals rather than inventing a source at every wall top.
    let exposed=[[u0,u1]];
    for(const above of recipe.walls.filter(q=>q.alongX===wall.alongX&&Math.abs(q.fixed-outer)<.09&&Math.abs(q.bottom-slab.y)<.06)){
      exposed=exposed.flatMap(([a,b])=>above.end<=a||above.start>=b?[[a,b]]:[[a,Math.max(a,above.start)],[Math.min(b,above.end),b]].filter(([c,d])=>d-c>.08));
    }
    if(!exposed.length)excluded.push({id:slab.id,reason:'Slab edge is covered by an actual upper wall; no exposed collector assumed'});
    for(const [a,b]of exposed)slabs.push({id:slab.id,kind:'slab-edge',u0:a,u1:b,y,fallLength:o.eaveFall,strength:.7,evidenceIds:[slab.id],sourcePositionMetres:wall.alongX?[(a+b)/2,y,outer]:[outer,y,(a+b)/2]});
  }
  slabs.sort((a,b)=>a.y-b.y||a.u0-b.u0);
  const merged=[];
  for(const slab of slabs){const previous=merged.at(-1);if(previous&&Math.abs(previous.y-slab.y)<.005&&slab.u0<=previous.u1+.001){previous.u1=Math.max(previous.u1,slab.u1);previous.evidenceIds.push(...slab.evidenceIds);previous.id=previous.evidenceIds.join('+');}else merged.push({...slab,evidenceIds:[...slab.evidenceIds]});}
  merged.forEach(add);
  for(const outlet of recipe.runoffOutlets||[]){
    if(outlet.wallId!==wall.id)continue;
    const object=recipe.metal?.find(x=>x.id===outlet.objectId);
    if(!object||!Array.isArray(outlet.position)||outlet.position.length!==3||!outlet.position.every(Number.isFinite))throw Error('Explicit runoff outlet needs a real recipe object and metre position');
    if(object.kind!=='pipe'||![object.points[0],object.points.at(-1)].some(endpoint=>Math.hypot(...endpoint.map((v,i)=>v-outlet.position[i]))<.01))throw Error('Declared discharge position must coincide with an actual pipe endpoint');
    const normalOffset=(outlet.position[wall.alongX?2:0]-wall.fixed)*(wall.side==='front'||wall.side==='right'?1:-1);
    if(normalOffset<0||normalOffset>.35)throw Error('Declared outlet is not adjacent to the wall exterior');
    const u=outlet.position[wall.alongX?0:2];
    add({id:outlet.id,kind:'declared-outlet',u0:u-.035,u1:u+.035,y:outlet.position[1],fallLength:outlet.fallLength??o.outletFall,strength:.95,evidenceIds:[object.id],sourcePositionMetres:[...outlet.position]});
  }
  if(sources.length>RUNOFF_LIMITS.maxSourcesPerWall)throw Error('Wall runoff exceeds explicit eight-source bound: '+wall.id);
  return {sources,excluded,options:o};
}

export function makeWallRunoffPlan(recipe,wall,parentDomain,options={}){
  const domain=makeWallRunoffDomain(wall,parentDomain),derived=deriveWallRunoffSources(recipe,wall,options),h=domain.horizontalAxis;
  const packed=derived.sources.map(s=>({
    segment:[s.u0-domain.parentOriginMetres[h],s.u1-domain.parentOriginMetres[h],s.y-domain.parentOriginMetres[1],s.fallLength],
    shape:[s.strength,derived.options.widthFade,derived.options.lateralSpreadPerMetre,0],
  }));
  const groundContact=wall.bottom>=-.02&&wall.bottom<=.10,exteriorLocalFace=({front:1,back:-1,left:1,right:-1})[wall.side];
  return {id:domain.id,wallId:wall.id,domain,groundContact,exteriorLocalFace,sources:derived.sources,excluded:derived.excluded,options:derived.options,packed,proof:{
    source:V26_SOURCE_LOCK,sourceFunctions:V26_WATER_WEATHER_FUNCTION_PROVENANCE,
    motherFunctionChanged:false,originalCompleteAlgorithmUnchanged:false,adaptation:'Real-wall metric V26 domain multiplied by explicit source-attached gravity envelope; no new stochastic kernel',
    sourcePolicy:'Actual window sill undersides and nearby actual slab edges only; discharge outlets require explicit recipe identification; no inferred pipe leakage',
    isotropicFieldMetresPerUnit:domain.fieldScaleMetres,normalizationHeightMetres:domain.fullDimensionsMetres[1],
    maxFallLength:Math.max(0,...derived.sources.map(s=>s.fallLength)),sourceCount:derived.sources.length,
    groundContact,upperStoreyGroundDamp:false,exteriorLocalFace,
    fluidSimulation:false,directDrivingRain:false,capillaryRiseCalibrated:false,originalWholeBuildingFieldPreserved:false,visualAcceptance:false,
  }};
}

export function adaptSurfacePlanRunoff(recipe,surfacePlan,options={}){
  const domains=[],walls=[],plans=[];
  for(const spec of surfacePlan.walls){const wall=recipe.walls.find(w=>w.id===spec.wallId),parent=surfacePlan.domains.find(d=>d.id===spec.weatherDomain);if(!wall||!parent)throw Error('Runoff wall/domain reference does not resolve');
    const runoff=makeWallRunoffPlan(recipe,wall,parent,options);plans.push(runoff);domains.push(runoff.domain);walls.push({...spec,weatherDomain:runoff.domain.id,runoff});
  }
  const totalCacheNodes=domains.reduce((n,d)=>n+makeGridLayout(d).nodeCount,0);
  if(totalCacheNodes>RUNOFF_LIMITS.maxTotalCacheNodes)throw Error('Runoff caches exceed explicit whole-recipe node budget');
  const output={...surfacePlan,schema:surfacePlan.schema+'+source-runoff/1',domains,walls,runoffProof:{wallDomains:domains.length,sourceCount:plans.reduce((n,p)=>n+p.sources.length,0),logicalCacheNodes:totalCacheNodes,unsharedLowStateBytes:totalCacheNodes*4,maxSourcesPerWall:Math.max(...plans.map(p=>p.sources.length)),maxPhysicalFall:Math.max(...plans.map(p=>p.proof.maxFallLength)),kernelChanged:false,visualAcceptance:false},limits:{...surfacePlan.limits,windowRunoffSources:true,sourceAttachedSlabEdges:true,directDrivingRain:false,capillaryRiseCalibrated:false,fluidSimulation:false,heightConvention:'V26 uses each real <=4m wall domain; finite source-attached rain, with the original lowerDamp contribution allowed only at actual ground contact'}};
  const templates=planRunoffCacheTemplates(output);output.runoffProof.cacheTemplates=templates.metrics;return output;
}

export function planRunoffCacheTemplates(surfacePlan){
  const groups=new Map();
  for(const spec of surfacePlan.walls){const p=spec.runoff;if(!p)throw Error('Source runoff surface plan required');const d=p.domain,active=p.sources.length>0||p.groundContact;
    const key=JSON.stringify([active?'v26':'zero',d.fullDimensionsMetres,d.horizontalAxis,...(active?[d.fieldScaleMetres,d.waterSeed,d.weatherSeed]:[])]);
    if(!groups.has(key))groups.set(key,{key,active,domain:d,plans:[],nodeCount:makeGridLayout(d).nodeCount});groups.get(key).plans.push(p);
  }
  const entries=[...groups.values()],nodes=entries.reduce((n,g)=>n+g.nodeCount,0);
  return {entries,metrics:{logicalWallDomains:surfacePlan.walls.length,uniqueTemplates:entries.length,gpuBakes:entries.filter(g=>g.active).length,zeroTemplates:entries.filter(g=>!g.active).length,uniqueCacheNodes:nodes,gpuSampleNodes:entries.filter(g=>g.active).reduce((n,g)=>n+g.nodeCount,0),sharedRetainedLowStateBytes:nodes*4}};
}

/** Exact low-state template sharing: origin/id do not enter the V26 sampler.
 * Equal dimensions, gravity axis, metric scale and source seeds share arrays.
 * Inactive non-ground walls have analytic zero exposure, so they need no bake.
 */
export function createRunoffWeatherCacheSet({sampler,surfacePlan}){
  const {entries,metrics}=planRunoffCacheTemplates(surfacePlan),caches=new Map();const start=performance.now();
  for(const group of entries){let template;
    if(group.active)template=createWeatherStateCache({sampler,domain:group.domain});
    else {const layout=makeGridLayout(group.domain);template=cacheFromNumericSamples(layout,new Float32Array(layout.nodeCount*2),{analyticZeroExposure:true,totalBuildMs:0});}
    for(const plan of group.plans){const domain=plan.domain;
      caches.set(domain.id,{...template,domain,metrics:{...template.metrics,sharedRunoffTemplateKey:group.key,sharedTemplateUsers:group.plans.length,analyticZeroExposure:!group.active},sampleWorld(point){return template.sampleParent(toParentMetres(domain,point));}});
    }
  }
  return {caches,metrics:{...metrics,totalBuildMs:performance.now()-start}};
}

export function runoffEnvelopeAtReceiver(plan,receiverMetres){
  const p=toParentMetres(plan.domain,receiverMetres),h=plan.domain.horizontalAxis,o=plan.options,n=plan.domain.parentNormal;
  const outward=smooth(o.exteriorDepthStart,o.exteriorDepthFull,p.reduce((s,v,i)=>s+v*n[i],0));
  if(!outward)return 0;let total=0;
  for(const {segment:s,shape}of plan.packed){const drop=s[2]-p[1];if(drop<=0||drop>=s[3])continue;
    const distance=Math.max(s[0]-p[h],p[h]-s[1],0),spread=shape[1]+shape[2]*drop;
    const horizontal=1-smooth(0,spread,distance),entry=smooth(0,o.entryFade,drop),tail=1-smooth(o.tailStart*s[3],s[3],drop),decay=Math.exp(-drop/(o.decayLengthFraction*s[3]));
    const value=clamp(shape[0]*horizontal*entry*tail*decay,0,1);total=1-(1-total)*(1-value);
  }
  return outward*total;
}

export function runoffGroundFactorAtReceiver(plan,receiverMetres){
  if(!plan.groundContact)return 0;const p=toParentMetres(plan.domain,receiverMetres),o=plan.options,n=plan.domain.parentNormal;
  const outside=smooth(o.exteriorDepthStart,o.exteriorDepthFull,p.reduce((s,v,i)=>s+v*n[i],0)),yNorm=clamp(p[1]/plan.domain.fullDimensionsMetres[1]+.5,0,1);
  return outside*(1-smooth(.06,.34,yNorm))*.58;
}
export function combineRunoffMask(plan,point,rainRaw,groundLow){
  if(![rainRaw,groundLow].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw Error('Bounded original V26 scalar values required');
  return clamp(runoffEnvelopeAtReceiver(plan,point)*rainRaw+runoffGroundFactorAtReceiver(plan,point)*groundLow,0,1);
}

export function runoffReceiverGLSL(){return `
uniform int nativeRunoffCount;uniform float nativeRunoffEnabled;uniform float nativeRunoffGroundDamp;
uniform vec4 nativeRunoffSegments[8];uniform vec4 nativeRunoffShapes[8];
uniform vec4 nativeRunoffVertical;uniform vec2 nativeRunoffExteriorDepth;
float nativeRunoffEnvelopeAtReceiver(vec3 receiverMetres){
 if(nativeRunoffEnabled<.5)return 1.;
 vec3 p=w26ReceiverToParent*(receiverMetres-w26ParentOriginMetres);
 float outside=smoothstep(nativeRunoffExteriorDepth.x,nativeRunoffExteriorDepth.y,dot(p,w26ParentNormal));
 if(outside<=0.)return 0.;
 float horizontal=abs(w26ParentNormal.x)>abs(w26ParentNormal.z)?p.z:p.x,total=0.;
 for(int i=0;i<8;i++){if(i>=nativeRunoffCount)break;vec4 s=nativeRunoffSegments[i],shape=nativeRunoffShapes[i];float drop=s.z-p.y;if(drop<=0.||drop>=s.w)continue;
  float distance=max(max(s.x-horizontal,horizontal-s.y),0.);
  float crossGate=1.-smoothstep(0.,shape.y+shape.z*drop,distance);
  float entry=smoothstep(0.,nativeRunoffVertical.x,drop),tail=1.-smoothstep(nativeRunoffVertical.y*s.w,s.w,drop),decay=exp(-drop/(nativeRunoffVertical.z*s.w));
  float value=clamp(shape.x*crossGate*entry*tail*decay,0.,1.);total=1.-(1.-total)*(1.-value);
 }
 return outside*total;
}
`;}
const RECEIVER_RETURN='return waterMaskFromCached(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,cachedLow);';
const once=(s,a,b)=>{if(s.split(a).length!==2)throw Error('Runoff receiver signature changed: '+a);return s.replace(a,b);};
export function patchRunoffReceiverFragment(fragment){
  if(fragment.includes('nativeRunoffEnvelopeAtReceiver'))throw Error('Runoff receiver is already patched');
  const withHelper=once(fragment,'float w26WaterAtReceiverWithLow(',runoffReceiverGLSL()+'\nfloat w26WaterAtReceiverWithLow(');
  return once(withHelper,RECEIVER_RETURN,`if(nativeRunoffEnabled<.5){${RECEIVER_RETURN}}
 float exposure=nativeRunoffEnvelopeAtReceiver(receiverMetres),rain=0.;
 if(exposure>0.)rain=waterMaskFromCached(parent/w26FieldScaleMetres,w26ParentNormal,parent,w26FullDimensionsMetres,w26WaterSeed,vec2(cachedLow.x,0.));
 float outside=smoothstep(nativeRunoffExteriorDepth.x,nativeRunoffExteriorDepth.y,dot(parent,w26ParentNormal));
 float yNorm=clamp(parent.y/max(w26FullDimensionsMetres.y,0.001)+0.5,0.0,1.0);
 float ground=nativeRunoffGroundDamp*outside*(1.0-smoothstep(0.06,0.34,yNorm))*cachedLow.y*0.58;
 return clamp(exposure*rain+ground,0.,1.);`);
}
export function bindRunoffReceiver({THREE,material,plan}){
  if(!material?.uniforms?.w26FullDimensionsMetres||!plan?.domain)throw Error('Bind original V26 receiver before bounded runoff');
  const existing=material.userData.nativeRunoffBinding;if(existing){if(existing.id!==plan.id)throw Error('Runoff material cannot span different wall domains');return existing.handle;}
  const uniformDomain=material.uniforms.w26FullDimensionsMetres.value.toArray();
  if(uniformDomain.some((v,i)=>Math.abs(v-plan.domain.fullDimensionsMetres[i])>1e-7))throw Error('Runoff needs the matching local V26 cache; do not reuse the old whole-building cache');
  const oldFragment=material.fragmentShader,keys=['nativeRunoffCount','nativeRunoffEnabled','nativeRunoffSegments','nativeRunoffShapes','nativeRunoffVertical','nativeRunoffExteriorDepth','nativeRunoffGroundDamp'];
  if(keys.some(k=>Object.hasOwn(material.uniforms,k)))throw Error('Runoff uniform collision');
  const segments=Array.from({length:8},(_,i)=>new THREE.Vector4(...(plan.packed[i]?.segment||[0,0,0,1]))),shapes=Array.from({length:8},(_,i)=>new THREE.Vector4(...(plan.packed[i]?.shape||[0,.08,0,0]))),o=plan.options;
  const coatFaces=material.userData.plasterProof?.faces,interior=!!coatFaces&&coatFaces.every(face=>face!==plan.exteriorLocalFace);
  material.fragmentShader=patchRunoffReceiverFragment(oldFragment);
  Object.assign(material.uniforms,{nativeRunoffCount:{value:interior?0:plan.sources.length},nativeRunoffGroundDamp:{value:!interior&&plan.groundContact?1:0},nativeRunoffEnabled:{value:1},nativeRunoffSegments:{value:segments},nativeRunoffShapes:{value:shapes},nativeRunoffVertical:{value:new THREE.Vector4(o.entryFade,o.tailStart,o.decayLengthFraction,0)},nativeRunoffExteriorDepth:{value:new THREE.Vector2(o.exteriorDepthStart,o.exteriorDepthFull)}});material.needsUpdate=true;
  let disposed=false;const handle={proof:{...plan.proof,explicitInteriorCoatDisabled:interior},setEnabled(enabled){material.uniforms.nativeRunoffEnabled.value=enabled?1:0;material.uniformsNeedUpdate=true;},dispose(){if(disposed)return;disposed=true;material.fragmentShader=oldFragment;for(const key of keys)delete material.uniforms[key];delete material.userData.nativeRunoffBinding;material.needsUpdate=true;}};
  material.userData.nativeRunoffBinding={id:plan.id,handle};return handle;
}
