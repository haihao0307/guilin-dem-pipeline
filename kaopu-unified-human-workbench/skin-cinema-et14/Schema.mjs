export const VERSION='ET14-S1';
export const SCHEMA='kaopu/cinema-surface@1';
// Units are authoring units on the existing model, not measured biological data.
export const FIELDS=[
 ['poreSize','毛孔间距／尺寸',.55,1.7,.05,'倍','微表面'],
 ['poreDepth','毛孔起伏',0,2,.05,'倍','微表面'],
 ['scanMicro','原扫描细节',0,2,.05,'倍','微表面'],
 ['grain','表皮微细纹',0,1,.05,'','微表面'],
 ['grainMM','微细纹尺度',.18,.8,.02,'mm','微表面'],
 ['hydration','干燥 ← 表面状态 → 润泽',0,1,.05,'','分区反射'],
 ['cheekRoughness','面颊粗糙度偏置',-.12,.15,.01,'','分区反射'],
 ['noseRoughness','鼻部粗糙度偏置',-.15,.15,.01,'','分区反射'],
 ['oilFilm','T区油膜',0,1,.05,'','分区反射'],
 ['lobeMix','窄反射瓣权重',0,.65,.025,'','分区反射'],
 ['lobeRoughness','窄反射瓣粗糙度',.18,.60,.02,'','分区反射'],
 ['pigmentVariation','低频色素不均',0,1,.05,'','色彩组织'],
 ['bloodVariation','局部血色变化',0,1,.05,'','色彩组织'],
 ['lipGrain','唇部细纹起伏',0,1,.05,'','微表面'],
 ['foldRelief','折纹谷与两侧隆起',0,2,.05,'倍','折纹试验'],
 ['foldSpread','折纹过渡宽度',.6,1.8,.05,'倍','折纹试验'],
 ['compression','压缩 ← 折纹剖面试验 → 拉伸',-1,1,.05,'','折纹试验']
];
export const DEFAULTS=Object.freeze({enabled:true,poreSize:1,poreDepth:1.15,scanMicro:1.1,grain:.24,grainMM:.34,hydration:.5,cheekRoughness:.035,noseRoughness:-.035,oilFilm:.32,lobeMix:.27,lobeRoughness:.32,pigmentVariation:.22,bloodVariation:.26,lipGrain:.28,foldRelief:.8,foldSpread:1.2,compression:0});
export const PRESETS={
 balanced:{label:'自然细腻',values:{}},
 fine:{label:'细腻哑光',values:{poreSize:.75,poreDepth:.7,scanMicro:.9,grain:.13,hydration:.62,cheekRoughness:.02,oilFilm:.15,lobeMix:.18}},
 dry:{label:'干燥细纹',values:{poreDepth:1.3,grain:.6,hydration:.12,cheekRoughness:.10,oilFilm:.06,lobeMix:.12,lipGrain:.7}},
 oily:{label:'润泽T区',values:{poreSize:1.1,poreDepth:1.05,grain:.14,hydration:.83,noseRoughness:-.10,oilFilm:.83,lobeMix:.48,lobeRoughness:.24}},
 weathered:{label:'风化粗肤',values:{poreSize:1.32,poreDepth:1.65,scanMicro:1.4,grain:.52,hydration:.3,pigmentVariation:.6,bloodVariation:.42,lipGrain:.55,foldRelief:1.15}},
 mature:{label:'熟龄折纹',values:{poreSize:1.12,poreDepth:1.2,grain:.4,hydration:.34,cheekRoughness:.07,oilFilm:.16,foldRelief:1.3,foldSpread:1.45},identityRecipe:'mature'}
};
export function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid close-up skin settings');
 const out={...DEFAULTS,...input};for(const k of Object.keys(out))if(!(k in DEFAULTS))throw Error('Unknown close-up setting: '+k);
 if(typeof out.enabled!=='boolean')throw Error('Invalid close-up switch');
 for(const[k,,lo,hi]of FIELDS)if(!Number.isFinite(out[k])||out[k]<lo||out[k]>hi)throw Error('Close-up setting out of range: '+k);
 return out;
}
export function foldedProfile(distance,sigma,amplitude){const q=distance/sigma;return amplitude*(q*q-1)*Math.exp(-q*q/2);}
// Integral over the infinite transverse line is zero: trough redistributes into
// two shoulders. This is a signed height authoring profile, NOT a tissue solver.
export const LIMITS={filmQualityAccepted:false,geometryDisplacement:false,stressSolver:false,compressionControl:'explicit manual cross-section experiment; not live expression stress',dualLobes:'direct-light GGX mixture; native indirect response retained',spectralTransport:false,fullBody:false,phoneTestRequested:false};
