/** Offline double-precision transcription of the extracted timber field algebra.
 * Test/reference ONLY. Rendering uses the exact GLSL functions, not this file.
 * Source fwidth is zero here (infinitesimal footprint); the receiver's physical
 * footprint fade remains active. No claim of bit-exact Float32 GPU parity.
 */
import {TIMBER_CAPTURED_PARAMETERS as U} from './sources/timber-field-source.mjs';
import {adaptHostedMaterialParameters} from './material.mjs';
const PI=Math.PI,TAU=2*PI,fract=x=>x-Math.floor(x),clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a*(1-t)+b*t;
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
const seed=U.u_seed;
function hash31(p){p=p.map((x,i)=>fract(x*.1031+seed*[13.71,47.13,91.77][i]));const d=p[0]*(p[1]+33.33)+p[1]*(p[2]+33.33)+p[2]*(p[0]+33.33);p=p.map(x=>x+d);return fract((p[0]+p[1])*p[2]);}
function noise(p){const i=p.map(Math.floor),f=p.map(fract).map(x=>x*x*(3-2*x)),h=(x,y,z)=>hash31([i[0]+x,i[1]+y,i[2]+z]);return mix(mix(mix(h(0,0,0),h(1,0,0),f[0]),mix(h(0,1,0),h(1,1,0),f[0]),f[1]),mix(mix(h(0,0,1),h(1,0,1),f[0]),mix(h(0,1,1),h(1,1,1),f[0]),f[1]),f[2]);}
function fbm(p){let result=0,a=.5;for(let i=0;i<5;i++){result+=a*noise(p);const[x,y,z]=p;p=[(-.8*y-.6*z)*2.03+7.1,(.8*x+.36*y-.48*z)*2.03+3.7,(.6*x-.48*y+.64*z)*2.03+5.9];a*=.5;}return result;}
const sine=x=>.5+.5*Math.sin(TAU*x),thin=(x,w)=>1-smooth(w,w+.085,Math.abs(Math.sin(PI*x))),ridge=x=>1-Math.abs(x*2-1);
const across=(g,n)=>Math.abs(n[1])>Math.abs(n[2])?g[2]:g[1],depth=(g,n)=>Math.abs(n[1])>Math.abs(n[2])?g[1]:g[2];
const sidePhase=(g,n,m)=>across(g,n)*U.u_fiberFrequency*m;
function sideNoise(g,n,a,c,p,full=true){return (full?fbm:noise)([g[0]*a+p,across(g,n)*c+seed*(full?4.7:6.3),depth(g,n)*(full?.72:.54)+seed*(full?9.1:3.8)]);}
function knot(g,n){return smooth(.71,.91,sideNoise(g,n,.34,1.35,U.u_knotPhase+8))*smooth(.58,.86,sideNoise(g,n,.72,2.25,U.u_knotPhase*.37+17,false));}
function woodSignals(g,n){
 const cross=Math.abs(n[0])>=.72?1:0;
 const driftY=fbm([g[0]*.24+seed*3.1,1.17,7.93])-.5,driftZ=fbm([g[0]*.21-seed*4.7,9.31,2.41])-.5;
 const cp=[g[1]+U.u_pithOffset[0]+driftY*U.u_ringWarp*.115,g[2]+U.u_pithOffset[1]+driftZ*U.u_ringWarp*.115],theta=Math.atan2(cp[1],cp[0]);
 const oval=.075*Math.sin(seed*31+U.u_angleOffset),rp=[cp[0]*(1+oval),cp[1]*(1-oval)],radial=Math.hypot(...rp);
 const rn=fbm([g[0]*.18+seed*2.4,rp[0]*2.2,rp[1]*2.2]);
 const rc=radial*U.u_ringFrequency*U.u_ringScale+(rn-.5)*U.u_ringWarp*1.18+Math.sin(theta*2+seed*13)*.12*U.u_ringWarp+Math.sin(theta*5-seed*7)*.045*U.u_ringWarp;
 const ring=clamp(sine(rc+(rn-.5)*.16)*.62+thin(rc,.06)*.38);
 const broad=sideNoise(g,n,.18,1.55,U.u_angleOffset),flow=sideNoise(g,n,.42,3.35,seed*11+2.4),medium=sideNoise(g,n,.88,7.20,seed*17+4.7),k=knot(g,n);
 const warp=(broad-.5)*5.4+(flow-.5)*2.9+Math.sin(g[0]*.58+theta*1.7+seed*19)*.5+k*(4+1.6*Math.sin(g[0]*1.05+U.u_knotPhase));
 const coarse=clamp(broad*.47+ridge(flow)*.31+thin(sidePhase(g,n,.58)+warp+U.u_angleOffset/TAU,.065)*.22);
 const med=clamp(medium*.47+ridge(flow*.62+medium*.38)*.37+thin(sidePhase(g,n,1.85)+warp*1.72+seed*7,.04)*.16);
 const crackGate=smooth(.79,.94,sideNoise(g,n,.32,3.1,U.u_crackPhase+13,false));
 const sideCrack=thin(sidePhase(g,n,.17)+warp*.16+U.u_crackPhase/TAU,.014)*crackGate;
 const radialGate=smooth(.72,.93,noise([radial*1.9,g[0]*.27,seed*9]));
 const radialCrack=Math.max(0,Math.sin(theta*7+U.u_crackPhase))**26*smooth(.08,.27,radial)*radialGate;
 return [ring,coarse,med,mix(sideCrack,Math.max(sideCrack*.12,radialCrack),cross)];
}
function secondarySignals(g,n){
 const broad=sideNoise(g,n,.46,4.4,seed*21+1.7),fine=sideNoise(g,n,1.55,18*Math.max(U.u_detailFineness,.45),seed*29+5.3);
 const fineLine=thin(sidePhase(g,n,4.6*Math.max(U.u_detailFineness,.45))+(broad-.5)*8.5+seed*19,.026);
 const fineFiber=clamp(fine*.53+ridge(fine)*.30+fineLine*.17);
 const pores=smooth(.865,.982,sideNoise(g,n,4.2*Math.max(U.u_detailFineness,.45),38*Math.max(U.u_detailFineness,.45),seed*23+11,false))*smooth(.52,.82,sideNoise(g,n,.85,7,seed*31+2,false));
 const tool=sine(g[0]*1.45+across(g,n)*.22+U.u_toolPhase/TAU)*smooth(.79,.96,sideNoise(g,n,.54,2.3,U.u_toolPhase+5,false));
 return [fineFiber,pores,tool,knot(g,n)];
}
export function sampleTimberReference(positionMetres,normal,footprintMetres=.00012,parameters={}){
 if(![positionMetres,normal].every(a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite))||!Number.isFinite(footprintMetres)||footprintMetres<0||Math.hypot(...normal)<1e-12)throw Error('Finite metre coordinates, nonzero normal and nonnegative footprint required');
 const p=adaptHostedMaterialParameters(parameters),g=positionMetres.map(x=>x*p.woodScale),len=Math.hypot(...normal),n=normal.map(x=>x/len),fp=Math.max(footprintMetres,.00012);
 const[ring,coarse,medium,cracks]=woodSignals(g,n),[fine,pores,tool,k]=secondarySignals(g,n),macro=fbm(g.map((x,i)=>x*[.12,.7,.7][i]+seed*5));
 const cross=Math.abs(n[0])>=.72?1:0,cp=[g[1]+U.u_pithOffset[0],g[2]+U.u_pithOffset[1]],radial=Math.hypot(...cp),endRay=sine(Math.atan2(cp[1],cp[0])*3/TAU+radial*2+seed*7);
 const sideTone=(coarse-.5)*1.02+(medium-.5)*.43+(macro-.5)*.56+(fine-.5)*.11+k*.26-cracks*.70-pores*.08;
 const endTone=(ring-.5)*1.08+(endRay-.5)*.19+(macro-.5)*.38-cracks*.72-pores*.05;
 const gm=clamp(.5+(mix(sideTone,endTone,cross)+U.u_colorBias)*U.u_grainContrast*2.72);
 let base=U.u_agedSurfaceColor.map((c,i)=>mix(c,mix(U.u_lightGrainColor[i],U.u_darkGrainColor[i],gm),.78));
 if(cross)base=base.map((c,i)=>mix(c,U.u_freshCutColor[i],.2));
 base=base.map((c,i)=>clamp(mix(c*(.905+macro*.19),U.u_cavityColor[i],cracks*.40+pores*.065+k*.025)));
 const sideMicro=(coarse-.5)*.32+(medium-.5)*.24+(fine-.5)*.12-pores*.30-cracks*.94-tool*.13+k*.09;
 const endMicro=(ring-.5)*.34+(fine-.5)*.05-pores*.22-cracks;
 const h=mix(sideMicro,endMicro,cross)*p.woodReliefM*U.u_reliefScale*(1-smooth(.00035,.004,fp));
 return {baseColor:base,roughness:clamp(p.woodRoughness+pores*.045+cracks*.075+(.5-macro)*.022-p.woodClearcoat*.085,.18,.98),metallic:0,height:clamp(h,-.001,.001),clearcoat:p.woodClearcoat,clearcoatRoughness:p.woodClearcoatRoughness,signals:{ring,coarse,medium,cracks,fine,pores,tool,knot:k,macro},units:'metres'};
}
export function samplePaintReference(positionMetres,normal,paintColor,footprintMetres=.00012,parameters={}){
 const wood=sampleTimberReference(positionMetres,normal,footprintMetres,parameters),p=adaptHostedMaterialParameters(parameters),g=positionMetres,gate=1-smooth(.0003,.0015,Math.max(footprintMetres,.00012));
 const orange=Math.sin(g[0]*TAU/.0017)*Math.sin(g[1]*TAU/.0011)*.5,brush=Math.sin(g[1]*TAU/.0031+Math.sin(g[0]*TAU/.12)*.12)*.5;
 return {baseColor:paintColor.map(x=>clamp(x)),roughness:clamp(p.paintRoughness+orange*.035*gate,.08,.98),metallic:0,height:wood.height*.12+(orange*.65+brush*.35)*p.paintReliefM*gate,clearcoat:p.paintClearcoat,clearcoatRoughness:p.paintClearcoatRoughness,units:'metres'};
}
export function materialReferenceNormal(sample,point,normal,epsilonMetres=.0008){
 const norm=a=>{const l=Math.hypot(...a);return a.map(x=>x/l);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],n=norm(normal),t=norm(cross(n,Math.abs(n[1])<.9?[0,1,0]:[1,0,0])),b=cross(n,t),h=sample(point).height;
 const d1=clamp((sample(point.map((x,i)=>x+t[i]*epsilonMetres)).height-h)/epsilonMetres,-.3,.3),d2=clamp((sample(point.map((x,i)=>x+b[i]*epsilonMetres)).height-h)/epsilonMetres,-.3,.3);
 return norm(n.map((x,i)=>x-d1*t[i]-d2*b[i]));
}
