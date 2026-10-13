// Test-only scalar/double reference of the locked STONE_STUDY kind-2 branch.
// No production import uses this file. CPU double hash values are not GPU
// float32 fixtures: use granite-source-reference.glsl for GPU point parity.
export const params = Object.freeze({ scaleM:.026, sourceScale:1, mineral:.7, chroma:1, relief:1, colorSeed:8632, poreSeed:8538, weatherSeed:8832 });
const add=(a,b)=>a.map((x,i)=>x+(Array.isArray(b)?b[i]:b));
const mul=(a,b)=>a.map(x=>x*b);
const fract=x=>x-Math.floor(x);
export const mix=(a,b,t)=>a*(1-t)+b*t;
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function hash33(p0){let p=p0.map((x,i)=>fract(x*[.1031,.1030,.0973][i]));const d=p[0]*(p[1]+33.33)+p[1]*(p[0]+33.33)+p[2]*(p[2]+33.33);p=add(p,d);return [fract((p[0]+p[1])*p[2]),fract((p[0]+p[0])*p[1]),fract((p[1]+p[0])*p[0])];}
export function valueNoise3(p){const i=p.map(Math.floor),f=p.map(x=>{const t=fract(x);return t*t*t*(t*(t*6-15)+10);}),v=(x,y,z)=>hash33(add(i,[x,y,z]))[0];return mix(mix(mix(v(0,0,0),v(1,0,0),f[0]),mix(v(0,1,0),v(1,1,0),f[0]),f[1]),mix(mix(v(0,0,1),v(1,0,1),f[0]),mix(v(0,1,1),v(1,1,1),f[0]),f[1]),f[2]);}
export const seedVector=(seed,salt)=>mul(hash33([seed*.001,salt,seed*.00013]),49);
export const sf=p=>valueNoise3(p)*.57+valueNoise3(add(mul(p,2.07),13.7))*.28+valueNoise3(add(mul(p,4.11),27.2))*.15;
const seed=seedVector(params.colorSeed,.071),pore=seedVector(params.poreSeed,.061),weatherSeed=seedVector(params.weatherSeed,.09);
export const warp=p=>add(p,[0,7,19].map(o=>sf(add(add(mul(p,.8),seed),o))*.25));
export function scell(p){const ip=p.map(Math.floor),fp=p.map(fract);let md=100,id=[0,0,0];for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){const off=[x,y,z],ix=add(ip,off),v=add(add(off,hash33(ix)),mul(fp,-1)),d=v.reduce((s,x)=>s+x*x,0);if(d<md){md=d;id=ix;}}return [...hash33(add(id,3.4)),Math.sqrt(md)];}
export const pitNoise=p=>Math.max(0,(sf(p)-.57)/.43)**2;
export function fields(pLocalM){const q=warp(mul(pLocalM,params.sourceScale/params.scaleM));return {q,crystal:scell(add(mul(q,13),seed)),broad:sf(add(mul(q,1.35),seed)),grain:valueNoise3(add(mul(q,49),seed)),pits:pitNoise(add(mul(q,19),pore))};}
export const heightFromFields=f=>((f.crystal[1]-.5)*.003+(f.broad-.5)*.009+(f.grain-.5)*.00035-f.pits*.007)*params.relief*params.scaleM;
export const height=p=>heightFromFields(fields(p));
export const palette=(x,region)=>{const a=smooth(.28,.34,x),b=smooth(.62,.68,x);return [.18,.20,.20].map((d,i)=>mix(mix(d,[.67,.66,.59][i],a),[.73,.49,.41][i],b*.83)*(.80+.29*region));};
export const linear=c=>c.map(x=>x<.04045?x/12.92:((x+.055)/1.055)**2.4);
export function wetAt(sourceWet,weather,pits){const cav=clamp(pits*1.4,0,1);return clamp(sourceWet*(.18+.82*smooth(.32,.75,weather+cav*.25)),0,1);}
export function response(x,region,weather,pits,sourceWet,roughBias){const a=smooth(.28,.34,x),mineral=(1-a*.7)*params.mineral,col=palette(x,region),lum=col[0]*.2126+col[1]*.7152+col[2]*.0722,wet=wetAt(sourceWet,weather,pits);return {albedo:linear(col.map(v=>clamp(mix(lum,v,params.chroma),.025,.95))).map(v=>v*(1-wet*.38)),roughness:clamp(mix(mix(.66,.28,mineral)+roughBias,.17,wet),.12,.98)};}
export function original(p,sourceWet=0,roughBias=0){const f=fields(p);return {height:heightFromFields(f),...response(f.crystal[0],sf(add(mul(f.q,3.2),add(seed,11))),sf(add(mul(f.q,2.2),weatherSeed)),f.pits,sourceWet,roughBias)};}
export function state(age,wet,repair){const a=clamp(age,0,1),r=clamp(repair,0,1),m=clamp(wet,0,1),retainedAge=a*(1-r);return {sourceWet:clamp(m*(.45+.55*retainedAge)*(1-.45*r),0,1),roughBias:.07*retainedAge+.025*.15-.06*r};}
// Original palette expectation for crystal.x ~ Uniform[0,1]. Flat subdomains
// are exact; both original smoothstep transition intervals use 3-node Gauss.
// This is a declared statistical model, not a spatially exact scell integral.
export function meanResponse(region,weather,pits,sourceWet,roughBias){const taps=[[.14,.28],[.48,.28],[.84,.32]];for(const [a,b] of [[.28,.34],[.62,.68]])for(const [t,w] of [[.1127016653792583,5/18],[.5,8/18],[.8872983346207417,5/18]])taps.push([mix(a,b,t),.06*w]);const out={albedo:[0,0,0],roughness:0};for(const [x,w] of taps){const s=response(x,region,weather,pits,sourceWet,roughBias);out.albedo=out.albedo.map((v,i)=>v+s.albedo[i]*w);out.roughness+=s.roughness*w;}return out;}
export function estimatePitMean(side=32){let total=0;for(let z=0;z<side;z++)for(let y=0;y<side;y++)for(let x=0;x<side;x++)total+=pitNoise(add([(x+.5)*.754877666,(y+.5)*.569840296,(z+.5)*.438447187],pore));return total/(side**3);}

