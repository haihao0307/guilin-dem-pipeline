/** Official GNM identity presets, independent of expression and rendering.
 * One model instance. No geometry assets or texture assets are duplicated.
 */
export const GNM_IDENTITY_PROFILES=Object.freeze({
 neutral:Object.freeze({id:'neutral',label:'原头',female:false,seed:null,sigma:0}),
 'female-a':Object.freeze({id:'female-a',label:'女性 A',female:true,seed:20261005,sigma:.6}),
 'female-b':Object.freeze({id:'female-b',label:'女性 B',female:true,seed:20261006,sigma:.6}),
});
const hash=a=>{const v=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let h=2166136261;for(const b of v)h=Math.imul(h^b,16777619)>>>0;return h;};
export class GnmIdentityProfiles{
 constructor(model,samplers){
  this.model=model;this.samplers=samplers;this.cache=new Map();this.current='neutral';this.applications=0;
  this.femaleIndex=samplers.genders.findIndex(g=>String(g).toLowerCase()==='female');
  if(this.femaleIndex<0)throw Error('Official GNM female condition is missing');
  this.cache.set('neutral',new Float32Array(model.identityDim));
 }
 get isFemale(){return GNM_IDENTITY_PROFILES[this.current].female;}
 vector(profile){
  if(!Object.hasOwn(GNM_IDENTITY_PROFILES,profile))throw Error('Unknown identity profile: '+profile);
  if(!this.cache.has(profile)){
   const p=GNM_IDENTITY_PROFILES[profile];this.samplers.seed(p.seed);
   const weights=this.samplers.genders.map((_,i)=>i===this.femaleIndex?1:0);
   this.cache.set(profile,this.samplers.sampleIdentity(weights,this.samplers.ethnicities.map(()=>1),p.sigma));
  }
  // A caller cannot mutate a cached profile through the returned vector.
  return this.cache.get(profile).slice();
 }
 apply(profile){const v=this.vector(profile);this.model.setIdentityVector(v);this.current=profile;this.applications++;return this.diagnostics();}
 diagnostics(){const p=GNM_IDENTITY_PROFILES[this.current];return{...p,source:p.female?'Official GNM FEMALE semantic sampler':'Original zero-identity GNM head',notTen24:true,identityHash:hash(this.model.identity),applications:this.applications,cachedProfiles:[...this.cache.keys()],identityDimensions:this.model.identityDim};}
}
