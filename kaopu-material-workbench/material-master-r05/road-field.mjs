/** R05 own road-fracture research. Metres throughout. Frozen R02/R03 files unchanged.
 * Integer lattice hash gives matching CPU / GLSL feature IDs; domain warping,
 * feature-distance competition and stress activation generate the fracture field.
 * No authored crack segments, line texture, purchased map or baked crack decal.
 */
export const ROAD_PROVENANCE=Object.freeze({
 fracture:'KAOPU R05 independently authored domain-warped feature competition / stress field; illustrative, not a fracture mechanics solver.',
 concreteMother:'Preserved KST1-surfaces-2 ST_FAMILY 8 arithmetic via R02 sources/concrete-kst.mjs and R03 concreteMother.',
 concreteSource:'../material-master-workbench-r02/sources/concrete-kst.mjs',
 concreteSourceSHA256:'e0eb596c2d3b38526c2bcecadb2baa10b197e8cf9669fab37c9654cdad3f1d5d',
 constructionReference:'https://www.hyd.gov.hk/en/technical_references/standard_drawings/hyd_standard_drawings/doc/section_1/pdf/h1105.pdf',
 constructionBoundary:'Physical expansion joint study: 20 mm filler, recessed seal. The referenced sheet records a June 1994 revision. Slab dimensions, mix and damage are illustrative, not a claim of a surveyed historic Hong Kong road.',
 markings:'Optional white conventional lane-marking fragment. No claim of a particular historic lane layout or statutory dimensions.'
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function roadHash(x,z,s=0){let h=(Math.imul(x|0,1597334677)^Math.imul(z|0,3812015801)^Math.imul(s|0,2246822519))>>>0;h=Math.imul(h^(h>>>16),2246822519)>>>0;h=Math.imul(h^(h>>>13),3266489917)>>>0;return ((h^(h>>>16))>>>0)/4294967295}
export function roadNoise(x,z,s=0){const i=Math.floor(x),j=Math.floor(z),u=smooth(0,1,x-i),v=smooth(0,1,z-j);return mix(mix(roadHash(i,j,s),roadHash(i+1,j,s),u),mix(roadHash(i,j+1,s),roadHash(i+1,j+1,s),u),v)}
export function normalizeRoadOptions(options={}){
 const family=options.family==='concrete'?'concrete':'asphalt';
 return {family,variant:options.variant===0?0:1,wear:clamp(options.wear??.65),history:clamp(options.history??.55),wetness:clamp(options.wetness??options.wet??0),repair:clamp(options.repair??.2),mode:clamp(options.mode??0,0,5),width:clamp(options.width??3.4,1.2,8),length:clamp(options.length??4.8,1.4,10),spacing:clamp(options.spacing??.018,.009,.05),markings:options.markings!==false,seed:Math.floor(options.seed??23),topY:Number(options.topY??0)};
}
/** Immutable causal field; cache on vertices for fast geometry updates. */
export function roadPotential(x,z,o={}){
 const concrete=o.family==='concrete',seed=o.seed??23,cell=concrete?1.28:.58;
 const wx=roadNoise(x*1.73,z*1.73,seed+1)-.5,wz=roadNoise(x*1.47+13,z*1.47-8,seed+2)-.5;
 const ux=x/cell+wx*.74+(roadNoise(x*7.1,z*7.1,seed+7)-.5)*.065,uz=z/cell+wz*.74+(roadNoise(x*6.7,z*6.7,seed+9)-.5)*.065;
 const ix=Math.floor(ux),iz=Math.floor(uz);let d1=1e6,d2=1e6;
 for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
  const a=ix+i,b=iz+j,dx=a+.12+.76*roadHash(a,b,seed+11)-ux,dz=b+.12+.76*roadHash(a,b,seed+12)-uz,d=dx*dx+dz*dz;
  if(d<d1){d2=d1;d1=d}else if(d<d2)d2=d;
 }
 const distance=(Math.sqrt(d2)-Math.sqrt(d1))*cell*.52;
 const stress=roadNoise(x*.83+5,z*.83-2,seed+17),grain=roadNoise(x*19.1,z*19.1,seed+21);
 const activity=smooth(concrete?.36:.20,concrete?.77:.65,stress);
 const halfWidth=(concrete?.0026:.0038)+(concrete?.0046:.008)*roadNoise(x*3.7,z*3.7,seed+22);
 const edgeDistance=Math.min((o.width??3.4)/2-Math.abs(x),(o.length??4.8)/2-Math.abs(z));
 const edgeStress=smooth(.28,.75,stress*.58+grain*.42);
 const patchR=Math.sqrt(((x-.61)/.53)**2+((z+.62)/.72)**2)+(grain-.5)*.09;
 return {distance,activity,halfWidth,grain,stress,edgeDistance,edgeStress,patch:smooth(1.06,.94,patchR),baseHeight:(roadNoise(x*2.6,z*2.6,seed+29)-.5)*(concrete?.00065:.0025)};
}
export function roadDamage(p,o={}){
 const w=(o.wear??.65)*(o.variant===0?0:1),repair=(o.repair??.2)*(o.variant===0?0:1),concrete=o.family==='concrete';
 const patch=p.patch*repair;
 const activated=smooth(.025,.44,w*p.activity),width=p.halfWidth*(.35+.95*w);
 const core=(1-smooth(width*.20,width,p.distance))*activated*(1-patch);
 const collar=(1-smooth(width*.4,width+(concrete?.018:.026)*( .45+.55*p.grain),p.distance))*activated*(1-patch);
 const edge=(1-smooth(0,.052,p.edgeDistance))*p.edgeStress*w*(1-patch);
 const depth=(concrete?.011:.018)*(.45+.55*p.stress)*w;
 const macro=p.baseHeight-core*depth-collar*(concrete?.0018:.0034)*w-edge*(concrete?.014:.021)+patch*.0016;
 return {core,collar,edge,patch,depth,macro,damage:Math.max(core,edge),exposure:clamp(collar*.85+edge*.8)};
}
export function sampleRoadField(x,z,options={}){const o=normalizeRoadOptions(options),p=roadPotential(x,z,o);return {...p,...roadDamage(p,o),x,z,units:'metres'}}

// The same hash, noise, field and damage arithmetic as the CPU functions above.
export const ROAD_FIELD_GLSL=String.raw`
uniform float uRoadWear,uRoadHistory,uRoadWet,uRoadRepair,uRoadVariant,uRoadMode,uRoadFamily,uRoadMarkings;
uniform vec2 uRoadSize;uniform int uRoadSeed;uniform float uRoadTopY;
uint roadHashU(ivec2 p,int s){uint h=uint(p.x)*1597334677u^uint(p.y)*3812015801u^uint(s)*2246822519u;h=(h^(h>>16u))*2246822519u;h=(h^(h>>13u))*3266489917u;return h^(h>>16u);}
float roadHash(ivec2 p,int s){return float(roadHashU(p,s))/4294967295.;}
float roadNoise(vec2 p,int s){ivec2 i=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(roadHash(i,s),roadHash(i+ivec2(1,0),s),f.x),mix(roadHash(i+ivec2(0,1),s),roadHash(i+ivec2(1,1),s),f.x),f.y);}
struct RoadPotential{float distance;float activity;float halfWidth;float grain;float stress;float edgeDistance;float edgeStress;float repairMask;float baseHeight;};
RoadPotential roadPotential(vec2 p){
 bool concrete=uRoadFamily>.5;int seed=uRoadSeed;float cell=concrete?1.28:.58;
 float wx=roadNoise(p*1.73,seed+1)-.5,wz=roadNoise(p*1.47+vec2(13,-8),seed+2)-.5;
 vec2 u=p/cell+vec2(wx,wz)*.74+vec2(roadNoise(p*7.1,seed+7)-.5,roadNoise(p*6.7,seed+9)-.5)*.065;
 ivec2 ij=ivec2(floor(u));float d1=1e6,d2=1e6;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ivec2 k=ij+ivec2(i,j);vec2 d=vec2(k)+.12+.76*vec2(roadHash(k,seed+11),roadHash(k,seed+12))-u;float ds=dot(d,d);if(ds<d1){d2=d1;d1=ds;}else if(ds<d2){d2=ds;}}
 float dist=(sqrt(d2)-sqrt(d1))*cell*.52;float stress=roadNoise(p*.83+vec2(5,-2),seed+17),grain=roadNoise(p*19.1,seed+21);
 float activity=smoothstep(concrete?.36:.20,concrete?.77:.65,stress);
 float halfWidth=(concrete?.0026:.0038)+(concrete?.0046:.008)*roadNoise(p*3.7,seed+22);
 float edgeDistance=min(uRoadSize.x*.5-abs(p.x),uRoadSize.y*.5-abs(p.y));
 float edgeStress=smoothstep(.28,.75,stress*.58+grain*.42);
 float patchR=length((p-vec2(.61,-.62))/vec2(.53,.72))+(grain-.5)*.09;
 return RoadPotential(dist,activity,halfWidth,grain,stress,edgeDistance,edgeStress,1.-smoothstep(.94,1.06,patchR),(roadNoise(p*2.6,seed+29)-.5)*(concrete?.00065:.0025));
}
struct RoadDamage{float core;float collar;float edge;float repairMask;float depth;float macro;float exposure;};
RoadDamage roadDamage(RoadPotential p){
 bool concrete=uRoadFamily>.5;float w=uRoadWear*uRoadVariant,repairMask=p.repairMask*uRoadRepair*uRoadVariant;
 float activated=smoothstep(.025,.44,w*p.activity),width=p.halfWidth*(.35+.95*w);
 float core=(1.-smoothstep(width*.20,width,p.distance))*activated*(1.-repairMask);
 float collar=(1.-smoothstep(width*.4,width+(concrete?.018:.026)*(.45+.55*p.grain),p.distance))*activated*(1.-repairMask);
 float edge=(1.-smoothstep(0.,.052,p.edgeDistance))*p.edgeStress*w*(1.-repairMask);
 float depth=(concrete?.011:.018)*(.45+.55*p.stress)*w;
 float macro=p.baseHeight-core*depth-collar*(concrete?.0018:.0034)*w-edge*(concrete?.014:.021)+repairMask*.0016;
 return RoadDamage(core,collar,edge,repairMask,depth,macro,clamp(collar*.85+edge*.8,0.,1.));
}
`;
