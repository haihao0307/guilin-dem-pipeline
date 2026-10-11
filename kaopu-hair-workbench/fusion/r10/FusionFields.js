/** R10 shared authored controls. References are recorded in RESEARCH.md.
 * Units: GNM metres. These are editable grooming masks, not anatomical labels.
 * Roots remain triangle+barycentric attachments; never move a root in a shader.
 */
export const CONTROL_GROUPS = {
 scalp: [
 ['hairLeftCoverage','人物左侧密度',0,100,1,100],
 ['hairRightCoverage','人物右侧密度',0,100,1,100],
 ['hairCrownCoverage','头顶密度',0,100,1,100],
 ['hairEarCoverage','耳周 / 耳后密度',0,100,1,100],
 ['hairNapeCoverage','后颈密度',0,100,1,95],
 ['hairTempleRecession','鬓角退缩',-100,100,1,0],
 ['hairEdgeSoftness','发际线渐变',0,100,1,55],
 ['hairSideLength','侧面长度比例',25,140,1,85],
 ['hairNapeLength','后颈长度比例',20,140,1,60],
 ['hairPart','侧分位置',-100,100,1,0],
 ['hairWhorlX','发旋左右位置',-100,100,1,0],
 ['hairWhorlZ','发旋前后位置',-100,100,1,0],
 ['hairWhorl','发旋强度',0,100,1,94],
 ['hairShortFlow','短发前梳 / 侧梳',-100,100,1,20],
 ['hairClump','发束聚合',0,100,1,34],
 ['hairFrizz','细丝不规则度',0,100,1,12],
 ['hairFlyaways','轮廓散发',0,100,1,25],
 ['hairRootFine','边缘细发比例',0,100,1,65]
 ],
 beard: [
 ['beardJawCoverage','下颌覆盖',0,100,1,90],
 ['beardCheekCoverage','脸颊覆盖',0,100,1,78],
 ['beardSideburnCoverage','鬓须覆盖',0,100,1,82],
 ['beardSoftness','须区边界渐变',0,100,1,65],
 ['beardCurl','弯曲不规则度',0,100,1,32],
 ['beardVariation','长短 / 粗细差异',0,100,1,60],
 ['beardRoughness','胡须粗糙度',20,85,1,58]
 ]
};
export const FUSION_DEFAULTS=Object.fromEntries(Object.values(CONTROL_GROUPS).flat().map(([k,l,min,max,step,d])=>[k,d]));
export const fusion={...FUSION_DEFAULTS};
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
export const normalize=v=>{const d=Math.hypot(...v);return d>1e-10?v.map(x=>x/d):[0,-1,0]};
export function setFusion(values){const changed=[];for(const [k,def] of Object.entries(FUSION_DEFAULTS)){if(values[k]===undefined)continue;const row=Object.values(CONTROL_GROUPS).flat().find(r=>r[0]===k);if(!Number.isFinite(values[k]))throw Error('Invalid regional parameter '+k);const v=clamp(values[k],row[2],row[3]);if(v!==fusion[k])changed.push(k);fusion[k]=v}return changed}
export function regionWeights([x,y,z]){
 const side=smooth(.039,.076,Math.abs(x))*(1-smooth(.328,.365,y));
 const nape=(1-smooth(.275,.314,y))*(1-smooth(-.048,-.007,z));
 const ear=side*Math.exp(-((z+.002)/.046)**2)*(1-smooth(.307,.340,y));
 const crown=smooth(.334,.365,y);
 const left=smooth(-.012,.012,x),temple=side*smooth(.018,.070,z)*(1-smooth(.304,.347,y));
 return {side,nape,ear,crown,left,temple};
}
export function regionalDensity(p,margin){
 const w=regionWeights(p),sideDensity=(fusion.hairLeftCoverage*w.left+fusion.hairRightCoverage*(1-w.left))/100;
 const edgeWidth=.002+fusion.hairEdgeSoftness*.00013;
 const retreat=fusion.hairTempleRecession*.000045*w.temple;
 return smooth(.0001,edgeWidth,margin-retreat)*(1-w.side*(1-sideDensity))*(1-w.crown*(1-fusion.hairCrownCoverage/100))*(1-w.ear*(1-fusion.hairEarCoverage/100))*(1-w.nape*(1-fusion.hairNapeCoverage/100));
}
export function regionalLength(p){const w=regionWeights(p);return (1-w.side+w.side*fusion.hairSideLength/100)*(1-w.nape+w.nape*fusion.hairNapeLength/100)}
/** No rounded grid cells: the short field is continuous across crown / temples.
 * The front/back vector cancellation in the older short field is replaced by
 * an off-centre crown field and a smooth regional downward flow.
 */
export function shortDirection(p,progress,random){
 const [x,y,z]=p,w=regionWeights(p),wx=x-(.018+fusion.hairWhorlX*.00025),wz=z-(-.028+fusion.hairWhorlZ*.00025);
 const swirl=fusion.hairWhorl/100*.38;
 let d=normalize([wx-swirl*wz,-.012,wz+swirl*wx]);
 const front=smooth(.006,.078,z),turn=fusion.hairShortFlow/100;
 const frontal=normalize([turn*.65,-.14,1]);
 d=d.map((v,k)=>v*(1-front*.85)+frontal[k]*front*.85);
 const lower=Math.max(w.side,w.nape)*(1-smooth(.316,.356,y));
 const downward=[x*.4,-1,-.18];d=d.map((v,k)=>v*(1-lower)+downward[k]*lower);
 d[0]+=(random-.5)*.025;
 return normalize(d);
}
export function beardDirection(p,zone){
 const [x,y,z]=p,s=x<0?-1:1;
 const local=.12*Math.sin(x*47+y*39)*Math.cos(z*61);
 if(zone===1)return normalize([s*(.4+.2*smooth(0,.026,Math.abs(x))),-.85,0]);
 if(zone===4)return normalize([s*.04,-1,-.12]);
 if(zone===3)return normalize([s*(.12+.12*smooth(.235,.28,y))+local,-1,-.08]);
 if(zone===2)return normalize([-s*.10+local,-1,.05]);
 return normalize([x*1.8+local,-1,.06]);
}
export function beardBoundary(weight,p){const softness=fusion.beardSoftness/100;return Math.pow(clamp(weight),.7+softness*.8)*( .88+.12*Math.sin(p[0]*137+p[1]*93)*Math.sin(p[2]*117-p[1]*76));}
