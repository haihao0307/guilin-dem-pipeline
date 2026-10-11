/**
 * Room-local, metre-scaled procedural ageing. No maps, imports, overlay meshes or clock ageing.
 * Bake component geometry into one ROOM frame before using these materials. Translating or
 * rotating the finished room does not change its surface. Do not instance transformed parts
 * unless their instance transform has already been baked into that same room-local frame.
 */
/*
 * The smooth maximum kernel below is adapted from the MIT geometry section of
 * source-audit/volcanic-studio.frag, smax (lines 52–56), not its separate studio material.
 * Copyright © 2019 Inigo Quilez
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
 * to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY
 * OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
 * SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF
 * OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export const ROOM_WEATHERING_REVISION = 'room-causal-weathering-r01';
export const ROOM_MATERIAL_KINDS = Object.freeze(['plaster','concrete','ceramic','iron','zinc','wood','cloth','glass']);
export const ROOM_FIELD_LIMITS = Object.freeze({sills:6,drips:8,rainShadows:4,repairs:6,maxMaterials:48});
export const ROOM_FIELD_SCALES = Object.freeze({macro:.61,meso:3.7,chip:17.3,micro:117,minimumPlaster:.003,maximumPlaster:.016});
const sat = x => Math.max(0,Math.min(1,x));
const mix = (a,b,t) => a+(b-a)*t;
const smooth = (a,b,x) => {const t=sat((x-a)/(b-a));return t*t*(3-2*t);};
const fract = x => x-Math.floor(x);
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const requireFinite = (v,name) => {if(!Number.isFinite(v))throw new TypeError(`${name} must be finite`);return v;};
const bounded = (v,fallback,min=0,max=1) => Math.max(min,Math.min(max,requireFinite(v??fallback,'Room field parameter')));
function vec3(value,fallback=[0,0,0]) {
  const v=value??fallback, out=[v.x??v[0],v.y??v[1],v.z??v[2]];
  if(!out.every(Number.isFinite))throw new TypeError('Room field vectors must contain three finite components');return out;
}
function normal3(value) {const n=vec3(value,[0,0,1]),l=Math.hypot(...n);if(l<1e-8)throw new TypeError('Room field normal must be nonzero');return n.map(v=>v/l);}
function seedNumber(value) {let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return ((h>>>0)%65521)/251;}
// Integer avalanche is identical in JS/GLSL uint arithmetic; unlike a floating hash,
// it does not drift between CPU-generated relief and the GPU's ageing boundaries.
function hash(p) {
  let h=(Math.imul(Math.floor(p[0])>>>0,1597334677)^Math.imul(Math.floor(p[1])>>>0,3812015801)^Math.imul(Math.floor(p[2])>>>0,2798796415))>>>0;
  h=Math.imul(h^(h>>>16),2246822519)>>>0;h=Math.imul(h^(h>>>13),3266489917)>>>0;h=(h^(h>>>16))>>>0;
  return (h&0x00ffffff)/16777216;
}
function noise(p) {
  const i=p.map(Math.floor),f=p.map(x=>{const t=fract(x);return t*t*(3-2*t);});
  const h=(x,y,z)=>hash([i[0]+x,i[1]+y,i[2]+z]);
  return mix(mix(mix(h(0,0,0),h(1,0,0),f[0]),mix(h(0,1,0),h(1,1,0),f[0]),f[1]),mix(mix(h(0,0,1),h(1,0,1),f[0]),mix(h(0,1,1),h(1,1,1),f[0]),f[1]),f[2]);
}
// Same polynomial smax as the audited MIT stone geometry. Candidates here are
// three bounded erosion depths in metres, not a seven-octave sphere-grid SDF.
export function roomSmoothCarveMax(a,b,k) {const h=Math.max(k-Math.abs(a-b),0);return Math.max(a,b)+h*h*.25/k;}
function freezeRecipe(r) {for(const list of ['sills','drips','rainShadows','repairs']) {for(const e of r[list]){Object.freeze(e.position);Object.freeze(e.normal);Object.freeze(e);}Object.freeze(r[list]);}return Object.freeze(r);}
/** Emitter positions and normals are shared with the actual sill/pipe/anchor/eave geometry. */
export function createRoomSurfaceRecipe(input={}) {
  if(input.revision===ROOM_WEATHERING_REVISION)return input;
  const recipe={revision:ROOM_WEATHERING_REVISION,coordinateSpace:'baked-room-local-metres',seed:input.seed??'old-room-1978',seedValue:seedNumber(input.seed??'old-room-1978'),
    ageYears:bounded(input.ageYears,48,0,200),wetness:bounded(input.wetness,.35),rainExposure:bounded(input.rainExposure,.7),saltExposure:bounded(input.saltExposure,.48),
    wallThickness:bounded(input.wallThickness,.18,.035,1),groundY:requireFinite(input.groundY??0,'groundY'),groundContact:input.groundContact===false?0:1,damageStrength:bounded(input.damageStrength,1,0,1.8),
    dampStrength:bounded(input.dampStrength,1,0,1.8),reliefStrength:bounded(input.reliefStrength,1,0,2)};
  for(const kind of ['sills','drips','rainShadows','repairs']) {
    const entries=input[kind]??[];
    if(!Array.isArray(entries)||entries.length>ROOM_FIELD_LIMITS[kind])throw new RangeError(`${kind} must contain at most ${ROOM_FIELD_LIMITS[kind]} emitters`);
    recipe[kind]=entries.map(e=>({position:vec3(e.position),normal:normal3(e.normal),strength:bounded(e.strength,1,0,1.5),
      ...(kind==='drips'?{radius:bounded(e.radius,.038,.006,.35),length:bounded(e.length,1.8,.05,8),rust:bounded(e.rust,.55)}:
      kind==='repairs'?{width:bounded(e.width,.42,.03,4),height:bounded(e.height,.58,.03,4)}:
      {width:bounded(e.width,1,.03,12),length:bounded(e.length,kind==='sills'?1.55:.65,.03,8)})}));
  }
  return freezeRecipe(recipe);
}
function emitterFrame(p,n,e) {
  const d=p.map((v,i)=>v-e.position[i]),en=e.normal,l=Math.hypot(en[0],en[2]),t=l>1e-7?[en[2]/l,0,-en[0]/l]:[1,0,0];
  const plane=dot(d,en),facing=Math.max(0,dot(n,en));
  return {along:dot(d,t),below:-d[1],gate:Math.exp(-plane*plane/.0256)*facing*facing};
}
/**
 * Shared deterministic geometry/material field. No time input: old room is old on frame zero.
 * Geometry may sample plasterThickness (3–16 mm) / height to bound wall relief and chips.
 * Fine relief is shader-only and derivative-filtered. Fields below match rwField in GLSL.
 */
