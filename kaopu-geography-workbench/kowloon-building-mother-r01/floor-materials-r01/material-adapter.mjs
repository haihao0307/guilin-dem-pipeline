/** Isolated original-field material receiver. All charts and height values use metres.
 * Caller owns geometry, light transport, normal conversion and renderer lifecycle.
 * No meshes, texture assets, geometry queries, BRDF or lighting are imported.
 */
import {CERAMIC_SOURCE_GLSL,METAL_SOURCE_GLSL,CONCRETE_PLASTER_SOURCE_GLSL} from './sources/field-sources.mjs';
// This floor slice uses only a design painted door; optional timber remains in its original workbench, not a runtime dependency.

export const FLOOR_MATERIAL_ROLES=Object.freeze({interiorFloorTile:10,exteriorHorizontalTile:11,interiorWallPaint:12,darkMetalFrame:13,designDoor:14});
export const FLOOR_MATERIAL_DEFAULTS=Object.freeze({
 floorTileM:Object.freeze([.298,.298]),floorJointM:.003,
 exteriorTileM:Object.freeze([.198,.048]),exteriorJointM:.003,
 floorColor:Object.freeze([.59,.57,.51]),exteriorColor:Object.freeze([.68,.67,.61]),
 groutColor:Object.freeze([.35,.34,.30]),wallPaintColor:Object.freeze([.72,.70,.63]),
 frameCoatColor:Object.freeze([.035,.043,.041]),doorPaintColor:Object.freeze([.22,.18,.12]),
 doorFinish:'paint',woodScale:3.0,woodReliefM:.00012,
 groutRecessM:.0015,bevelWidthM:.001,bevelDropM:.00065,
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
function vector(v,n,lo,hi,label){if(!Array.isArray(v)||v.length!==n||v.some(x=>!Number.isFinite(x)||x<lo||x>hi))throw new RangeError(label+' outside finite supported range');return [...v];}
export function normalizeFloorMaterialOptions(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Material options object required');
 const p={...FLOOR_MATERIAL_DEFAULTS,...input};
 for(const k of ['floorTileM','exteriorTileM'])p[k]=vector(p[k],2,.016,.6,k);
 for(const k of ['floorColor','exteriorColor','groutColor','wallPaintColor','frameCoatColor','doorPaintColor'])p[k]=vector(p[k],3,0,1,k);
 for(const[k,lo,hi]of [['floorJointM',.001,.012],['exteriorJointM',.001,.012],['woodScale',.25,12],['woodReliefM',0,.00042],['groutRecessM',0,.004],['bevelWidthM',.0001,.003],['bevelDropM',0,.0015]])if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw new RangeError(k+' outside supported metre/value range');
 if(!['paint','wood'].includes(p.doorFinish))throw new RangeError('doorFinish must be paint or wood');
 return p;
}

/** Chart only, not a geometry query. Tile centre (0,0) is half a pitch from origin.
 * Role 10 uses caller-local X/Z; role 11 uses X/Y. Caller must supply a stable
 * rigid surface chart, not normalized UVs or unrotated world coordinates.
 */
export function sampleTileCell(role,pointM,footprintM=0,options={}){
 if(role!==10&&role!==11)throw new RangeError('Tile role must be 10 or 11');
 vector(pointM,3,-1e7,1e7,'pointM');if(!Number.isFinite(footprintM)||footprintM<0)throw new RangeError('Nonnegative physical footprint required');
 const p=normalizeFloorMaterialOptions(options),tile=role===10?p.floorTileM:p.exteriorTileM,joint=role===10?p.floorJointM:p.exteriorJointM,uv=role===10?[pointM[0],pointM[2]]:pointM.slice(0,2),pitch=tile.map(x=>x+joint),cell=uv.map((v,i)=>Math.floor(v/pitch[i])),local=uv.map((v,i)=>v-(cell[i]+.5)*pitch[i]),edge=local.map((v,i)=>tile[i]/2-Math.abs(v)),aa=Math.max(.000001,footprintM*.55),coverage=edge.map(d=>smooth(-aa,aa,d));
 const tileMask=coverage[0]*coverage[1],d=Math.min(...edge),bevel=smooth(0,p.bevelWidthM,d),height=-p.groutRecessM+tileMask*(p.groutRecessM-p.bevelDropM*(1-bevel));
 return {role,units:'metres',uvM:uv,cell,localM:local,tileM:[...tile],jointM:joint,pitchM:pitch,tileMask,bevelHeightM:height,geometryDisplacementM:0};
}

const num=n=>Number.isInteger(n)?n+'.0':String(n),val=v=>Array.isArray(v)?`vec${v.length}(${v.map(num).join(',')})`:num(v);
function rename(source,names,prefix){const set=new Set(names);return source.replace(/\b[A-Za-z_]\w*\b/g,x=>set.has(x)?prefix+x:x);}
function functionNames(source){return [...source.matchAll(/^(?:float|vec[234]|void|Kp\w+|MetalSurface)\s+(\w+)\s*\(/gm)].map(m=>m[1]);}
const metalNames=[...functionNames(METAL_SOURCE_GLSL),'MetalSurface','vRestM','vSurfaceN','uWear','uHistory','uWet','uRepair','uMode','uVariant','uRack','uJoints','uJointCount'];
const metalSource=rename(METAL_SOURCE_GLSL
 .replace('varying vec3 vRestM;varying vec3 vSurfaceN;','vec3 vRestM;vec3 vSurfaceN;')
 .replace('uniform float uWear,uHistory,uWet,uRepair,uMode,uVariant,uRack;','const float uWear=0.,uHistory=0.,uWet=0.,uRepair=0.,uMode=0.,uVariant=1.,uRack=0.;')
 .replace('uniform vec3 uJoints[16];uniform int uJointCount;','vec3 uJoints[16];const int uJointCount=0;'),metalNames,'fmR06_');
const ceramicNames=[...new Set(CERAMIC_SOURCE_GLSL.match(/\bct\w+\b/g))];
const ceramicSource=rename(CERAMIC_SOURCE_GLSL.replace(/\bvarying\s+/g,'').replace(/\buniform\s+/g,''),ceramicNames,'fmR04_');
const plasterNames=[...functionNames(CONCRETE_PLASTER_SOURCE_GLSL),'KpSurface','KpPlasterParams','KpPlasterField'];
const plasterSource=rename(CONCRETE_PLASTER_SOURCE_GLSL,plasterNames,'fmP_');
export function buildFloorMaterialGLSL(options={}){
 const p=normalizeFloorMaterialOptions(options);
 if(p.doorFinish!=='paint')throw new RangeError('This bounded floor slice supports only the design painted-door receiver');
 return `
// Field-material only. No ray traversal or geometry evaluator occurs here.
struct FloorMaterialSample {
 vec3 baseColor;float roughness;float metallic;float height;
 float clearcoat;float clearcoatRoughness;vec3 coverageDiffuse;vec3 coverageF0;
 vec2 cell;float tileMask;vec2 bevelGradient;float cavity;
};
${metalSource}
${ceramicSource}
${plasterSource}

FloorMaterialSample fmDielectric(vec3 color,float rough,float height,float coat,float coatRough){return FloorMaterialSample(color,rough,0.,height,coat,coatRough,color,vec3(.04),vec2(-1.),1.,vec2(0.),1.);}
// Derivative of the cubic smoothstep, in inverse metres.
float fmSmoothDerivative(float a,float b,float x){float q=clamp((x-a)/(b-a),0.,1.);return x>a&&x<b?6.*q*(1.-q)/(b-a):0.;}
FloorMaterialSample fmCeramic(vec2 uv,float fp,float objectId,bool floorTile){
 vec2 size=floorTile?${val(p.floorTileM)}:${val(p.exteriorTileM)};float joint=floorTile?${val(p.floorJointM)}:${val(p.exteriorJointM)};
 vec2 pitch=size+joint,cell=floor(uv/pitch),q=uv-(cell+.5)*pitch,edge=size*.5-abs(q);
 float aa=max(.000001,fp*.55);vec2 cover=smoothstep(vec2(-aa),vec2(aa),edge);float mask=cover.x*cover.y;
 fmR04_ctPosition=vec3(q,0.);fmR04_ctObjectNormal=vec3(0,0,1);fmR04_ctCell=vec3(cell,objectId);
 fmR04_ctSize=size;fmR04_ctWear=0.;fmR04_ctStain=0.;fmR04_ctWet=0.;fmR04_ctVariant=1.;fmR04_ctGlaze=1.;fmR04_ctBaseRoughness=floorTile?.34:.29;fmR04_ctMode=0.;
 fmR04_ctColor=floorTile?${val(p.floorColor)}:${val(p.exteriorColor)};fmR04_ctBody=vec3(.48,.32,.20);
 vec3 color;float rough,height,coat,coatRough,chip,deposit;
 fmR04_ctEvaluate(color,rough,height,coat,coatRough,chip,deposit);
 // New finite-footprint receiving filter. The original R04 has no LOD system.
 // A resolved glazed face has its original 0.32 mm film; remove only its constant
 // datum, and attenuate unresolved waviness. This never changes ray geometry.
 float reliefGate=1.-smoothstep(.001,.012,fp);
 float faceHeight=(height-.00032)*reliefGate;
 float d=min(edge.x,edge.y),bevel=smoothstep(0.,${val(p.bevelWidthM)},d);
 float top=${val(p.groutRecessM)}-${val(p.bevelDropM)}*(1.-bevel);
 float bevelHeight=-${val(p.groutRecessM)}+mask*top;
 vec2 dMask=vec2(fmSmoothDerivative(-aa,aa,edge.x)*cover.y,fmSmoothDerivative(-aa,aa,edge.y)*cover.x)*-sign(q);
 vec2 dEdge=edge.x<=edge.y?vec2(-sign(q.x),0.):vec2(0.,-sign(q.y));
 vec2 bevelGradient=dMask*top+mask*${val(p.bevelDropM)}*fmSmoothDerivative(0.,${val(p.bevelWidthM)},d)*dEdge;
 // Grout is a new metric field adaptation of R04's private mortar receiver;
 // no per-tile Mesh, recessed mesh plane or hidden geometric bevel is imported.
 float grain=fmR06_mt_kn(vec3(uv*2300.,objectId));float grainGate=fmR06_mt_resolved(2300.,fp);
 vec3 grout=${val(p.groutColor)}*(.96+.08*mix(.5,grain,grainGate));
 FloorMaterialSample s=fmDielectric(mix(grout,color,mask),mix(.91,rough,mask),bevelHeight+mask*faceHeight,coat*mask,coatRough);
 s.cell=cell;s.tileMask=mask;s.bevelGradient=bevelGradient;return s;
}
FloorMaterialSample fmWallPaint(vec3 p,float fp){
 fmP_KpPlasterParams a=fmP_KpPlasterParams(vec2(0.,1.35),vec2(2.,1.5),.0165,.0014,0.,.013,.02,.0001,${val(p.wallPaintColor.map(x=>x*.94))},${val(p.wallPaintColor)},.0008,.000008,.018);
 fmP_KpSurface original=fmP_kpPlasterOriginalField(vec3(p.xy,0.),a,fp).surface;
 // New opaque wall-paint receiving layer; not a recovered mature paint mother.
 float gate=1.-smoothstep(.0003,.0015,fp),orange=.5*sin(p.x*3695.991)*sin(p.y*5711.987);
 return fmDielectric(original.albedo,clamp(.72+.035*orange*gate,.6,.85),original.height*.25+orange*.000012*gate,.04,.40);
}
FloorMaterialSample fmMetal(vec3 p,vec3 n,float fp){
 fmR06_vSurfaceN=normalize(n);fmR06_vRestM=p;fmR06_MetalSurface m=fmR06_metalField(p,fp);
 // The mother uses a green coating. Only its intact coating diffuse palette is
 // remapped to the observed dark-frame character. F0, layering and height stay
 // the mother's. The exact color and roughness remain authored design choices.
 vec3 diffuse=max(vec3(0.),m.coverageDiffuse+(${val(p.frameCoatColor)}-vec3(.085,.12,.105))*m.layers.x);
 FloorMaterialSample s=fmDielectric(diffuse,m.rough,m.height,0.,1.);s.baseColor=diffuse;s.metallic=m.metal;s.coverageDiffuse=diffuse;s.coverageF0=m.coverageF0;return s;
}
FloorMaterialSample fmDoor(vec3 localM,vec3 localNormal,float footprintM){
 float gate=1.-smoothstep(.0003,.0015,footprintM),orange=.5*sin(localM.x*3695.991)*sin(localM.y*5711.987),brush=.5*sin(localM.x*2026.834+sin(localM.y*52.36)*.12);
 return fmDielectric(${val(p.doorPaintColor)},clamp(.38+.035*orange*gate,.08,.98),(orange*.65+brush*.35)*.000018*gate,.25,.27);

// localMetres: role 10 uses X/Z floor chart; role 11/12/14 uses X/Y face chart;
// role 13 uses rigid member-local XYZ. localNormal is in THAT same frame.
// objectId must be stable in [0,65535] and may not contain camera/time values.
FloorMaterialSample sampleFloorMaterial(float role,vec3 localMetres,vec3 localNormal,float physicalFootprintM,float stableObjectId){
 float fp=max(physicalFootprintM,.000001);
 if(role<9.5||role>14.5)return fmDielectric(vec3(1.,0.,1.),1.,0.,0.,1.);
 if(role<10.5)return fmCeramic(localMetres.xz,fp,stableObjectId,true);
 if(role<11.5)return fmCeramic(localMetres.xy,fp,stableObjectId,false);
 if(role<12.5)return fmWallPaint(localMetres,fp);
 if(role<13.5)return fmMetal(localMetres,localNormal,fp);
 return fmDoor(localMetres,localNormal,fp);
}
`;
}
export const FLOOR_MATERIAL_GLSL=buildFloorMaterialGLSL();
