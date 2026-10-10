// Metre-scaled, texture-free surfaces. Runtime functions only; no baked assets.
export const MATERIAL_REVISION = 'KST1-surfaces-1';
export const FAMILIES = ['plaster','brick','wood','iron','glass','cloth','sign','neon','concrete','paper','ceramic','zinc'];
const ALIASES = {stone:'plaster',rust:'iron',enamel:'iron',lamp:'neon',soot:'concrete'};
const PALETTE = ['#b0aa91','#78503b','#344a40','#454844','#405957','#836c4f','#a63e2e','#ffd9a1','#817e6e','#b7ac87','#a7a793','#828b85'];
const ROUGHNESS = [.91,.92,.78,.72,.24,.94,.65,.32,.93,.95,.43,.62];
const clamp = (v, fallback) => Number.isFinite(v) ? Math.max(0,Math.min(1,v)) : fallback;
function seedOf(value) {
  let h = 2166136261;
  for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0),16777619);
  return (h >>> 0) % 65521 / 251;
}

// Public snippets permit source/binding tests without claiming GPU compilation.
export const SURFACE_SHADER = Object.freeze({
  vertexDeclarations: 'varying vec3 vStreetPosition;\nvarying vec3 vStreetNormal;\n',
  vertexPosition: `
vec4 streetPosition = vec4(transformed, 1.0);
#ifdef USE_BATCHING
streetPosition = batchingMatrix * streetPosition;
#endif
#ifdef USE_INSTANCING
streetPosition = instanceMatrix * streetPosition;
#endif
vStreetPosition = (modelMatrix * streetPosition).xyz;
vStreetNormal = inverseTransformDirection(transformedNormal, viewMatrix);
`,
  fragmentDeclarations: `
varying vec3 vStreetPosition;
varying vec3 vStreetNormal;
uniform float stAge, stRepair, stWetness, stSeed, stTime, stSalt;
uniform vec3 stOrigin, stWorldOffset, stGrid, stGrainAxis;
uniform vec2 stSill;
float stHash(vec3 p) {
  p = fract(p * .1031); p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float stNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(stHash(i),stHash(i+vec3(1,0,0)),f.x),
    mix(stHash(i+vec3(0,1,0)),stHash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(stHash(i+vec3(0,0,1)),stHash(i+vec3(1,0,1)),f.x),
    mix(stHash(i+vec3(0,1,1)),stHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`,
  surface: `
vec3 stP=vStreetPosition-stWorldOffset-stOrigin;
vec3 stN=abs(normalize(vStreetNormal));
// Dominant-face projection retains metre units on returns and horizontal caps.
vec2 stUV=stN.y>max(stN.x,stN.z) ? stP.xz : (stN.x>stN.z ? stP.zy : stP.xy);
vec3 stQ=stP+vec3(stSeed,stSeed*.71,stSeed*.37);
float stLarge=stNoise(stQ*.63);
float stPatch=stNoise(stQ*3.7);
float stFootprint=max(length(dFdx(stP)),length(dFdy(stP)));
// Beyond the microstructure footprint the original mix is exactly .5.
// Avoid evaluating eight hash corners for detail that has zero contribution.
float stFine=.5;
if(stFootprint<.021) stFine=mix(stNoise(stQ*127.0),.5,smoothstep(.003,.021,stFootprint));
float stFresh=smoothstep(1.0-stRepair*.64,1.08-stRepair*.64,stLarge);
// Rising moisture, floor ledges and paired sill edges are separate sources.
float stRising=1.0-smoothstep(.12,.48+stLarge*.95,max(stP.y,0.0));
float stBelowLedge=mod(stGrid.y-stP.y,stGrid.x);
float stBelowSill=mod(stGrid.y+stSill.x-stP.y,stGrid.x);
float stBay=fract((stUV.x+stGrid.z*.5)/stGrid.z);
float stSillEdge=exp(-pow((stBay-stSill.y)*24.0,2.0))+exp(-pow((stBay-1.0+stSill.y)*24.0,2.0));
float stRun=stNoise(vec3(stQ.x*21.0,stQ.y*.65,stQ.z*21.0));
float stStreak=(exp(-stBelowSill*2.4)*stSillEdge+exp(-stBelowLedge*6.0)*.35)
  *smoothstep(.27,.75,stRun)*step(stGrid.y-.8,stP.y);
float stDamp=clamp((stRising*.58+stStreak*.70)*(.35+stLarge*.65),0.0,1.0);
float stWet=stWetness*clamp(stDamp+smoothstep(.60,.81,stLarge)*.38+stN.y*.22,0.0,1.0);
float stHeight=(stFine-.5)*.00042;
float stRoughDelta=(stFine-.5)*.07;
float stMetalLoss=0.0;
vec3 stBase=diffuseColor.rgb;
#if ST_FAMILY == 0 || ST_FAMILY == 8
float stGrayPatch=smoothstep(.42,.78,stLarge)*stAge*.26;
diffuseColor.rgb=mix(stBase,stBase*.69+vec3(.027,.030,.025),stGrayPatch);
float stChip=smoothstep(.64,.81,stNoise(stQ*23.0))*smoothstep(.46,.76,stPatch)*stAge;
diffuseColor.rgb=mix(diffuseColor.rgb,stBase*vec3(.59,.56,.49),stChip*.42);
diffuseColor.rgb=mix(diffuseColor.rgb,stBase*vec3(.50,.56,.50),stDamp*stAge*.58);
diffuseColor.rgb=mix(diffuseColor.rgb,mix(stBase,vec3(.80,.78,.69),.17),stFresh*.85);
stHeight-=stChip*.0007;
#elif ST_FAMILY == 1
// 240 x 75 mm running bond, fine 5 mm joints, independent firing variation.
float stRow=floor(stUV.y/.075);
vec2 stBrick=vec2(stUV.x/.24+mod(stRow,2.0)*.5,stUV.y/.075);
vec2 stCell=fract(stBrick);
vec2 stEdge=min(stCell,1.0-stCell)*vec2(.24,.075);
float stAA=max(.0007,stFootprint*.35);
float stMortar=1.0-smoothstep(.0020-stAA,.0030+stAA,min(stEdge.x,stEdge.y));
float stFiring=stHash(vec3(floor(stBrick),stSeed));
vec3 stClay=stBase*(.86+stFiring*.22)*(1.0+(stFine-.5)*.12);
float stJointDamp=stDamp*smoothstep(.36,.76,stPatch)*stAge;
vec3 stJoint=mix(stBase*.65+vec3(.074,.071,.060),vec3(.047,.052,.043),stJointDamp*.8);
diffuseColor.rgb=mix(stClay*(1.0-stDamp*stAge*.22),stJoint,stMortar);
diffuseColor.rgb=mix(diffuseColor.rgb,stBase*1.09,stFresh*.27);
stHeight-=stMortar*.0012;
stRoughDelta+=stMortar*.04;
#elif ST_FAMILY == 2
float stGrain=stNoise(stQ*(vec3(76.0)-stGrainAxis*73.5));
float stPeel=smoothstep(.56,.77,stGrain)*smoothstep(.48,.73,stPatch)*stAge*(1.0-stFresh);
diffuseColor.rgb*=.89+stGrain*.20;
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.11,.068,.033),stPeel*.86);
diffuseColor.rgb*=1.0-stDamp*stAge*.22;
stHeight+=(stGrain-.5)*.00055-stPeel*.0004;
stRoughDelta+=stPeel*.15;
#elif ST_FAMILY == 3 || ST_FAMILY == 11
// Broken oxidation clusters at cross-member heights, bolts and wet junctions.
float stJunction=exp(-abs(sin(stP.y*3.14159/.42))*13.0);
float stRust=clamp(smoothstep(.51,.77,stPatch)*(stDamp*.6+stJunction*.6+.12)*stAge*(1.0-stFresh)*(.65+stSalt*.7),0.0,1.0);
diffuseColor.rgb=mix(stBase*(.94+stFine*.10),vec3(.20,.082,.027),stRust);
stMetalLoss=stRust*.8;
stRoughDelta+=stRust*.22;
stHeight+=stRust*.0006;
#elif ST_FAMILY == 4
diffuseColor.rgb*=.94+stLarge*.10-stStreak*stAge*.08;
stHeight=0.0; stRoughDelta=stStreak*stAge*.14;
#elif ST_FAMILY == 5 || ST_FAMILY == 9
float stFibre=sin(stUV.x*870.0)*sin(stUV.y*690.0);
diffuseColor.rgb*=1.0-stAge*stLarge*.14+(stFine-.5)*.04;
stHeight+=stFibre*.00012*(1.0-smoothstep(.001,.008,stFootprint));
#elif ST_FAMILY == 6
// Young paint stays saturated; wear follows isolated old-paint islands.
float stSignWear=smoothstep(.57,.81,stPatch)*stAge*(1.0-stFresh);
diffuseColor.rgb=mix(stBase,stBase*.59+vec3(.05),stSignWear*.62);
stRoughDelta+=stSignWear*.19;
stHeight-=stSignWear*.0003;
#elif ST_FAMILY == 7
stHeight=0.0; stRoughDelta=0.0;
#elif ST_FAMILY == 10
diffuseColor.rgb*=.96+stFine*.06-stDamp*stAge*.12;
stHeight*=.15;
#endif
// Wetness changes only localized roughness/color and never creates mirrors.
diffuseColor.rgb*=1.0-stWet*.13;
`,
  roughness: 'roughnessFactor=clamp(roughnessFactor+stRoughDelta-stWet*.23,.23,1.0);',
  metalness: 'metalnessFactor*=1.0-stMetalLoss;',
  normal: `
vec3 stDx=dFdx(-vViewPosition),stDy=dFdy(-vViewPosition);
vec3 stRx=cross(stDy,normal),stRy=cross(normal,stDx);
float stDet=dot(stDx,stRx);
vec3 stGradient=sign(stDet)*(dFdx(stHeight)*stRx+dFdy(stHeight)*stRy);
normal=normalize(max(abs(stDet),1e-10)*normal-stGradient);
`,
  emissive: '\n#if ST_FAMILY == 7\ntotalEmissiveRadiance*=.98+.02*sin(stTime*1.7+stSeed);\n#endif\n'
});