export function evaluateRoomSurfaceField(position,normal,input={}) {
  const r=createRoomSurfaceRecipe(input),p=vec3(position),n=normal3(normal),s=r.seedValue;
  const q=p.map((v,i)=>v+s*[1,.71,.37][i]);
  const macro=noise(q.map(v=>v*.61)),meso=noise(q.map(v=>v*3.7)),chip=noise(q.map(v=>v*17.3));
  const age=sat(r.ageYears/58),y=Math.max(0,p[1]-r.groundY);
  const tideHeight=.17+macro*.54+meso*.09;
  const rising=(1-smooth(tideHeight-.11,tideHeight+.09,y))*r.groundContact;
  const tideBand=Math.exp(-Math.pow((y-tideHeight)/.052,2))*r.groundContact;
  let runoff=0,rust=0,shadow=0,repair=0;
  for(const e of r.rainShadows) {
    const f=emitterFrame(p,n,e);
    shadow=Math.max(shadow,(1-smooth(e.width*.43,e.width*.53,Math.abs(f.along)))*smooth(-.04,.04,f.below)*(1-smooth(e.length*.75,e.length,f.below))*f.gate*e.strength);
  }
  for(const e of r.sills) {
    const f=emitterFrame(p,n,e),edgeDistance=Math.abs(Math.abs(f.along)-e.width*.5);
    const edge=Math.exp(-Math.pow(edgeDistance/.065,2)),lane=Math.floor((f.along+e.width*.5)/.065);
    const laneHash=hash([lane,s,e.position[0]+e.position[2]*3.1]);
    const laneCenter=(lane+.18+laneHash*.6)*.065-e.width*.5;
    const finger=Math.exp(-Math.pow((f.along-laneCenter)/(.008+laneHash*.011),2))*(.22+laneHash*.4);
    const span=1-smooth(e.width*.47,e.width*.54,Math.abs(f.along));
    const tail=smooth(0,.035,f.below)*(1-smooth(e.length*.62,e.length,f.below))*Math.exp(-Math.max(0,f.below)/e.length*1.15);
    runoff+=Math.max(edge*.94,finger*span)*tail*f.gate*e.strength;
  }
  for(const e of r.drips) {
    const f=emitterFrame(p,n,e),width=e.radius*(1+.85*sat(f.below/e.length));
    const line=Math.exp(-Math.pow(f.along/width,2))*smooth(-.018,.025,f.below)*(1-smooth(e.length*.55,e.length,f.below));
    const tail=line*f.gate*e.strength*(.67+meso*.33);
    runoff+=tail*.85;rust+=tail*e.rust*(.7+r.saltExposure*.3);
  }
  for(const e of r.repairs) {
    const f=emitterFrame(p,n,e),edge=Math.max(Math.abs(f.along)/(e.width*.5),Math.abs(f.below)/(e.height*.5));
    const irregular=edge+(meso-.5)*.23+(chip-.5)*.13;
    repair=Math.max(repair,(1-smooth(.77,1.055,irregular))*f.gate*e.strength);
  }
  shadow=sat(shadow);repair=sat(repair);runoff=sat(runoff*r.rainExposure*(1-shadow*.9));rust=sat(rust*age*(1-repair*.93));
  const damp=sat((rising*(.61+meso*.2)+tideBand*.27+runoff*.93)*r.dampStrength*(.52+age*.48)*(1-repair*.8));
  const maximumErosion=Math.min(.011,r.wallThickness*.075);
  const largeCarve=roomSmoothCarveMax(0,(macro-.49)*.009+damp*.0015,.0016);
  const middleCarve=roomSmoothCarveMax(largeCarve,(meso-.49)*.025+damp*.002,.0015);
  const rawCarve=roomSmoothCarveMax(middleCarve,(chip-.54)*.012,.00065);
  const erosionDepth=Math.min(maximumErosion,Math.max(0,rawCarve)*age*r.damageStrength*(1-repair*.95));
  const damage=sat(erosionDepth/.009);
  const substrateExposure=smooth(.34,.79,damage);
  const plasterThickness=Math.max(.003,Math.min(.016,.014-erosionDepth+(.5-macro)*.002*(1-repair)+repair*.001));
  const dust=sat((.12+macro*.2)*(1-Math.min(1,damp)*.8)+Math.max(0,n[1])*.31);
  const height=Math.max(-.012,Math.min(.012,(plasterThickness-.01)*r.reliefStrength));
  const roughnessDelta=.05*meso+.12*damage+.04*dust-.07*repair;
  return {macro,meso,chip,age,rising,tideBand,shadow,runoff,rust,repair,damp,damage,substrateExposure,erosionDepth,plasterThickness,dust,height,roughnessDelta};
}

