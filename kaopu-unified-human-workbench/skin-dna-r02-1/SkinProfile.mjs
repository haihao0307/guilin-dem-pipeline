// Skin identity is independent of shape, pose and lighting. Values below are
// bounded artistic controls, NOT measured tissue concentrations or diagnoses.
export const SCHEMA='kaopu.skin-dna/2';
export const BASE=Object.freeze({seed:41731,melanin:.22,blood:.28,variation:.5,freckles:.08,sun:.12,age:.2,oil:.3,hydration:.55,pores:.75,poreScale:1,detail:.65});
export const STATE=Object.freeze({flush:0,sweat:0,dryness:0});
export const PRESETS=Object.freeze([
 {id:'silk',name:'01 · 细腻中性',note:'细毛孔 · 局部轻油脂 · 柔和色素变化',profile:{...BASE,seed:41731,melanin:.22,blood:.24,variation:.48,freckles:.035,oil:.27,pores:.65,detail:.55}},
 {id:'freckle',name:'02 · 浅色微红',note:'浅色基底 · 颊部微红 · 不制造雀斑',profile:{...BASE,seed:86219,melanin:.08,blood:.29,variation:.68,freckles:.83,sun:.24,oil:.2,pores:.63,poreScale:.88,detail:.6}},
 {id:'outdoor',name:'03 · 暖色日晒',note:'较深色素 · 暴露区差异 · 局部干润',profile:{...BASE,seed:27943,melanin:.39,blood:.2,variation:.83,freckles:.32,sun:.72,age:.42,oil:.35,hydration:.38,pores:1.02,poreScale:1.14,detail:.88}},
 {id:'deep',name:'04 · 深色缎面',note:'深色基底 · 不染黑的表面反光 · 色素层次',profile:{...BASE,seed:66107,melanin:.78,blood:.17,variation:.62,freckles:.08,sun:.12,oil:.38,hydration:.65,pores:.83,poreScale:.98,detail:.66}},
 {id:'mature',name:'05 · 干燥柔光',note:'较干表面 · 较宽柔光 · 不伪造衰老',profile:{...BASE,seed:19463,melanin:.23,blood:.21,variation:.9,freckles:.22,sun:.36,age:.85,oil:.12,hydration:.22,pores:.92,poreScale:1.13,detail:1.08}},
 {id:'dewy',name:'06 · 润泽混合',note:'T区油脂 · 颊部柔光 · 有限湿润层',profile:{...BASE,seed:93113,melanin:.3,blood:.3,variation:.58,freckles:.03,sun:.08,age:.23,oil:.72,hydration:.84,pores:.7,poreScale:1,detail:.48}}
]);
const ranges={seed:[1,16777215],melanin:[0,1],blood:[0,1],variation:[0,1],freckles:[0,1],sun:[0,1],age:[0,1],oil:[0,1],hydration:[0,1],pores:[0,1.5],poreScale:[.65,1.5],detail:[0,1.5]};
function values(input,base,limits){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('皮肤参数必须为对象');const out={...base};for(const[k,v]of Object.entries(input)){if(!Object.hasOwn(limits,k))throw Error('未知皮肤参数: '+k);const[a,b]=limits[k];if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b||(k==='seed'&&!Number.isInteger(v)))throw Error('皮肤参数越界: '+k);out[k]=v;}return out;}
export const validateProfile=p=>values(p,BASE,ranges);
export const validateState=s=>values(s,STATE,{flush:[0,1],sweat:[0,1],dryness:[0,1]});
export function validateRecord(o){if(!o||o.schema!==SCHEMA)throw Error('需要 R02 皮肤配方；R01 配方请在保留的旧网页打开，不能静默套用新光学规则');if(!['fast','diffusion'].includes(o.quality))throw Error('皮肤质量档无效');if(typeof o.enabled!=='boolean')throw Error('皮肤开关无效');if(typeof o.preset!=='string'||o.preset.length>48)throw Error('皮肤预设标识无效');return{schema:SCHEMA,preset:o.preset,enabled:o.enabled,quality:o.quality,profile:validateProfile(o.profile),state:validateState(o.state)};}
export function initialRecord(id='silk'){const p=PRESETS.find(x=>x.id===id)||PRESETS[0];return validateRecord({schema:SCHEMA,preset:p.id,enabled:true,quality:'fast',profile:p.profile,state:STATE});}
export function seedVector(seed){let n=seed>>>0;const r=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return(n>>>0)/4294967296;};return[r()*91+3,r()*87+7,r()*79+11];}
export function fingerprint(record){const s=JSON.stringify(validateRecord(record));let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0).toString(16).padStart(8,'0');}
