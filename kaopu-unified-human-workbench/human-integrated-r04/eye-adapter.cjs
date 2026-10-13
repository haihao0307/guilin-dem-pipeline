'use strict';
const assert=require('node:assert/strict');
/** Gray layer ablation identifies NativeEyeLayer's narrow compensation as a
 * contributor to angular lids. A further actual closed-eye capture exposes
 * excessive U sag in the inherited blink. Corrections are skin-only and
 * bounded in the existing head-attached eye frame, never camera space. */
exports.adapt=function(source,rel,records){
 const replace=(a,b)=>{assert.equal(source.split(a).length,2,'Eye repair source drift: '+rel+' '+a);source=source.replace(a,()=>b);records.push({path:rel,adapter:'eye-continuous-native-envelope',from:a,to:b});};
 if(rel.endsWith('/eye-transfer/EyelidKnowledge.mjs')){
  replace("export const KNOWLEDGE_VERSION='kaopu/eye-knowledge@1';","export const KNOWLEDGE_VERSION='kaopu/eye-knowledge@2-r04';");
  const at='export function sectionOffset(';assert.equal(source.split(at).length,2);
  source=source.slice(0,source.indexOf(at))+`export function sectionOffset({distance,upper,temporal,scale,opening,brow,lid}){
 const d=distance/scale,s=temporal,g=(x,w)=>Math.exp(-(x*x)/(w*w)),c2=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
 const ends=c2(s/.16)*c2((1-s)/.14),depth=c2((d+.0015)/.0025)*c2((.025-d)/.007),arc=Math.max(0,4*s*(1-s));
 if(upper){const lidEnvelope=.000085*g(d-.0017,.0032)-.000055*g(d-.0056,.0035),browEnvelope=.00036*g(d-.0115,.0065);return scale*ends*depth*arc*(lidEnvelope*opening*lid+browEnvelope*brow);}
 return scale*ends*depth*arc*opening*lid*(.000065*g(d-.0020,.0033)-.000045*g(d-.0068-.001*s,.0042));
}
`;
  records.push({path:rel,adapter:'replace-underresolved-ridges-with-broad-C2-envelopes',nativeEyeballsChanged:false});
 }
 if(rel.endsWith('/eye-transfer/NativeEyeLayer.mjs')){
  replace('const back=r.displacement*near*settings.medial*outer;','const taper=smooth01(s/.07)*smooth01((.18-s)/.08)*smooth01((d/scale+.0015)/.0025);const back=Math.min(r.displacement,.00008*scale)*near*settings.medial*outer*taper;');
  replace("version:'ET11-U1',","version:'ET11-U1-R04-continuity',");
  replace('rows.push({side:e.side,',`let closedVertices=0,closedMaximum=0;const closing=smooth01(((1-opening)-.35)/.65);
   if(settings.enabled&&closing>0){
    const endY=(f.upper(1)+f.lower(1))*.5;
    for(const{index:i,outer}of e.patch){
     const q=f.project(point(p,i)),s=q[0]/f.width;if(s<=0||s>=1)continue;
     const oldLine=(f.upper(s)+f.lower(s))*.5,oldSupport=support(q[0],q[1]);
     if(oldSupport!==null&&q[2]<oldSupport-.00025*scale)continue;
     const proximity=Math.exp(-Math.pow((q[1]-oldLine)/(.0055*scale),2)),corners=smooth01(s/.15)*smooth01((1-s)/.15);
     const target=s*endY-.00075*scale*4*s*(1-s);
     const lift=clamp(target-oldLine,-.002*scale,.002*scale)*closing*proximity*corners*outer;
     if(Math.abs(lift)<1e-8)continue;
     const nextSupport=support(q[0],q[1]+lift),clearance=oldSupport===null?.00006*scale:Math.min(.00006*scale,q[2]-oldSupport);
     const front=nextSupport===null?0:Math.max(0,nextSupport+clearance-q[2]);
     for(let k=0;k<3;k++)p[i*3+k]+=f.y[k]*lift+f.z[k]*front;
     closedVertices++;closedMaximum=Math.max(closedMaximum,Math.abs(lift));
    }
   }
   rows.push({closedCorrectionVertices:closedVertices,maximumClosedLiftMM:closedMaximum*1000,closedTarget:'bounded shallow arc between retained current canthi; no eye-mesh replacement',side:e.side,`);
 }
 return source;
};
if(require.main===module){
 const fs=require('fs'),path=require('path');let n=0;
 for(const f of ['EyelidKnowledge.mjs','NativeEyeLayer.mjs']){const p=path.resolve(__dirname,'../eye-transfer',f),s=fs.readFileSync(p,'utf8'),records=[];const out=exports.adapt(s,'kaopu-unified-human-workbench/eye-transfer/'+f,records);assert(out!==s);assert.equal(fs.readFileSync(p,'utf8'),s);n+=records.length;}
 console.log('PASS eye adapter '+n+' exact contracts; original modules unchanged; closed-lid correction uses retained eye support');
}
