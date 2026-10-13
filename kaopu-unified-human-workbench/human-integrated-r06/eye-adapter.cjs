'use strict';
const assert=require('node:assert/strict');
/** Actual gray ablation at R03 shows the remaining angular eyelid/canthus
 * additions come from NativeEyeLayer, not the new broad face envelopes.
 * Keep the original eyeballs, native lid opening and eyelid control schema.
 * The sparse native mesh cannot resolve 0.66mm ridges reliably. Use broad
 * low-amplitude envelopes and a bounded smooth medial correction instead. */
exports.adapt=function(source,rel,records){
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Eye repair source drift: '+rel+' '+a);source=source.replace(a,()=>b);records.push({path:rel,adapter:'eye-continuous-native-envelope',from:a,to:b});};
 if(rel.endsWith('/eye-transfer/EyelidKnowledge.mjs')){
  replace("export const KNOWLEDGE_VERSION='kaopu/eye-knowledge@1';","export const KNOWLEDGE_VERSION='kaopu/eye-knowledge@2-r04';");
  const at='export function sectionOffset(';assert.equal(source.split(at).length,2);
  source=source.slice(0,source.indexOf(at))+`export function sectionOffset({distance,upper,temporal,scale,opening,brow,lid}){
 const d=distance/scale,s=temporal,g=(x,w)=>Math.exp(-(x*x)/(w*w)),c2=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
 // Zero value and slope at both corners and the inner/outer depth limits.
 const ends=c2(s/.16)*c2((1-s)/.14),depth=c2((d+.0015)/.0025)*c2((.025-d)/.007),arc=Math.max(0,4*s*(1-s));
 if(upper){
  const lidEnvelope=.000085*g(d-.0017,.0032)-.000055*g(d-.0056,.0035);
  const browEnvelope=.00036*g(d-.0115,.0065);
  return scale*ends*depth*arc*(lidEnvelope*opening*lid+browEnvelope*brow);
 }
 return scale*ends*depth*arc*opening*lid*(.000065*g(d-.0020,.0033)-.000045*g(d-.0068-.001*s,.0042));
}
`;
  records.push({path:rel,adapter:'replace-underresolved-submillimetre-ridges-with-broad-C2-envelopes',nativeEyeballsChanged:false});
 }
 if(rel.endsWith('/eye-transfer/NativeEyeLayer.mjs')){
  replace('const back=r.displacement*near*settings.medial*outer;','const taper=smooth01(s/.07)*smooth01((.18-s)/.08)*smooth01((d/scale+.0015)/.0025);const back=Math.min(r.displacement,.00020*scale)*near*settings.medial*outer*taper;');
  replace("version:'ET11-U1',","version:'ET11-U1-R04-continuity',");
 }
 return source;
};
if(require.main===module){
 const fs=require('fs'),path=require('path');let n=0;
 for(const f of ['EyelidKnowledge.mjs','NativeEyeLayer.mjs']){const p=path.resolve(__dirname,'../eye-transfer',f),s=fs.readFileSync(p,'utf8'),records=[];const out=exports.adapt(s,'kaopu-unified-human-workbench/eye-transfer/'+f,records);assert(out!==s);assert.equal(fs.readFileSync(p,'utf8'),s);n+=records.length;}
 console.log('PASS eye adapter '+n+' exact source contracts; original modules remain unchanged');
}