function insert(source, marker, text) {
  if (!source.includes(marker)) throw new Error(`Missing Three shader hook ${marker}`);
  return source.replace(marker,marker+'\n'+text);
}
export function createMaterialLibrary(THREE, score={}) {
  const cache=new Map(), materials=[];
  const appearance=score.appearance||{}, buildings=score.construction?.buildings||[];
  const mean=(key,fallback)=>buildings.length ? buildings.reduce((n,b)=>n+clamp(b[key],fallback),0)/buildings.length : fallback;
  let currentWet=clamp(appearance.wetness,.3), time=0, disposed=false;
  const worldOffset=new THREE.Vector3();
  const limit=score.performance?.limits?.maxMaterials??48;
  function get(requested,options={}) {
    if(disposed) throw new Error('Material library has been disposed');
    const family=ALIASES[requested]||requested, index=FAMILIES.indexOf(family);
    if(index<0) throw new Error(`Unknown street material family: ${requested}`);
    const color=new THREE.Color(options.color??options.tint??appearance[family+'Tint']??PALETTE[index]);
    const origin=options.origin??[0,0,0];
    const config={color:color.getHexString(),age:clamp(options.age,mean('age',.65)),repair:clamp(options.repair,mean('repair',.2)),
      salt:clamp(options.saltExposure,clamp(appearance.saltExposure,.5)),wetness:options.wetness==null?null:clamp(options.wetness,currentWet),seed:seedOf(options.seed??options.id??score.object?.seed??1978),
      origin:[origin.x??origin[0]??0,origin.y??origin[1]??0,origin.z??origin[2]??0],
      grid:[Math.max(.1,options.floorHeight??3.03),options.groundHeight??4.2,Math.max(.1,(options.width??8.4)/(options.bays??3))],
      sill:[options.sillHeight??.245,clamp(options.sillEdge,.11)],
      axis:options.grainAxis??'y',roughness:clamp(options.roughness,ROUGHNESS[index]),
      metalness:clamp(options.metalness,index===3?.54:index===11?.63:0),opacity:clamp(options.opacity,1),
      emissive:options.emissive??(index===7?color.getHex():0),emissiveIntensity:options.emissiveIntensity??(index===7?1.6:0)};
    const key=family+JSON.stringify(config);
    if(cache.has(key)) return cache.get(key);
    if(materials.length>=limit) throw new Error(`Street material limit ${limit} exceeded; share building palettes`);
    const material=new THREE.MeshStandardMaterial({color,roughness:config.roughness,metalness:config.metalness,
      opacity:config.opacity,transparent:config.opacity<1,depthWrite:config.opacity>=1,
      emissive:config.emissive,emissiveIntensity:config.emissiveIntensity,
      side:index===5||index===9?THREE.DoubleSide:THREE.FrontSide});
    const uniforms={stAge:{value:config.age},stRepair:{value:config.repair},stWetness:{value:config.wetness??currentWet},
      stSalt:{value:config.salt},stSeed:{value:config.seed},stTime:{value:time},stOrigin:{value:new THREE.Vector3(...config.origin)},stWorldOffset:{value:worldOffset},
      stGrid:{value:new THREE.Vector3(...config.grid)},stSill:{value:new THREE.Vector2(...config.sill)},stGrainAxis:{value:new THREE.Vector3(config.axis==='x'?1:0,config.axis==='y'?1:0,config.axis==='z'?1:0)}};
    material.name=`street/${family}/${materials.length}`;
    material.userData={street:{family,config,uniforms,revision:MATERIAL_REVISION,textureFree:true}};
    material.customProgramCacheKey=()=>MATERIAL_REVISION+'/'+index;
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=SURFACE_SHADER.vertexDeclarations+shader.vertexShader;
      shader.vertexShader=insert(shader.vertexShader,'#include <project_vertex>',SURFACE_SHADER.vertexPosition);
      shader.fragmentShader=`#define ST_FAMILY ${index}\n`+SURFACE_SHADER.fragmentDeclarations+shader.fragmentShader;
      for(const [marker,part] of [['color_fragment','surface'],['roughnessmap_fragment','roughness'],['metalnessmap_fragment','metalness'],['normal_fragment_maps','normal'],['emissivemap_fragment','emissive']])
        shader.fragmentShader=insert(shader.fragmentShader,`#include <${marker}>`,SURFACE_SHADER[part]);
    };
    cache.set(key,material); materials.push(material); return material;
  }
  return {get,materials,update(nextTime,worldInputs={}) {
    if(Number.isFinite(nextTime)) time=nextTime;
    if(Number.isFinite(worldInputs.wetness)) currentWet=clamp(worldInputs.wetness,currentWet);
    const offset=worldInputs.originOffset;
    if(offset){const xyz=[offset.x??offset[0],offset.y??offset[1],offset.z??offset[2]];if(xyz.every(Number.isFinite))worldOffset.set(...xyz);}
    for(const m of materials){const s=m.userData.street;s.uniforms.stTime.value=time;s.uniforms.stWetness.value=s.config.wetness??currentWet;}
  },dispose({resources=true}={}){if(resources)for(const m of materials)m.dispose();cache.clear();materials.length=0;disposed=true;}};
}
