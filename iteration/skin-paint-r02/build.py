from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
BASE=REPO/'kaopu-unified-human-workbench/skin-surface-lab-r01/preview.html'
OUT=REPO/'kaopu-unified-human-workbench/skin-paint-r02'
OUT.mkdir(parents=True,exist_ok=True)
s=BASE.read_text()
assert hashlib.sha256(s.encode()).hexdigest()=='05dbad16827b5a56961c094b104228765fc8eb88b4417f105337f73f7d9eb98e'
def once(s,a,b):
 assert s.count(a)==1,(a[:110],s.count(a))
 return s.replace(a,b,1)
paint=(ROOT/'paint-kernel.js').read_text()
s=once(s,'/* KAOPU SSG-01 / Skin Surface Lab R01.',paint+'\n/* KAOPU SSG-01 / Skin Surface Lab R01.')
s=once(s,"const VERSION='SKIN-SURFACE-LAB-R01';","const VERSION='SKIN-PAINT-R02';")
s=s.replace('皮肤表面实验室','皮肤绘制实验室').replace('SSG–01 · R01','PAINT · R02').replace('R01</title>','R02</title>')
a=s.index('const presetData=[');b=s.index('const sliders=',a)
s=s[:a]+'''const presetData=[
 {id:'satin',name:'自然红润',tag:'NATURAL',note:'眼周与鼻翼血色 · 细腻面颊 · 分区油光',color:'#cca290',p:{melanin:.10,blood:.16,oil:.34,hydration:.66,variation:1},q:{pore:.92,width:1.05,micro:.68,grain:.60},seed:41731,chroma:1,beard:0,flush:0},
 {id:'porcelain',name:'浅色干爽',tag:'FAIR MATTE',note:'浅肤底色 · 柔和微纹 · 较弱油膜',color:'#e0b7ac',p:{melanin:.025,blood:.13,oil:.08,hydration:.30,variation:.83},q:{pore:.68,width:.82,micro:1.0,grain:.58},seed:86219,chroma:.75,beard:0,flush:0},
 {id:'warm',name:'暖棕混合',tag:'WARM / PORES',note:'暖棕色素 · 鼻部较清晰孔口 · 混合油光',color:'#aa775e',p:{melanin:.34,blood:.19,oil:.58,hydration:.59,variation:1},q:{pore:1.2,width:1.25,micro:.72,grain:.55},seed:27943,chroma:1.25,beard:0,flush:0},
 {id:'deep',name:'深褐柔光',tag:'DEEP',note:'深色基底 · 保留反光细节 · 唇色联动',color:'#654334',p:{melanin:.66,blood:.18,oil:.52,hydration:.70,variation:.85},q:{pore:1.08,width:1.17,micro:.61,grain:.62},seed:66107,chroma:1.1,beard:0,flush:0},
 {id:'dry',name:'自然胡茬',tag:'STUBBLE TONE',note:'唇周下颌胡根色 · 独立可调 · 不改变毛孔位置',color:'#a58c79',p:{melanin:.18,blood:.17,oil:.33,hydration:.5,variation:1},q:{pore:1.06,width:1.1,micro:.9,grain:.58},seed:19463,chroma:.85,beard:1,flush:0},
 {id:'mixed',name:'运动微红',tag:'FLUSH / DEWY',note:'暂时泛红 · T 区润泽 · 同一人的可逆状态',color:'#cf9988',p:{melanin:.11,blood:.20,oil:.78,hydration:.87,variation:1},q:{pore:.96,width:1.07,micro:.65,grain:.50},seed:41731,chroma:1,beard:0,flush:.80}
];
'''+s[b:]
s=once(s,'const result=window.KAOPU_SSG_KERNEL.pack(generateField(seed));const next=new THREE.DataArrayTexture(result.data,result.width,result.height,2);','const result=window.KAOPU_PAINT_R02.packColour(window.KAOPU_SSG_KERNEL.pack(generateField(seed)));const next=new THREE.DataArrayTexture(result.data,result.width,result.height,3);')
s=once(s,'U={uSSGField:',"U={uPaintAmount:{value:1},uPaintChroma:{value:1},uPaintBeard:{value:0},uPaintFlush:{value:0},uSSGField:")
s=once(s,'let f=GLSL+s.fragmentShader;','let f=GLSL+window.KAOPU_PAINT_R02.declarations+s.fragmentShader;')
s=once(s,'f=patchOnce(f,anchor,window.KAOPU_SSG_KERNEL.surface+anchor);', '''f=patchOnce(f,anchor,window.KAOPU_SSG_KERNEL.surface+window.KAOPU_PAINT_R02.surface+anchor);
 f=patchOnce(f,'// Preserve the specialist ear', '// Preserve the specialist ear');
 const paintAnchor='diffuseColor.rgb*=mix(vec3(1.),exp(-uSDMel*vec3(.62,.74,.86)),sdCover*clamp(lpMask,0.,1.)*.72);';
 f=patchOnce(f,paintAnchor,paintAnchor+window.KAOPU_PAINT_R02.colour);''')
