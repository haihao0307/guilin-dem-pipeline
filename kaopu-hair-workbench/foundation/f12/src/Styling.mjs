import {clumpRule} from './ClumpRules.mjs';
import {clamp,smooth} from './approved/LegacyFoundation.mjs';
import {partCenter} from './CrownFlow.mjs';
export const DEFAULT_STYLING=Object.freeze({schema:'kaopu/hair-styling-map@1',product:'wax',strength:.65,zones:{part:.90,crown:.85,fringe:.72,tip:.25},overrides:[]});
export const PRODUCTS=Object.freeze({free:{label:'自然未定型',shape:0,bend:0,twist:0,cohesion:0,damping:0,windSuppression:0},wax:{label:'柔性发泥',shape:.78,bend:.72,twist:.65,cohesion:.74,damping:.62,windSuppression:.72},gel:{label:'较强凝胶',shape:.97,bend:.95,twist:.92,cohesion:.95,damping:.82,windSuppression:.90}});
for(const p of Object.values(PRODUCTS))Object.freeze(p);Object.freeze(DEFAULT_STYLING.zones);Object.freeze(DEFAULT_STYLING.overrides);
export function validateStyling(raw){
 if(raw?.schema!==DEFAULT_STYLING.schema||!PRODUCTS[raw.product]||!Number.isFinite(raw.strength)||raw.strength<0||raw.strength>1||Object.keys(raw).some(k=>!['schema','product','strength','zones','overrides'].includes(k)))throw Error('定型方案无效');
 if(!raw.zones||Object.keys(raw.zones).sort().join(',')!=='crown,fringe,part,tip'||Object.values(raw.zones).some(v=>!Number.isFinite(v)||v<0||v>1)||!Array.isArray(raw.overrides)||raw.overrides.length>100)throw Error('局部定型区域无效');
 const ids=new Set();for(const o of raw.overrides){if(typeof o.clumpId!=='string'||!/^[-a-z]+\/[0-9]+$/.test(o.clumpId)||ids.has(o.clumpId)||Object.keys(o).sort().join(',')!=='clumpId,end,start,strength'||[o.start,o.end,o.strength].some(v=>!Number.isFinite(v)||v<0||v>1)||o.start>=o.end)throw Error('独立发束定型范围无效');const [patch,index]=o.clumpId.split('/'),rule=clumpRule(patch,{partMM:5});if(!rule||Number(index)>=rule.count)throw Error('独立发束不存在');ids.add(o.clumpId);}
 return structuredClone(raw);
}
export function prepareStyling(chartP,clumpId,recipe,styling=DEFAULT_STYLING){
 const c=chartP||[0,.33,0],r=recipe||{partMM:5},part=Math.exp(-Math.pow((c[0]-partCenter(c[2],r))/.012,2))*smooth((c[1]-.33)/.045),crown=smooth((c[1]-.335)/.045),fringe=clumpId?.startsWith('bang')?1:0;
 return {styling,product:PRODUCTS[styling.product],part,crown,fringe,override:styling.overrides.find(o=>o.clumpId===clumpId)};
}
export function regionalHold(s,length,context){
 const {styling,part,crown,fringe,override}=context,u=length>0?clamp(s/length,0,1):0;
 const weights={part:part*(1-smooth((s-.035)/.045))*styling.zones.part,crown:crown*(1-smooth((s-.055)/.070))*styling.zones.crown,fringe:fringe*smooth(u/.12)*(1-.40*smooth((u-.7)/.3))*styling.zones.fringe,tip:(1-fringe)*smooth((u-.72)/.22)*styling.zones.tip};
 let region=Math.max(...Object.values(weights));if(override){const fade=Math.min(.06,(override.end-override.start)/3),mask=smooth((u-override.start)/fade)*(1-smooth((u-override.end+fade)/fade));region=region*(1-mask)+override.strength*mask;}
 return {region,applied:context.styling.product==='free'?0:region*styling.strength,weights};
}
export function motionWeights(s,length,kind='body',freedom=.8,context){
 const root=s<1e-9,u=length>0?clamp(s/length,0,1):0,near=1-smooth((s-.012)/.020),fringe=kind==='fringe',c=context||prepareStyling(null,null,null),hold=regionalHold(s,length,c),p=c.product,h=hold.applied;
 const shapeHold=root?1:Math.max(near*.98,(fringe?.52:.28)*(1-u)+(fringe?.18:.06)*u,h*p.shape),bendHold=root?1:Math.max(near*.97,fringe?.45:.25,h*p.bend),twistHold=root?1:Math.max(near*.98,.30-.14*u,h*p.twist),clumpHold=root?1:Math.max(.28-.13*u,h*p.cohesion),mobility=root?0:(1-shapeHold)*freedom,windInfluence=root?0:(1-near*.98)*(1-h*p.windSuppression),dampingWeight=root?1:Math.max(.12,h*p.damping);
 return {rootPin:root?1:0,shapeHold,bendHold,twistHold,sectionHold:root?1:Math.max(near*.95,.48,h*.90),clumpHold,mobility,productHold:h,regionalHold:hold.region,windInfluence,dampingWeight,maxTwistDegrees:root?0:(fringe?7:18)*smooth(u)*freedom*(1-near*.9)*(1-h*.8),maxDisplacementMM:root?0:(fringe?8:35)*smooth(u)*freedom*(1-near*.9)*(1-h*.85)};
}
