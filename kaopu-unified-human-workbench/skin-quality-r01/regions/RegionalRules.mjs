export const REGION_VERSION='regional-skin/r02';
export const REGION_SCHEMA='kaopu/regional-skin@1';
export const FIELDS=Object.freeze([
 ['lipDryness','唇红表面干燥',0,1,.05],
 ['lipBorderBlend','唇缘油膜渐退',0,1,.05],
 ['orbitalMicrorelief','眼周微起伏保留',0,1,.05],
 ['orbitalRoughness','眼周粗糙度偏置',-.08,.12,.01],
 ['alarOil','鼻翼局部油膜',0,1,.05]
]);
// Authoring coefficients. They are not measured physiology or clinical values.
export const DEFAULTS=Object.freeze({enabled:true,lipFiltering:true,lipDryness:.55,lipBorderBlend:.65,orbitalMicrorelief:.72,orbitalRoughness:.025,alarOil:.25});
export function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid regional skin settings');
 const out={...DEFAULTS,...input};for(const k of Object.keys(out))if(!(k in DEFAULTS))throw Error('Unknown regional setting '+k);
 for(const k of ['enabled','lipFiltering'])if(typeof out[k]!=='boolean')throw Error('Invalid regional switch '+k);
 for(const[k,,lo,hi]of FIELDS)if(!Number.isFinite(out[k])||out[k]<lo||out[k]>hi)throw Error('Regional setting outside range '+k);
 return out;
}
const clamp=x=>Math.max(0,Math.min(1,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
// Same equations as the shader, for range/semantic validation, not a renderer.
export function regionalMasks({face=0,cover=0,type=0,lip=0,thin=0,nose=0,x=0,y=0,ala=[[-10,270],[10,270]],eyes=[[-32,300,20,13],[32,300,20,13]]}){
 const gate=clamp(face)*clamp(cover)*(type<.5?1:0),l=clamp(lip),core=l*smooth(.15,.85,l),border=4*l*(1-l);
 const alar=Math.max(...ala.map(p=>Math.exp(-(((x-p[0])/4.5)**2+((y-p[1])/5.5)**2))))*clamp(nose);
 const window=1-smooth(.75,1.35,Math.min(...eyes.map(p=>Math.hypot((x-p[0])/p[2],(y-p[1])/p[3]))));
 return {gate,core:core*gate,border:border*gate,orbital:clamp(thin)*gate*window,alar:alar*gate};
}
export function lipFilterGain(dx,dy){return Math.exp(-(dx*dx+dy*dy)/24);}
export function response(roughness,coat,coatRoughness,m,s,oilMaster=1){
 if(!s.enabled)return {roughness,coat,coatRoughness};
 const oil=s.alarOil*oilMaster*m.alar,delta=.13*s.lipDryness*m.core+.05*s.lipBorderBlend*m.border+s.orbitalRoughness*m.orbital-.035*oil;
 const bounded=(v,a,b)=>Math.max(a,Math.min(b,v));
 return {roughness:bounded(roughness+delta,.24,.95),coat:bounded(coat*(1-.65*s.lipDryness*m.core-.55*s.lipBorderBlend*m.border)+.10*oil,0,.65),coatRoughness:bounded(coatRoughness+.10*s.lipDryness*m.core+.07*s.lipBorderBlend*m.border,.23,.6)};
}