s=once(s,'U.uSSGOn.value=comparison?0:1;','U.uSSGOn.value=1;U.uPaintAmount.value=comparison?0:1;U.uPaintChroma.value=settings.chroma??current?.chroma??1;U.uPaintBeard.value=settings.beard??current?.beard??0;U.uPaintFlush.value=settings.flush??current?.flush??0;')
s=once(s,'settings={p:{...p.p},q:{...p.q},seed:p.seed};','settings={p:{...p.p},q:{...p.q},seed:p.seed,chroma:p.chroma,beard:p.beard,flush:p.flush};')
s=s.replace("'kaopu.skin-surface-lab/1'","'kaopu.skin-paint/2'")
s=s.replace('ssg-slope-array-v3','ssg-paint-r02-v1')
s=s.replace("comparison?'原版表面对照'","comparison?'R01 平涂对照'")
s=s.replace('相同人物、相同配方、相同 EB1；暂时停用新增肌理。','相同人物、相同参数、相同灯光；停用 R02 分区绘制与油膜。')
s=s.replace('对照：原版表面','对照：R01 平涂').replace('对照：SSG 肌理','对照：R02 绘制')
s=s.replace('PROCEDURAL SKIN / LOOK DEVELOPMENT','REGIONAL PIGMENT / BLOOD / MICRORELIEF')
s=s.replace('表面由自有规则生成；不使用参考网站的皮肤贴图。','R02 重做分区色素、血色、胡根色和油膜；不使用参考网站的皮肤像素。')
s=s.replace('ssg-field-v1','ssg-paint-r02-v1')
s=once(s,'<div class="ssg-section-title"><span>03 / 光照与检查', '''<div class="ssg-sliders" id="paint-extra">${[['chroma','色彩微层次',1],['beard','胡根色',0],['flush','暂时泛红',0]].map(([key,label,val])=>`<label><span>${label}</span><output id="paint-v-${key}">${val.toFixed(2)}</output><input aria-label="${label}" data-paint-param="${key}" type="range" min="0" max="1.5" step=".01" value="${val}"></label>`).join('')}</div><div class="ssg-section-title"><span>03 / 光照与检查''')
s=once(s,'function sync(){for(',"function sync(){for(const key of ['chroma','beard','flush']){const v=settings[key]??current?.[key]??0;const e=root.querySelector('[data-paint-param='+key+']');if(e&&document.activeElement!==e)e.value=v;const o=document.getElementById('paint-v-'+key);if(o)o.textContent=v.toFixed(2);}for(")
s=once(s,"root.addEventListener('input',e=>{const k=", "root.addEventListener('input',e=>{const pk=e.target.dataset.paintParam;if(pk&&ready){settings[pk]=Number(e.target.value);requestDraw();return;}const k=")
s=once(s,"return structuredClone(s);}","for(const k of ['chroma','beard','flush'])if(s[k]!==undefined&&(!Number.isFinite(s[k])||s[k]<0||s[k]>1.5))throw Error('绘制参数越界 '+k);return structuredClone(s);}")
s=s.replace("window.skinSurfaceLab=api;","window.skinSurfaceLab=api;window.skinPaintR02=api;")
(OUT/'preview.html').write_text(s)
(OUT/'BUILD.json').write_text(json.dumps({'version':'SKIN-PAINT-R02','sha256':hashlib.sha256(s.encode()).hexdigest(),'bytes':len(s.encode()),'baseline':'4669c23ceec256808907176ce2d42cedb626ae22','sameGeometry':True,'sourcePixelsCopied':False,'extraSamplerOverR01':0,'newTextureLayers':3,'newTextureBaseBytes':12582912,'visualAccepted':False},indent=2))
print(OUT,hashlib.sha256(s.encode()).hexdigest(),len(s))
