/** Versioned lighting/look state. Calibration knobs are artistic, not skin measurements. */
export const CINE_VERSION='ET20-CINE-R01';
export const CINE_DEFAULTS=Object.freeze({lighting:true,skin:true,preset:'window',keyEV:0,fillStops:2.4,rimStops:1.6,keyAzimuth:-43,keyElevation:24,distance:1.10,width:.75,height:1.10,keyK:5600,fillK:7000,rimK:6500,exposureEV:-.10,ambient:.08,shadow:true,shadowSoftness:2.5,poreGain:1.05,mesoGain:.75,specular:.75,lobeMix:.30,roughnessOffset:.035,fuzz:.07,diffusionScale:.80});
const bounds={keyEV:[-2,2],fillStops:[0,6],rimStops:[-1,5],keyAzimuth:[-100,100],keyElevation:[0,65],distance:[.65,2.5],width:[.20,1.8],height:[.25,2],keyK:[3000,10000],fillK:[3000,10000],rimK:[3000,10000],exposureEV:[-2,2],ambient:[0,.4],shadowSoftness:[0,8],poreGain:[0,2],mesoGain:[0,2],specular:[0,1.5],lobeMix:[0,.8],roughnessOffset:[-.12,.2],fuzz:[0,.25],diffusionScale:[0,1.5]};
export const CINE_PRESETS=Object.freeze({
 neutral:{label:'中性审片',description:'中性白光、开放暗部；用于检查肤色与材质，不是美颜。',values:{...CINE_DEFAULTS,preset:'neutral',keyAzimuth:-25,keyElevation:25,width:1.1,height:1.3,keyK:6500,fillK:6500,rimK:6500,fillStops:1.4,rimStops:2.5,ambient:.1,exposureEV:0}},
 window:{label:'窗侧柔光',description:'大面积侧主光，克制补光；保留鼻颊体积和自然亮暗过渡。',values:{...CINE_DEFAULTS}},
 lowkey:{label:'低调轮廓',description:'主光更侧、暗侧少填充，轮廓光分离头部；不压黑全部皮肤细节。',values:{...CINE_DEFAULTS,preset:'lowkey',keyAzimuth:-65,keyElevation:20,width:.65,height:1.0,fillStops:4.2,rimStops:.6,keyK:5100,fillK:7200,ambient:.015,exposureEV:.12}},
 practical:{label:'暖室内',description:'暖色主光与较冷环境补光，保持明确光源动机。',values:{...CINE_DEFAULTS,preset:'practical',keyAzimuth:38,keyElevation:22,keyK:3600,fillK:6800,rimK:4300,fillStops:2.7,rimStops:1.6,ambient:.045,exposureEV:-.05}}
});
export function validateCine(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid cinematic settings');
 const s={...CINE_DEFAULTS,...input};for(const k of Object.keys(s))if(!(k in CINE_DEFAULTS))throw Error('Unknown cinematic setting: '+k);
 for(const k of ['lighting','skin','shadow'])if(typeof s[k]!=='boolean')throw Error('Invalid toggle '+k);
 if(!Object.hasOwn(CINE_PRESETS,s.preset))throw Error('Unknown lighting preset');
 for(const[k,[a,b]]of Object.entries(bounds))if(!Number.isFinite(s[k])||s[k]<a||s[k]>b)throw Error('Out of range: '+k);return s;
}
export function installCineProfile(model){
 if(model.cineProfile)return model.cineProfile;
 const api={schema:'kaopu/cinematic-look@1',settings:{...CINE_DEFAULTS}},archive=model.archive.bind(model),restore=model.restore.bind(model);
 model.archive=()=>({...archive(),cinematicLook:{schema:api.schema,settings:{...api.settings}}});
 model.restore=input=>{const p=input?.cinematicLook;if(p&&p.schema!==api.schema)throw Error('Unsupported cinematic look schema');const next=validateCine(p?.settings||{lighting:false,skin:false}),before=api.settings;api.settings=next;try{const value=restore(input);api.onRestore?.();return value;}catch(e){api.settings=before;throw e;}};
 model.cineProfile=api;return api;
}
/** CCT -> Planckian xy -> XYZ -> scene-linear sRGB. Approximation, luminance normalized. */
export function kelvinRGB(T){
 T=Math.max(3000,Math.min(10000,T));const x=T<4000?-0.2661239e9/T**3-0.2343589e6/T**2+.8776956e3/T+.179910: -3.0258469e9/T**3+2.1070379e6/T**2+.2226347e3/T+.240390;
 const y=T<4000?-.9549476*x**3-1.37418593*x*x+2.09137015*x-.16748867:3.081758*x**3-5.8733867*x*x+3.75112997*x-.37001483;
 const X=x/y,Z=(1-x-y)/y;let rgb=[3.2406*X-1.5372-.4986*Z,-.9689*X+1.8758+.0415*Z,.0557*X-.204+1.057*Z].map(v=>Math.max(0,v));const Y=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return rgb.map(v=>v/Y);
}
