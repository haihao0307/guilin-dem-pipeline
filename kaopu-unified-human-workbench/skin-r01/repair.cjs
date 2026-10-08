// Deterministic corrections after visual diagnosis run 37728365967.
// No original platform file, vertex, topology or teacher parameter is edited.
const fs=require('fs'),path=require('path');
function patch(name,replacements,marker){const file=path.join(__dirname,name);let s=fs.readFileSync(file,'utf8');if(s.includes(marker))return;for(const [a,b]of replacements){if(!s.includes(a))throw Error(name+' missing repair anchor '+a.slice(0,90));s=s.replaceAll(a,()=>b);}s+='\n'+(name.endsWith('.py')?'# ':'// ')+marker+'\n';fs.writeFileSync(file,s);}
patch('SkinLayer.mjs',[
 ["SKIN_VERSION='unified-human-skin/r01'","SKIN_VERSION='unified-human-skin/r01.1'"],
 ['roughness:.53,oil:.23,detail:.72,pigment:.22,sss:.78,radius:1.15,translucency:.55','roughness:.57,oil:.14,detail:.85,pigment:.22,sss:.78,radius:1.15,translucency:0'],
 ['entryPass(){if(!this.depthDirty)return;','entryPass(){if(settings.translucency===0||!this.depthDirty)return;'],
 ['vec3 kWN=inverseTransformDirection(nonPerturbedNormal,viewMatrix);','if(kTranslucency>.00001){vec3 kWN=inverseTransformDirection(nonPerturbedNormal,viewMatrix);'],
 ['kDiffuse+=kTrans;outgoingLight+=kTrans;','kDiffuse+=kTrans;outgoingLight+=kTrans;}'],
 ["if(!(k in defaults))continue;","if(!(k in defaults)||k==='translucency')continue;"],
 ["slider('translucency','薄部透光',0,1.5)","slider('translucency','薄部透光（暂不启用）',0,1.5)"],
 ["panel.querySelector('#skin-reset').onclick=()=>set(defaults);syncUI();","panel.querySelector('#skin-reset').onclick=()=>set(defaults);const transmission=panel.querySelector('#skin-translucency');transmission.disabled=true;transmission.title='全身体厚度映射未通过视觉检查，暂不启用';const credit=document.createElement('a');credit.className='skin-credits';credit.href=new URL('THIRD_PARTY.txt',import.meta.url).href;credit.target='_blank';credit.rel='noopener';credit.textContent='皮肤 / SSS 来源';credit.title='Lee Perry-Smith / Infinite-Realities (CC BY 3.0); Jorge Jimenez & Diego Gutierrez';panel.querySelector('.skin-row').append(credit);syncUI();"],
 ["geometryDisplacement:false};","geometryDisplacement:false,thinTransmissionEnabled:false,thinTransmissionReason:'Full-body depth sampling produced visible artifacts; disabled pending calibration.'};"]
],'skin-r01.1-visual-repair');
patch('prepare.py',[
 ['def build(snapshot,out):',"def micro_residual(a,sigma):\n p=periodic(a);sig=(sigma,sigma,0) if p.ndim==3 else sigma;p-=gaussian_filter(p,sig,mode='wrap')\n # Remove residual axis-wide scan drift, not individual pore structures.\n p-=p.mean(axis=0,keepdims=True)+p.mean(axis=1,keepdims=True)-p.mean(axis=(0,1),keepdims=True)\n return p\n\ndef build(snapshot,out):"],
 ['box=(1792,512,2304,1024)','box=(1792,256,2304,768)'],
 ['resid=albedo-gaussian_filter(albedo,(24,24,0));color=np.clip(periodic(resid)*.72+mean,0,1)','resid=micro_residual(albedo,12);color=np.clip(resid*.78+mean,0,1)'],
 ['xy=periodic(f[...,:2]);xy-=xy.mean((0,1));','xy=micro_residual(f[...,:2],12 if name==\'meso\' else 6);xy-=xy.mean((0,1));'],
 ['rough=np.clip(.53+periodic(spec.mean()-spec)*.24,0,1)','rough=np.clip(.53+micro_residual(-spec,18)*.24,0,1)'],
 ["'scope':'bare skin sample only; no facial-feature transplantation'","'scope':'brow-free upper forehead crop; periodic high-pass and axis-drift removal; no facial-feature transplantation'"]
],'skin-r01.1-safe-crop');
patch('qa.cjs',[["key:'anny.pose:upperarm01.L.X',value:.2","key:'anny.pose:upperarm01.L.X',value:24"]],'skin-r01.1-arm-degrees');
patch('build.cjs',[
 ["version:'unified-human-skin/r01'","version:'unified-human-skin/r01.1'"],
 ["<strong>共同人物 · 皮肤接入 R01</strong>","<strong>共同人物 · 皮肤接入 R01.1</strong>"],
 ["newGeometry:false,portraitImagesUsed:false","newGeometry:false,thinTransmissionEnabled:false,portraitImagesUsed:false"]
],'skin-r01.1-manifest');
const readme=path.join(__dirname,'README.md');if(fs.existsSync(readme)){let s=fs.readFileSync(readme,'utf8');if(!s.includes('R01.1 视觉修正')){s=s.replace('# 共同人体 · R02 皮肤材质接入 R01','# 共同人体 · R02 皮肤材质接入 R01.1\n\n**R01.1 视觉修正：** 采样窗口上移以排除眉区边缘，并消除轴向扫描漂移造成的重复条带。原 R02 的全身薄部深度映射出现下颌锯齿伪影，当前明确关闭并禁用该控件，等待独立厚度校准；皮下 RGB 散射仍保留。原型中关于薄部透光的描述不代表本交付版已启用。');fs.writeFileSync(readme,s);}}
console.log('Material-only visual repairs applied; original modules untouched.');