export const filterParams=Object.freeze({cellStart:.5,cellEnd:2,octaveStart:.35,octaveEnd:1,pitMean:.01728213205072705,gaussOffset:.2886751345948129});
export function statisticalSf(p,sourceFootprint){let result=.5;for(const [freq,offset,weight] of [[1,0,.57],[2.07,13.7,.28],[4.11,27.2,.15]]){const g=1-smooth(filterParams.octaveStart,filterParams.octaveEnd,sourceFootprint*freq);if(g>0)result+=(valueNoise3(add(mul(p,freq),offset))-.5)*weight*g;}return result;}
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),length=a=>Math.hypot(...a),normalize=a=>mul(a,1/length(a)),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function filtered(pLocalM,normal,age,wet,repair,footprint){const {sourceWet,roughBias}=state(age,wet,repair),fp=Math.max(footprint,0);if(fp===0)return original(pLocalM,sourceWet,roughBias);const n=dot(normal,normal)>1e-20?normalize(normal):[0,1,0],axis=Math.abs(n[2])>.9?[0,1,0]:[0,0,1],tangent=normalize(cross(axis,n)),bitangent=cross(n,tangent),points=Array.from({length:4},(_,i)=>warp(mul(add(pLocalM,mul(add(mul(tangent,(i&1)?1:-1),mul(bitangent,(i&2)?1:-1)),filterParams.gaussOffset*fp)),params.sourceScale/params.scaleM)));const span=Math.max(...[[0,1],[2,3],[0,2],[1,3]].map(([a,b])=>length(add(points[b],mul(points[a],-1))))),sourceFootprint=Math.max(fp/params.scaleM*params.sourceScale,span/(2*filterParams.gaussOffset)),meanWeight=smooth(filterParams.cellStart,filterParams.cellEnd,sourceFootprint*13);let out={height:height(pLocalM),albedo:[0,0,0],roughness:0};for(const q of points){const samples=[];if(meanWeight<1)samples.push([1-meanWeight,response(scell(add(mul(q,13),seed))[0],sf(add(mul(q,3.2),add(seed,11))),sf(add(mul(q,2.2),weatherSeed)),pitNoise(add(mul(q,19),pore)),sourceWet,roughBias)]);if(meanWeight>0)samples.push([meanWeight,meanResponse(statisticalSf(add(mul(q,3.2),add(seed,11)),sourceFootprint*3.2),statisticalSf(add(mul(q,2.2),weatherSeed),sourceFootprint*2.2),filterParams.pitMean,sourceWet,roughBias)]);for(const [weight,s] of samples){out.albedo=out.albedo.map((v,i)=>v+weight*s.albedo[i]*.25);out.roughness+=weight*s.roughness*.25;}}return out;}
