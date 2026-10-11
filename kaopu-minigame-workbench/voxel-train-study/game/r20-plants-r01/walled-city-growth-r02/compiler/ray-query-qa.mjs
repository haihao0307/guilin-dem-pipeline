import {querySettlement,querySettlementRay} from './kernel.mjs';
/** CPU macro-only reproduction of five actual X-view exhausted pixels.
 * The shader's mature mother fields still require GPU revalidation. No step
 * multiplier, hit tolerance, section plane or ray budget is changed here.
 */
const eye=[60,37,-55],target=[-11,17,0],norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],forward=norm(target.map((v,i)=>v-eye[i])),right=norm(cross(forward,[0,1,0])),up=norm(cross(right,forward));
export const RAY_FIXTURES=[[206,93],[210,93],[218,93],[219,93],[220,93]].map(pixel=>{const uv=[((pixel[0]+.5)/480*2-1)*1.5,-((pixel[1]+.5)/320*2-1)];return {pixel,eye:[...eye],rd:norm(forward.map((v,i)=>v+.54*(right[i]*uv[0]+up[i]*uv[1])))};});
export function traceMacro(recipe,fixture,{directional=false,stoneUpperM=.002,maxSteps=1024}={}){
 let t=.01,previous=1e6,last=null,queries=0;const histogram={};
 for(let step=0;step<maxSteps;step++){
  const p=fixture.eye.map((v,i)=>v+fixture.rd[i]*t),h=directional?querySettlementRay(recipe,p,600,fixture.rd,stoneUpperM):querySettlement(recipe,p,600),d=Math.max(h.d,p[0]+6.4);queries++;histogram[h.componentId]=(histogram[h.componentId]??0)+1;last={p,t,macroDistance:h.d,sectionDistance:d,componentId:h.componentId,materialId:h.materialId,stateId:h.stateId};
  if(h.materialId>0&&(Math.abs(d)<.00055||(d<0&&previous>0&&previous<1e5)))return {status:'hit',queries,last,histogram};
  previous=d;t+=Math.min(4,Math.max(.00018,Math.abs(d)*.64));if(t>220)return {status:'miss',queries,last,histogram};
 }
 return {status:'exhausted',queries,last,histogram};
}
export function auditRayQueries(recipe){return {scope:'macro-only CPU query acceleration; mature displaced field and actual GPU pixels remain receiver validation',condition:'rd.y>=0 and p.y>top+stoneUpperM; top bound encloses the whole floor/roof/ground entity',stoneUpperM:.002,shaderSlateUpperM:.0123*.1235294118,unchangedMarch:{multiplier:.64,minimumM:.00018,maximumM:4,hitToleranceM:.00055,budget:1024,cut:[1,0,0,-6.4]},rays:RAY_FIXTURES.map(f=>({...f,before:traceMacro(recipe,f),after:traceMacro(recipe,f,{directional:true})}))};}
export function pointRegressionValues(recipe){const out=[];for(let i=0;i<768;i++){const p=[((i*37)%273-136)*.25,((i*17)%189)*.25+.003,((i*53)%185-92)*.25];out.push(querySettlement(recipe,p,600));}for(const b of recipe.buildings)for(const f of [0,Math.min(2,b.floors-1),b.floors-1]){const y=f?b.groundRise+(f-1)*b.rise:0;for(const dy of [-.09,.001,.003,.04,1.2])out.push(querySettlement(recipe,[b.x,y+dy,b.z],600));}return out;}
