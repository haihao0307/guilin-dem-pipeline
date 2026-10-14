import DATA from './TissueLayers.json';
export const TISSUE_DATA=DATA;
export const BAND_COEFFICIENTS=DATA.bandsNM.map((nm,i)=>({nm,
 baseline:(.244+85.3*Math.exp(-(nm-154)/66.2))/10,
 melanosome:6.6e11*nm**-3.33/10,
 scatter:(2e5*nm**-1.5+2e12*nm**-4)/10,
 oxy:2.303*DATA.hemoglobin.molarExtinctionOxy[i]*150/64500/10,
 deoxy:2.303*DATA.hemoglobin.molarExtinctionDeoxy[i]*150/64500/10
}));
// Original finite-slab two-flux implementation. K=mu_a, S=mu_s'/2 is a
// deliberately documented two-stream closure, not Monte Carlo equivalence.
export function slab(K,S,mm){
 if(![K,S,mm].every(Number.isFinite)||K<0||S<0||mm<0)throw Error('Invalid optical slab');
 if(mm===0)return{R:0,T:1};
 if(S<1e-12)return{R:0,T:Math.exp(-K*mm)};
 if(K<1e-12)return{R:S*mm/(1+S*mm),T:1/(1+S*mm)};
 const a=1+K/S,b=Math.sqrt(a*a-1),x=b*S*mm,e=Math.exp(-x),den=a+b-(a-b)*e*e;
 return{R:(1-e*e)/den,T:2*b*e/den};
}
export function adding(top,bottom){const d=Math.max(1e-12,1-top.R*bottom.R);return{R:top.R+top.T*top.T*bottom.R/d,T:top.T*bottom.T/d};}
export function reflectance({melanin=.04,blood=.025,deepBlood=.002,thickness=1,epidermis=1,oxygen=.75,lip=false}={}){
 return BAND_COEFFICIENTS.map(c=>{const hb=c.oxy*oxygen+c.deoxy*(1-oxygen),base=c.baseline,S=c.scatter/2;
 const backing=slab(base+(lip?.025:.0008)*hb,S*(lip?.58:.58),lip?3:2.2);
 const reticular=slab(base+deepBlood*hb,S*.88,(lip?.85:1.1)*thickness);
 const papillary=slab(base+blood*hb,S,lip?.25:.2);
 const epi=slab(base+melanin*c.melanosome,S*.72,(lip?.12:.065)*epidermis);
 const corneum=slab(base,S*.45,lip?.004:.014);
 return adding(corneum,adding(epi,adding(papillary,adding(reticular,backing)))).R;
 });
}
const v=a=>'vec3('+a.map(x=>Number(x).toPrecision(10)).join(',')+')';
export const COEFFICIENT_GLSL=`const vec3 lsBase=${v(BAND_COEFFICIENTS.map(c=>c.baseline))};
const vec3 lsMel=${v(BAND_COEFFICIENTS.map(c=>c.melanosome))};
const vec3 lsScattering=${v(BAND_COEFFICIENTS.map(c=>c.scatter))};
const vec3 lsOxy=${v(BAND_COEFFICIENTS.map(c=>c.oxy))};
const vec3 lsDeoxy=${v(BAND_COEFFICIENTS.map(c=>c.deoxy))};`;