const GLSL_FIELD = `
#define RW_MAX_SILLS 6
#define RW_MAX_DRIPS 8
#define RW_MAX_SHADOWS 4
#define RW_MAX_REPAIRS 6
varying vec3 vRoomPosition;
varying vec3 vRoomNormal;
uniform float rwSeed,rwAge,rwWetness,rwRain,rwSalt,rwGroundY,rwGroundContact,rwDamageStrength,rwDampStrength,rwReliefStrength,rwWallThickness;
uniform vec3 rwGrainAxis;
uniform vec4 rwClothBounds;
uniform float rwClothBounded;
uniform int rwSillCount,rwDripCount,rwShadowCount,rwRepairCount;
uniform vec4 rwSillA[RW_MAX_SILLS],rwSillB[RW_MAX_SILLS],rwSillC[RW_MAX_SILLS];
uniform vec4 rwDripA[RW_MAX_DRIPS],rwDripB[RW_MAX_DRIPS],rwDripC[RW_MAX_DRIPS];
uniform vec4 rwShadowA[RW_MAX_SHADOWS],rwShadowB[RW_MAX_SHADOWS],rwShadowC[RW_MAX_SHADOWS];
uniform vec4 rwRepairA[RW_MAX_REPAIRS],rwRepairB[RW_MAX_REPAIRS],rwRepairC[RW_MAX_REPAIRS];
float rwHash(vec3 p){
  uvec3 q=uvec3(ivec3(floor(p)));uint h=(q.x*1597334677u)^(q.y*3812015801u)^(q.z*2798796415u);
  h=(h^(h>>16u))*2246822519u;h=(h^(h>>13u))*3266489917u;h=h^(h>>16u);
  return float(h&0x00ffffffu)/16777216.0;
}
float rwNoise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(mix(rwHash(i),rwHash(i+vec3(1,0,0)),f.x),mix(rwHash(i+vec3(0,1,0)),rwHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(rwHash(i+vec3(0,0,1)),rwHash(i+vec3(1,0,1)),f.x),mix(rwHash(i+vec3(0,1,1)),rwHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float rwSquare(float x){return x*x;}
float rwSmoothCarveMax(float a,float b,float k){float h=max(k-abs(a-b),0.0);return max(a,b)+h*h*.25/k;}
vec3 rwEmitter(vec3 p,vec3 n,vec4 a,vec4 b){
  vec3 d=p-a.xyz;float l=length(b.xz);vec3 t=l>.0000001?vec3(b.z/l,0,-b.x/l):vec3(1,0,0);
  float plane=dot(d,b.xyz),facing=max(0.0,dot(n,b.xyz));
  return vec3(dot(d,t),-d.y,exp(-plane*plane/.0256)*facing*facing);
}
struct RoomField{float macro;float meso;float chip;float rising;float tideBand;float shadow;float runoff;float rust;float repair;float damp;float damage;float substrateExposure;float erosionDepth;float plasterThickness;float dust;float height;float roughnessDelta;};
RoomField rwField(vec3 p,vec3 n){
  RoomField f;vec3 q=p+vec3(rwSeed,rwSeed*.71,rwSeed*.37);
  f.macro=rwNoise(q*.61);f.meso=rwNoise(q*3.7);f.chip=rwNoise(q*17.3);
  float y=max(0.0,p.y-rwGroundY),tideHeight=.17+f.macro*.54+f.meso*.09;
  f.rising=(1.0-smoothstep(tideHeight-.11,tideHeight+.09,y))*rwGroundContact;
  f.tideBand=exp(-rwSquare((y-tideHeight)/.052))*rwGroundContact;
  f.runoff=0.0;f.rust=0.0;f.shadow=0.0;f.repair=0.0;
  for(int i=0;i<RW_MAX_SHADOWS;i++){if(i>=rwShadowCount)break;vec4 a=rwShadowA[i],b=rwShadowB[i],c=rwShadowC[i];vec3 e=rwEmitter(p,n,a,b);
    f.shadow=max(f.shadow,(1.0-smoothstep(a.w*.43,a.w*.53,abs(e.x)))*smoothstep(-.04,.04,e.y)*(1.0-smoothstep(c.x*.75,c.x,e.y))*e.z*b.w);}
  for(int i=0;i<RW_MAX_SILLS;i++){if(i>=rwSillCount)break;vec4 a=rwSillA[i],b=rwSillB[i],c=rwSillC[i];vec3 e=rwEmitter(p,n,a,b);
    float edge=exp(-rwSquare(abs(abs(e.x)-a.w*.5)/.065)),lane=floor((e.x+a.w*.5)/.065),laneHash=rwHash(vec3(lane,rwSeed,a.x+a.z*3.1));
    float laneCenter=(lane+.18+laneHash*.6)*.065-a.w*.5;
    float finger=exp(-rwSquare((e.x-laneCenter)/(.008+laneHash*.011)))*(.22+laneHash*.4),span=1.0-smoothstep(a.w*.47,a.w*.54,abs(e.x));
    float tail=smoothstep(0.0,.035,e.y)*(1.0-smoothstep(c.x*.62,c.x,e.y))*exp(-max(0.0,e.y)/c.x*1.15);
    f.runoff+=max(edge*.94,finger*span)*tail*e.z*b.w;}
  for(int i=0;i<RW_MAX_DRIPS;i++){if(i>=rwDripCount)break;vec4 a=rwDripA[i],b=rwDripB[i],c=rwDripC[i];vec3 e=rwEmitter(p,n,a,b);
    float width=a.w*(1.0+.85*clamp(e.y/c.x,0.0,1.0));
    float line=exp(-rwSquare(e.x/width))*smoothstep(-.018,.025,e.y)*(1.0-smoothstep(c.x*.55,c.x,e.y));
    float tail=line*e.z*b.w*(.67+f.meso*.33);f.runoff+=tail*.85;f.rust+=tail*c.y*(.7+rwSalt*.3);}
  for(int i=0;i<RW_MAX_REPAIRS;i++){if(i>=rwRepairCount)break;vec4 a=rwRepairA[i],b=rwRepairB[i],c=rwRepairC[i];vec3 e=rwEmitter(p,n,a,b);
    float edge=max(abs(e.x)/(a.w*.5),abs(e.y)/(c.x*.5)),irregular=edge+(f.meso-.5)*.23+(f.chip-.5)*.13;
    f.repair=max(f.repair,(1.0-smoothstep(.77,1.055,irregular))*e.z*b.w);}
  f.shadow=clamp(f.shadow,0.0,1.0);f.repair=clamp(f.repair,0.0,1.0);f.runoff=clamp(f.runoff*rwRain*(1.0-f.shadow*.9),0.0,1.0);f.rust=clamp(f.rust*rwAge*(1.0-f.repair*.93),0.0,1.0);
  f.damp=clamp((f.rising*(.61+f.meso*.2)+f.tideBand*.27+f.runoff*.93)*rwDampStrength*(.52+rwAge*.48)*(1.0-f.repair*.8),0.0,1.0);
  float maximumErosion=min(.011,rwWallThickness*.075);
  float largeCarve=rwSmoothCarveMax(0.0,(f.macro-.49)*.009+f.damp*.0015,.0016);
  float middleCarve=rwSmoothCarveMax(largeCarve,(f.meso-.49)*.025+f.damp*.002,.0015);
  float rawCarve=rwSmoothCarveMax(middleCarve,(f.chip-.54)*.012,.00065);
  f.erosionDepth=min(maximumErosion,max(0.0,rawCarve)*rwAge*rwDamageStrength*(1.0-f.repair*.95));
  f.damage=clamp(f.erosionDepth/.009,0.0,1.0);
  f.substrateExposure=smoothstep(.34,.79,f.damage);
  f.plasterThickness=clamp(.014-f.erosionDepth+(.5-f.macro)*.002*(1.0-f.repair)+f.repair*.001,.003,.016);
  f.dust=clamp((.12+f.macro*.2)*(1.0-min(1.0,f.damp)*.8)+max(0.0,n.y)*.31,0.0,1.0);
  f.height=clamp((f.plasterThickness-.01)*rwReliefStrength,-.012,.012);
  f.roughnessDelta=.05*f.meso+.12*f.damage+.04*f.dust-.07*f.repair;
  return f;
}
`;
const GLSL_SURFACE = `
vec3 rwP=vRoomPosition,rwN=normalize(vRoomNormal),rwAbsN=abs(rwN);
vec2 rwUV=rwAbsN.y>max(rwAbsN.x,rwAbsN.z)?rwP.xz:(rwAbsN.x>rwAbsN.z?rwP.zy:rwP.xy);
RoomField rwF=rwField(rwP,rwN);
float rwFootprint=max(length(dFdx(rwP)),length(dFdy(rwP)));
float rwMicroWeight=1.0-smoothstep(.0015,.019,rwFootprint),rwFine=.5;
if(rwFootprint<.019)rwFine=mix(.5,rwNoise((rwP+vec3(rwSeed,rwSeed*.71,rwSeed*.37))*117.0),rwMicroWeight);
float rwHeight=(rwFine-.5)*.00065*rwReliefStrength,rwRoughDelta=rwF.roughnessDelta+(rwFine-.5)*.10,rwMetalLoss=0.0;
float rwWet=rwWetness*clamp(rwF.damp*.91+rwF.runoff*.23+max(0.0,rwN.y)*.16,0.0,1.0);
vec3 rwBase=diffuseColor.rgb;
#if RW_KIND == 0 || RW_KIND == 1
// Multiple generations of fading paint, peeled lime finish and plaster are one 3D field.
float rwFade=smoothstep(.26,.78,rwF.macro)*rwAge*(1.0-rwF.repair);
vec3 rwOldPaint=mix(rwBase,rwBase*vec3(.71,.77,.67)+vec3(.038,.03,.016),rwFade*.7);
vec3 rwSubstrate=mix(vec3(.235,.209,.165),vec3(.39,.365,.30),rwF.meso);
#if RW_KIND == 1
rwSubstrate=vec3(.17,.174,.157)*( .82+rwF.meso*.4 );
#endif
diffuseColor.rgb=mix(rwOldPaint,rwSubstrate,rwF.substrateExposure*.93);
// Damp is strong at its real sources, never a whole-wall random dark wash.
vec3 rwDampColor=vec3(.022,.031,.023)+rwBase*.075;
diffuseColor.rgb=mix(diffuseColor.rgb,rwDampColor,rwF.damp*.83*rwAge);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.066,.025),rwF.rust*.68);
vec3 rwFresh=mix(rwBase,vec3(.64,.61,.51),.21);
diffuseColor.rgb=mix(diffuseColor.rgb,rwFresh,rwF.repair*.89);
// Macro thickness drives geometry; remaining chipped relief is visible under raking light.
rwHeight+=((rwF.meso-.5)*.0008-rwF.damage*.0025+rwF.repair*.0003)*rwReliefStrength;
#elif RW_KIND == 2
// 150 mm kitchen/bath tiles, 3 mm recessed grout; no image-derived grid.
vec2 rwTile=rwUV/.15,rwCell=fract(rwTile);float rwEdge=min(min(rwCell.x,1.0-rwCell.x),min(rwCell.y,1.0-rwCell.y))*.15;
float rwAA=max(.0005,rwFootprint*.42),rwGrout=1.0-smoothstep(.0010-rwAA,.0021+rwAA,rwEdge);
float rwTileID=rwHash(vec3(floor(rwTile),rwSeed));
vec3 rwGlaze=rwBase*(.88+rwTileID*.19);
vec3 rwJoint=mix(vec3(.20,.196,.165),vec3(.018,.026,.019),rwF.damp*.88);
diffuseColor.rgb=mix(rwGlaze*(1.0-rwF.damp*.28),rwJoint,rwGrout);
rwHeight=rwHeight*.16-rwGrout*.0013;rwRoughDelta=rwGrout*.40+rwF.damp*.10;
#elif RW_KIND == 3 || RW_KIND == 4
// Oxidation is anchored to actual fasteners/joints plus damp contact, then broken at mm/cm scale.
float rwOxidation=clamp((rwF.rust*.92+rwF.damp*.48+rwF.damage*.27)*(.40+rwF.meso*.8),0.0,1.0)*rwAge;
vec3 rwOxide=mix(vec3(.075,.022,.009),vec3(.31,.115,.025),rwF.chip);
#if RW_KIND == 4
rwOxidation*=.72;rwOxide=mix(vec3(.17,.185,.155),vec3(.27,.22,.145),rwF.meso);
#endif
diffuseColor.rgb=mix(rwBase*(.81+rwF.macro*.29),rwOxide,rwOxidation);
diffuseColor.rgb*=1.0-rwF.runoff*.17;
rwMetalLoss=rwOxidation*.94;rwRoughDelta+=rwOxidation*.29;rwHeight+=rwOxidation*.0008;
#elif RW_KIND == 5
vec3 rwAcross=vec3(1.0)-rwGrainAxis;float rwAlong=dot(rwP,rwGrainAxis),rwCross=dot(rwP,rwAcross);
float rwGrainFrequency=230.0, rwGrainWeight=1.0-smoothstep(.004,.024,rwFootprint);
float rwGrain=.5+.5*sin(rwCross*rwGrainFrequency+rwF.meso*6.0+sin(rwAlong*2.7))*rwGrainWeight;
float rwVarnishLoss=smoothstep(.40,.77,rwF.meso+rwF.damp*.15)*rwAge*(1.0-rwF.repair);
diffuseColor.rgb*=.77+rwGrain*.28;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.23,.134,.056),rwVarnishLoss*.8);
diffuseColor.rgb*=1.0-rwF.damp*.50;rwHeight+=(rwGrain-.5)*.0006-rwVarnishLoss*.0005;rwRoughDelta+=rwVarnishLoss*.12;
#elif RW_KIND == 6
// The cloth mesh supplies hems/folds; thread and uneven fading stay entirely procedural.
float rwWeaveWeight=1.0-smoothstep(.0007,.008,rwFootprint);
float rwWarp=sin(rwUV.x*1700.0),rwWeft=sin(rwUV.y*1450.0),rwWeave=rwWarp*rwWeft*rwWeaveWeight;
float rwFibreFade=smoothstep(.28,.76,rwF.macro)*rwAge;
vec2 rwHemDistance=min(rwUV-rwClothBounds.xy,rwClothBounds.zw-rwUV);
float rwHem=(1.0-smoothstep(.005,.036+.012*rwF.meso,min(rwHemDistance.x,rwHemDistance.y)))*rwClothBounded;
diffuseColor.rgb=mix(rwBase,rwBase*.67+vec3(.1,.087,.065),rwFibreFade*.42);
diffuseColor.rgb*=.97+rwWeave*.025-rwF.damp*.22;
diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.89+vec3(.028,.021,.012),rwHem*.35);
rwHeight+=rwWeave*.00015;rwRoughDelta=.03+(rwF.meso-.5)*.025;
#elif RW_KIND == 7
diffuseColor.rgb*=.89+rwF.macro*.13-rwF.runoff*.14;
rwHeight=0.0;rwRoughDelta=rwF.runoff*.19+rwF.dust*.12;
#endif
diffuseColor.rgb*=1.0-rwWet*.15;
`;
export const ROOM_SURFACE_SHADER = Object.freeze({
  field:GLSL_FIELD,surface:GLSL_SURFACE,
  vertexDeclarations:'varying vec3 vRoomPosition;\nvarying vec3 vRoomNormal;\n',
  vertexNormal:'vRoomNormal=objectNormal;',vertexPosition:'vRoomPosition=transformed;',
  roughness:'roughnessFactor=clamp(roughnessFactor+rwRoughDelta-rwWet*.24,.19,1.0);',
  metalness:'metalnessFactor*=1.0-rwMetalLoss;',
  normal:`
vec3 rwDx=dFdx(-vViewPosition),rwDy=dFdy(-vViewPosition);
vec3 rwRx=cross(rwDy,normal),rwRy=cross(normal,rwDx);float rwDet=dot(rwDx,rwRx);
vec3 rwGradient=sign(rwDet)*(dFdx(rwHeight)*rwRx+dFdy(rwHeight)*rwRy);
normal=normalize(max(abs(rwDet),1e-10)*normal-rwGradient);
`
});
function insert(source,marker,text){if(!source.includes(marker))throw new Error('Unsupported Three room shader hook: '+marker);return source.replace(marker,marker+'\n'+text);}
const PALETTES={plaster:'#b2b096',concrete:'#777568',ceramic:'#a3b4a8',iron:'#3e504c',zinc:'#737c77',wood:'#75563b',cloth:'#927357',glass:'#a5bab0'};
const ROUGHNESS={plaster:.84,concrete:.91,ceramic:.37,iron:.65,zinc:.60,wood:.79,cloth:.94,glass:.24};
function emitterUniforms(THREE,recipe) {
  const out={};
  for(const [plural,prefix] of [['sills','Sill'],['drips','Drip'],['rainShadows','Shadow'],['repairs','Repair']]) {
    const entries=recipe[plural],a=[],b=[],c=[];
    for(let i=0;i<ROOM_FIELD_LIMITS[plural];i++) {
      const e=entries[i];a.push(new THREE.Vector4(...(e?.position??[0,0,0]),e?.width??e?.radius??1));
      b.push(new THREE.Vector4(...(e?.normal??[0,0,1]),e?.strength??0));
      c.push(new THREE.Vector4(e?.length??e?.height??1,e?.rust??0,0,0));
    }
    out['rw'+prefix+'Count']={value:entries.length};out['rw'+prefix+'A']={value:a};out['rw'+prefix+'B']={value:b};out['rw'+prefix+'C']={value:c};
  }
  return out;
}
/**
 * Optional hostLibrary or createHostMaterialLibrary(THREE, hostScore) reuses host native
 * MeshStandardMaterial defaults. This adapter replaces, rather than stacks, its surface hook.
 * Caller-owned host libraries are never disposed. No absolute imports or texture dependencies.
 */
