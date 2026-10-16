import {clamp,smooth,mix,hairline} from './approved/LegacyFoundation.mjs';
import {bundleOf} from './BundlePlan.mjs';
export const U07_LONG_STUDY=Object.freeze({id:'u07-center-part-ear-swept-long-r20',inherits:'u07-center-part-ear-swept-long-r19',method:'one continuous root-flow correction from local reference and R19 pixel inspection; no image pixels or external photo asset',observed:['near-central part with a fully exposed forehead','front-edge hair follows shallow curved sideward flow rather than an exposed rigid horizontal cap','low temporal hair descends beside the ear before joining long posterior layers','long side and posterior silhouette continuing below shoulder line'],inferred:['hidden back-of-head depth and rear root flow','terminal lengths outside the photographed visible region','behind-ear and shoulder clearance on the current native identity'],measurements:'model-space artistic route landmarks; not calibrated physical measurements from the photo',rootDomainChanged:false,rootPopulationChanged:false,noiseAdded:false,userVisualAccepted:false});
export const U07_LENGTH_PROFILE=Object.freeze({schema:'kaopu/u07-authored-long-layers@1',frontHemMM:-30,sideHemMM:-50,backHemMM:-75,napeHemMM:-35,variationMM:16,coordinates:'retained intrinsic head-aligned Y-up/Z-front',authority:'visible flow category; concealed terminal geometry inferred',earOrJawShortOverlays:false,actualPathsAuthoritative:true});
// Continuous weights on the original approved chart. They change the complete
// root-owned path, never growth masks, root samples, width, opacity or density.
export function u07RootWeights(c){
 const theta=Math.abs(Math.atan2(c[0],c[2]-.015)),margin=c[1]-hairline(theta,0,0);
 const rim=(1-smooth(margin/.012))*(1-smooth((theta-.48)/.30))*smooth((c[2]-.070)/.025);
 const temple=smooth((Math.abs(c[0])-.045)/.025)*(1-smooth((c[1]-.310)/.045))*smooth((c[2]+.030)/.060);
 return{rim,temple};
}
export function u07RootLift(c){
 const{rim,temple}=u07RootWeights(c),base=Math.atan2(.34,.94);
 return (base+(12*Math.PI/180-base)*rim)*(1-temple)+(14*Math.PI/180)*temple;
}
export function u07Emergence(c,r){
 const dx=c[0]-r.partMM*.001,side=dx<0?-1:1,front=smooth((c[2]+.025)/.10);
 // Lateral, backward-tangent emergence keeps the forehead clear. The original
 // native surface projection and ear-clearance resolve still set the final root direction.
 const{rim,temple}=u07RootWeights(c),across=smooth(Math.abs(dx)/.063);
 let d=[side*(.045+.065*front),-.018-.025*(1-front),-.075+.030*front];
 // The first 12 mm root band fans into shallow, downward-curving complete
 // locks. Spatial variation is a monotone field, not random flyaways.
 d=mix(d,[side*(.064+.018*across),-.032-.008*(1-across),-.012],rim);
 // Low temporal follicles must not launch almost horizontally across the ear.
 return mix(d,[side*.012,-.095,-.042],temple);
}
export function u07Profile(root,r){
 const c=root.chartP||root.p,p=root.p,id=root.bundleId||bundleOf(root,r),side=c[0]-r.partMM*.001<0?-1:1;
 const field=.5+.5*Math.sin(c[0]*53+c[2]*31),variation=(field-.5)*.024;
 let route,hem,layer;
 if(id.startsWith('bang')||id.startsWith('frame')){
  hem=-.030+variation;layer='ear-swept-front-long';
  route=[[side*.083,.344,.077],[side*.095,.314,.034],[side*.100,.284,-.012],[side*.113,.205,-.027],[side*.142,.115,-.060],[side*.162,hem,-.100]];
 }else if(id.startsWith('outer')||id.startsWith('under')){
  const depth=clamp((c[2]+.027)/.072,0,1),under=id.startsWith('under');
  hem=(under?-.035:-.050)+variation;layer=under?'retained-long-inner':'side-long-overlay';
  route=[[side*(.098+.008*(1-depth)),.322,-.016+depth*.035],[side*.112,.270,-.027],[side*.126,.200,-.047],[side*.153,.105,-.094],[side*(under?.158:.174),hem,-.132+depth*.020]];
 }else if(id.startsWith('back')){
  const x=clamp(c[0]*1.48,-.136,.136);hem=-.075+variation;layer='inferred-posterior-long';
  route=[[x,.306,-.111],[x*1.09,.242,-.125],[x*1.16,.160,-.137],[x*1.19,.075,-.147],[x*1.16,hem,-.151]];
 }else{
  const x=clamp(c[0]*1.38,-.125,.125);hem=-.035+variation;layer='inferred-nape-long';
  route=[[x,Math.min(.272,p[1]-.008),-.092],[x*1.13,.190,-.119],[x*1.20,.090,-.142],[x*1.18,hem,-.146]];
 }
 if(id.startsWith('bang')||id.startsWith('frame')||id.startsWith('outer')||id.startsWith('under')){
  const{temple}=u07RootWeights(c);
  // Root-relative anterior ear clearance: descend first, then smoothly join
  // the unchanged long-layer route below aligned Y=.205. Root and tip stay put.
  route=route.map(q=>{const w=temple*smooth((q[1]-.205)/.080),drop=Math.max(0,p[1]-q[1]),x=side*clamp(Math.abs(p[0])+.003+drop*.12,.080,.110),z=p[2]-.003-drop*.18;return[q[0]+(x-q[0])*w,q[1],q[2]+(z-q[2])*w];});
 }
 const target=route.at(-1),waypoint=route[0];
 return{kind:'body',bundleId:id,clumpId:root.clumpId,rootGroup:id,pathGroups:[id],sign:side,layer,lengthLayer:{hem,graduation:0,curlScale:1,layer,profile:U07_LENGTH_PROFILE.schema},curlScale:1,evidence:id.startsWith('back')||id==='nape'?'hidden geometry inferred':'visible flow category; root paths authored',outlineAccent:false,tipVariationMM:variation*1000,target,waypoint,route,hem,central:false,referenceStudy:U07_LONG_STUDY.id};
}
