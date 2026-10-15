import{applyOrbitalMorphology}from'./EyeTransportC3.mjs';
// Original KAOPU authored geometric controls. Artistic increments, not measured anatomy.
// Applied to the SAME native person before the existing native-eye contact pass.
export const SCHEMA='kaopu/head-morphology@1';
export const GROUPS=[
 ['颅形与颧颞结构',[['headWidth','颅顶宽窄'],['headHeight','颅顶高度'],['headDepth','后脑前后深度'],['templeWidth','颞部宽窄'],['cheekboneWidth','颧弓宽窄']]],
 ['下颌与下巴',[['jawWidth','下颌宽窄'],['jawAngle','下颌角高低'],['jawDefinition','下颌缘清晰度'],['chinWidth','下巴宽窄'],['chinLength','下巴长短'],['chinProjection','下巴前突 / 后收'],['chinSquare','下巴方圆']]],
 ['局部软组织',[['malarFullness','上颊 / 苹果肌丰满'],['buccalFullness','颊下丰满 / 收束'],['masseterFullness','腮部体积'],['jowlFullness','下颌缘软组织'],['submentalFullness','颏下厚度']]],
 ['真实眼裂与眼睑',[['eyeWidth','眼裂长短'],['eyeOpening','眼裂高低'],['eyeTilt','外眼角上扬 / 下垂'],['upperArch','上睑弧度'],['lowerArch','下睑弧度'],['eyeApex','上睑弧顶偏内 / 偏外'],['eyeHood','上睑覆盖厚度']]]
];
export const KEYS=GROUPS.flatMap(x=>x[1].map(x=>x[0]));
export const DEFAULTS=Object.freeze({enabled:true,...Object.fromEntries(KEYS.map(k=>[k,0]))});
export function validate(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('头型档案必须为对象');const s={...DEFAULTS,...input};for(const[k,v]of Object.entries(s)){if(!(k in DEFAULTS))throw Error('未知头型参数 '+k);if(k==='enabled'){if(typeof v!=='boolean')throw Error('无效头型开关');}else if(!Number.isFinite(v)||Math.abs(v)>1)throw Error('头型参数必须在 -1 到 1：'+k);}return s;}
export const PORTRAITS={
 P01:{name:'清俊 · 收束下颌 / 修长上扬眼',headWidth:-.18,headHeight:.12,headDepth:.12,templeWidth:-.15,cheekboneWidth:.1,jawWidth:-.48,jawAngle:.12,jawDefinition:.72,chinWidth:-.26,chinLength:.16,chinProjection:.26,chinSquare:-.3,malarFullness:.12,buccalFullness:-.55,masseterFullness:-.26,jowlFullness:-.48,submentalFullness:-.36,eyeWidth:.55,eyeOpening:-.48,eyeTilt:.38,upperArch:-.22,lowerArch:-.12,eyeApex:.24,eyeHood:.18},
 P02:{name:'晴川 · 圆润颊部 / 较圆眼裂',headWidth:.28,headHeight:-.14,headDepth:.15,templeWidth:.15,cheekboneWidth:-.12,jawWidth:.02,jawAngle:.2,jawDefinition:.16,chinWidth:.16,chinLength:-.25,chinProjection:.04,chinSquare:-.38,malarFullness:.52,buccalFullness:.56,masseterFullness:.1,jowlFullness:.34,submentalFullness:.16,eyeWidth:-.25,eyeOpening:.45,eyeTilt:-.12,upperArch:.4,lowerArch:.24,eyeApex:-.2,eyeHood:-.12},
 P03:{name:'高鼻 · 颧颊对比 / 厚上睑',headWidth:.06,headHeight:.18,headDepth:.24,templeWidth:-.24,cheekboneWidth:.48,jawWidth:.32,jawAngle:-.22,jawDefinition:.55,chinWidth:.25,chinLength:.06,chinProjection:.26,chinSquare:.28,malarFullness:.25,buccalFullness:-.3,masseterFullness:.35,jowlFullness:-.22,submentalFullness:-.12,eyeWidth:.25,eyeOpening:-.05,eyeTilt:.12,upperArch:.3,lowerArch:-.08,eyeApex:-.35,eyeHood:.65},
 P04:{name:'长廓 · 长窄下巴 / 平直窄眼',headWidth:-.38,headHeight:.42,headDepth:.3,templeWidth:-.32,cheekboneWidth:.2,jawWidth:-.3,jawAngle:-.25,jawDefinition:.66,chinWidth:-.3,chinLength:.45,chinProjection:.13,chinSquare:-.16,malarFullness:-.14,buccalFullness:-.62,masseterFullness:-.25,jowlFullness:-.36,submentalFullness:-.26,eyeWidth:.48,eyeOpening:-.55,eyeTilt:-.18,upperArch:-.34,lowerArch:-.26,eyeApex:.1,eyeHood:.42},
 P05:{name:'峻朗 · 宽方下颌 / 方下巴',headWidth:.35,headHeight:-.08,headDepth:.2,templeWidth:.28,cheekboneWidth:.22,jawWidth:.72,jawAngle:-.48,jawDefinition:.84,chinWidth:.64,chinLength:-.06,chinProjection:.38,chinSquare:.76,malarFullness:.04,buccalFullness:-.42,masseterFullness:.58,jowlFullness:-.46,submentalFullness:-.4,eyeWidth:.08,eyeOpening:-.28,eyeTilt:.04,upperArch:-.25,lowerArch:-.15,eyeApex:-.12,eyeHood:.5},
 P06:{name:'古典 · 柔和颏部 / 外眼角微垂',headWidth:-.06,headHeight:.12,headDepth:.12,templeWidth:.04,cheekboneWidth:-.16,jawWidth:-.12,jawAngle:.26,jawDefinition:.32,chinWidth:.02,chinLength:.04,chinProjection:-.23,chinSquare:-.3,malarFullness:.24,buccalFullness:.16,masseterFullness:-.06,jowlFullness:.08,submentalFullness:.06,eyeWidth:.02,eyeOpening:.22,eyeTilt:-.48,upperArch:.18,lowerArch:.12,eyeApex:.32,eyeHood:.22}
};
export function portraitSettings(id){const {name,...p}=PORTRAITS[id]||{};return validate(p);}
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*t*(10+t*(-15+6*t));};
const G=(x,y,z,cx,cy,cz,wx,wy,wz)=>Math.exp(-(((Math.abs(x)-cx)/wx)**2+((y-cy)/wy)**2+((z-cz)/wz)**2));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]),unit=a=>{const n=Math.hypot(...a);if(n<1e-8)throw Error('头型坐标架退化');return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
/** Reference chart is the retained GNM template, metres/Y-up/+Z-front.
 * Vector fields change silhouette, unlike a normal-only face bump. */
export function headDelta(x,y,z,s){
 const ax=Math.abs(x),sign=Math.sign(x),head=smooth(.173,.204,y);if(!head||!s.enabled)return[0,0,0];
 const pinna=1-smooth(.060,.078,ax)*(1-smooth(.321,.350,y))*(1-smooth(.017,.043,z));
 let protect=1;for(const cx of[-.031,.031])protect*=smooth(1,1.7,((x-cx)/.026)**2+((y-.301)/.017)**2);
 protect*=smooth(1,1.65,(x/.032)**2+((y-.233)/.018)**2); // retain lips and commissures
 const nose=(1-smooth(.012,.028,ax))*smooth(.244,.258,y)*(1-smooth(.313,.334,y))*smooth(.040,.060,z);protect*=1-nose;
 const w=head*pinna*protect;
 const jaw=G(x,y,z,.053,.218,.010,.027,.021,.062),edge=G(x,y,z,.047,.208,.026,.030,.010,.055),cheek=G(x,y,z,.044,.254,.043,.022,.024,.040),malar=G(x,y,z,.034,.279,.052,.022,.020,.04),mass=G(x,y,z,.063,.242,.006,.018,.027,.038),jowl=G(x,y,z,.043,.219,.045,.023,.018,.043),chin=G(x,y,z,0,.197,.052,.032,.019,.036),under=G(x,y,z,0,.185,.016,.039,.022,.041),temple=G(x,y,z,.065,.331,.01,.022,.025,.052),zyg=G(x,y,z,.053,.286,.04,.023,.018,.04);
 const vault=smooth(.315,.360,y),back=(1-smooth(-.015,.035,z))*smooth(.270,.319,y),front=smooth(-.028,.035,z);
 let dx=sign*(.0068*s.jawWidth*jaw+.0025*s.jawDefinition*edge+.0053*s.masseterFullness*mass+.0040*s.buccalFullness*cheek+.0036*s.malarFullness*malar+.0038*s.jowlFullness*jowl+.0045*s.cheekboneWidth*zyg+.0045*s.templeWidth*temple)+x*.080*s.headWidth*vault;
 dx+=x*.19*s.chinWidth*chin+sign*.0032*s.chinSquare*chin*smooth(.004,.025,ax);
 let dy=.0045*s.jawAngle*jaw-.0075*s.chinLength*chin-.0034*s.chinSquare*chin*smooth(.007,.027,ax)+.013*s.headHeight*vault-.0045*s.submentalFullness*under-.0035*s.jowlFullness*jowl+.0030*s.jawDefinition*under;
 let dz=.0075*s.chinProjection*chin+.0038*s.malarFullness*malar+.0045*s.buccalFullness*cheek+.0031*s.masseterFullness*mass+.0048*s.jowlFullness*jowl+.005*s.submentalFullness*under-.0046*s.jawDefinition*(.75*jowl+.65*cheek)+.0028*s.cheekboneWidth*zyg-.012*s.headDepth*back;
 dx*=w;dy*=w;dz*=w;const n=Math.hypot(dx,dy,dz),limit=.018;if(n>limit){const k=limit/n;dx*=k;dy*=k;dz*=k;}return[dx,dy,dz];
}
export function installHeadMorphology(model){if(model.headMorphology)return model.headMorphology;
 const api={schema:SCHEMA,settings:validate(),report:null,selected:null,revision:0},archive=model.archive.bind(model),restore=model.restore.bind(model);model.headMorphology=api;
 model.archive=()=>({...archive(),headMorphology:{schema:SCHEMA,settings:{...api.settings},selected:api.selected}});
 model.restore=o=>{const h=o?.headMorphology;if(h&&h.schema!==SCHEMA)throw Error('头型档案版本不兼容');const next=validate(h?.settings||{}),old=api.settings,selected=api.selected;api.settings=next;api.selected=h?.selected||null;try{const r=restore(o);api.onRestore?.();return r;}catch(e){api.settings=old;api.selected=selected;throw e;}};
 return api;
}
export function finishHeadPortrait(model,id){const api=model.headMorphology;if(api){api.settings=portraitSettings(id);api.selected=id;}}
export function applyHeadMorphology(model,p,eye,tools){
 const api=model.headMorphology;if(!api)return;const started=performance.now(),s=api.settings;
 if(!api.cache){const c=model.canonical,g=model.gnm,B=model.bodyCount,rows=[];for(let hi=0;hi<c.gnmRecipes.length;hi++){const i=B+hi;if(!eye.skin[i])continue;const[a,b,t]=c.gnmRecipes[hi];const q=[0,1,2].map(k=>g.template[a*3+k]*(1-t)+g.template[b*3+k]*t);if(q[1]>.173)rows.push([i,...q]);}api.cache={rows};}
 if(!s.enabled||KEYS.every(k=>s[k]===0)){api.report={version:'HEAD-MORPHOLOGY-R06-C3',enabled:false,changedVertices:0,sourceEyesChanged:false,bodyChanged:false,ms:performance.now()-started};return;}
 const landmark=i=>tools.getLandmark(p,i),rland=i=>tools.getLandmark(eye.rest,i),L=landmark(36),R=landmark(45),axisX=unit(sub(R,L)),rawUp=sub(landmark(27),landmark(8)),axisY=unit(rawUp.map((v,i)=>v-dot(rawUp,axisX)*axisX[i]));let axisZ=unit(cross(axisX,axisY));const middle=L.map((v,i)=>(v+R[i])*.5);if(dot(axisZ,sub(landmark(30),middle))<0)axisZ=axisZ.map(v=>-v);const scale=clamp(Math.hypot(...sub(R,L))/Math.hypot(...sub(rland(45),rland(36))),.65,1.5);
 let changed=0,max=0;for(const[i,x,y,z]of api.cache.rows){const d=headDelta(x,y,z,s);if(Math.hypot(...d)<1e-10)continue;for(let k=0;k<3;k++)p[i*3+k]+=scale*(axisX[k]*d[0]+axisY[k]*d[1]+axisZ[k]*d[2]);max=Math.max(max,Math.hypot(...d)*scale*1000);changed++;}
 const eyes=GROUPS[3][1].some(([k])=>s[k]!==0)?applyOrbitalMorphology(model,p,eye,tools,s):[];
 api.revision++;api.report={version:'HEAD-MORPHOLOGY-R06-C3',enabled:true,revision:api.revision,changedVertices:changed,maximumHeadIncrementMM:max,eyes,ms:performance.now()-started,bodyChanged:false,sourceEyesChanged:false,oneNativeMesh:true,parameterCount:KEYS.length,clinicalBodyFat:false,skullSimulation:false,method:'native-template vector fields; head-attached frame; complete continuous orbital tissue; retained native-eye radial envelope; before native eye contact and display subdivision'};
}