export function createRoomMaterialLibrary(THREE,options={}) {
  if(!THREE?.MeshStandardMaterial||!THREE?.Vector4)throw new TypeError('THREE MeshStandardMaterial and Vector4 are required');
  const recipe=createRoomSurfaceRecipe(options.recipe??options),ownedHost=!options.hostLibrary&&typeof options.createHostMaterialLibrary==='function';
  const host=options.hostLibrary??(ownedHost?options.createHostMaterialLibrary(THREE,options.hostScore??{}):null);
  if(host&&typeof host.get!=='function')throw new TypeError('hostLibrary must implement get(kind, options)');
  const cache=new Map(),materials=[],emitters=emitterUniforms(THREE,recipe);let wetness=recipe.wetness,worldSeconds=0,disposed=false;
  const maxMaterials=Math.floor(bounded(options.maxMaterials,ROOM_FIELD_LIMITS.maxMaterials,1,ROOM_FIELD_LIMITS.maxMaterials));
  const shared={rwSeed:{value:recipe.seedValue},rwAge:{value:sat(recipe.ageYears/58)},rwWetness:{value:wetness},rwRain:{value:recipe.rainExposure},rwSalt:{value:recipe.saltExposure},
    rwWallThickness:{value:recipe.wallThickness},rwGroundY:{value:recipe.groundY},rwGroundContact:{value:recipe.groundContact},rwDamageStrength:{value:recipe.damageStrength},rwDampStrength:{value:recipe.dampStrength},rwReliefStrength:{value:recipe.reliefStrength},...emitters};
  function get(kind,input={}) {
    if(disposed)throw new Error('Room material library is disposed');
    if(!ROOM_MATERIAL_KINDS.includes(kind))throw new TypeError('Unknown room material kind: '+kind);
    const color=new THREE.Color(input.color??input.tint??PALETTES[kind]);
    const config={color:color.getHexString(),roughness:bounded(input.roughness,ROUGHNESS[kind]),metalness:bounded(input.metalness,kind==='iron'?.52:kind==='zinc'?.64:0),
      opacity:bounded(input.opacity,kind==='glass'?.63:1),side:input.side??(kind==='cloth'?THREE.DoubleSide:THREE.FrontSide),vertexColors:input.vertexColors??true,
      clothBounds:input.clothBounds??null,grainAxis:input.grainAxis??'y',wetness:input.wetness==null?null:bounded(input.wetness,wetness),emissive:input.emissive??0,emissiveIntensity:bounded(input.emissiveIntensity,0,0,20)};
    if(config.clothBounds&&(!Array.isArray(config.clothBounds)||config.clothBounds.length!==4||!config.clothBounds.every(Number.isFinite)||config.clothBounds[2]<=config.clothBounds[0]||config.clothBounds[3]<=config.clothBounds[1]))throw new TypeError('clothBounds must be [minU,minV,maxU,maxV] in room-projected metres');
    if(!['x','y','z'].includes(config.grainAxis))throw new TypeError('grainAxis must be x, y or z');
    const key=kind+JSON.stringify(config);if(cache.has(key))return cache.get(key);
    if(materials.length>=maxMaterials)throw new RangeError('Room material budget exceeded: '+maxMaterials);
    let material;
    if(host) {
      const base=host.get(kind,{...input,seed:recipe.seed,age:sat(recipe.ageYears/58),wetness,repair:0});
      if(!base?.isMeshStandardMaterial||Object.values(base).some(v=>v?.isTexture))throw new Error('Room weathering requires a texture-free host MeshStandardMaterial');
      material=base.clone();
    } else material=new THREE.MeshStandardMaterial();
    material.color.copy(color);material.roughness=config.roughness;material.metalness=config.metalness;material.opacity=config.opacity;material.transparent=config.opacity<1;
    material.depthWrite=config.opacity>=1;material.side=config.side;material.vertexColors=config.vertexColors;material.emissive.set(config.emissive);material.emissiveIntensity=config.emissiveIntensity;
    material.defines={...(material.defines??{})};delete material.defines.ST_FAMILY;
    const uniforms={...shared,rwClothBounds:{value:new THREE.Vector4(...(config.clothBounds??[0,0,1,1]))},rwClothBounded:{value:config.clothBounds?1:0},rwGrainAxis:{value:new THREE.Vector3(config.grainAxis==='x'?1:0,config.grainAxis==='y'?1:0,config.grainAxis==='z'?1:0)}};
    if(config.wetness!=null)uniforms.rwWetness={value:config.wetness};
    const index=ROOM_MATERIAL_KINDS.indexOf(kind);
    material.name='room/'+kind+'/'+materials.length;
    material.userData={room:{revision:ROOM_WEATHERING_REVISION,kind,config,recipe,uniforms,textureFree:true,coordinateSpace:'baked-room-local-metres',hostReused:!!host,ageYears:recipe.ageYears}};
    material.customProgramCacheKey=()=>ROOM_WEATHERING_REVISION+'/'+index;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);shader.vertexShader=ROOM_SURFACE_SHADER.vertexDeclarations+shader.vertexShader;
      shader.vertexShader=insert(shader.vertexShader,'#include <beginnormal_vertex>',ROOM_SURFACE_SHADER.vertexNormal);
      shader.vertexShader=insert(shader.vertexShader,'#include <begin_vertex>',ROOM_SURFACE_SHADER.vertexPosition);
      shader.fragmentShader='#define RW_KIND '+index+'\n'+ROOM_SURFACE_SHADER.field+shader.fragmentShader;
      for(const [marker,part] of [['color_fragment','surface'],['roughnessmap_fragment','roughness'],['metalnessmap_fragment','metalness'],['normal_fragment_maps','normal']])shader.fragmentShader=insert(shader.fragmentShader,'#include <'+marker+'>',ROOM_SURFACE_SHADER[part]);
    };
    cache.set(key,material);materials.push(material);return material;
  }
  const proof={revision:ROOM_WEATHERING_REVISION,textureFree:true,imageTextures:0,importedMeshes:0,overlayMeshes:0,coordinateSpace:'baked-room-local-metres',cpuField:'evaluateRoomSurfaceField',glslField:'rwField',
    firstFrameAgeYears:recipe.ageYears,elapsedChangesAge:false,geometryField:'plasterThickness',carvingKernel:'MIT Inigo Quilez 2019 smax, three depth layers',maximumErosion:Math.min(.011,recipe.wallThickness*.075),maxBaseNoiseEvaluations:3,maxCloseupNoiseEvaluations:4,
    materialBudget:maxMaterials,emitterCounts:Object.fromEntries(['sills','drips','rainShadows','repairs'].map(k=>[k,recipe[k].length])),gpuCompilationVerified:false};
  return {get,materials,recipe,proof,update(seconds,inputs={}) {
    if(disposed)throw new Error('Room material library is disposed');requireFinite(seconds,'worldSeconds');
    if(inputs.wetness!=null){wetness=bounded(inputs.wetness,wetness);shared.rwWetness.value=wetness;}worldSeconds=seconds;
    return {worldSeconds,wetness,ageYears:recipe.ageYears};
  },dispose(){if(disposed)return;for(const material of materials)material.dispose();materials.length=0;cache.clear();if(ownedHost)host.dispose();disposed=true;}};
}
