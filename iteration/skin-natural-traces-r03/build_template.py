from pathlib import Path
import hashlib,json

ROOT=Path(__file__).resolve().parent
REPO=ROOT.parents[1]
BASE=REPO/'kaopu-unified-human-workbench/skin-paint-r02/preview.html'
OUT=REPO/'kaopu-unified-human-workbench/skin-natural-traces-r03'
OUT.mkdir(parents=True,exist_ok=True)
s=BASE.read_text()
BASE_SHA='4d51f302763ea6ff751f2c2487fc08bbf9113da47d8a46dcdf121e6de03358f8'
assert hashlib.sha256(s.encode()).hexdigest()==BASE_SHA

def one(a,b):
 global s
 n=s.count(a)
 assert n==1,(a[:140],n)
 s=s.replace(a,b,1)

trace=(ROOT/'natural-traces.js').read_text()
one('/* KAOPU SSG-01 / Skin Surface Lab R01.',trace+'\n/* KAOPU SSG-01 / Skin Surface Lab R01.')
one("const VERSION='SKIN-PAINT-R02';","const VERSION='SKIN-NATURAL-TRACES-R03';")

# Expand the existing single array texture by two deterministic trace layers.
one(
 'const result=window.KAOPU_PAINT_R02.packColour(window.KAOPU_SSG_KERNEL.pack(generateField(seed)));const next=new THREE.DataArrayTexture(result.data,result.width,result.height,3);',
 'const result=window.KAOPU_TRACE_R03.pack(window.KAOPU_PAINT_R02.packColour(window.KAOPU_SSG_KERNEL.pack(generateField(seed))));const next=new THREE.DataArrayTexture(result.data,result.width,result.height,result.layers);'
)

# Attach R03 uniforms without adding a sampler.
one(
 'U={uPaintAmount:{value:1},uPaintChroma:{value:1},uPaintBeard:{value:0},uPaintFlush:{value:0},uSSGField:',
 "U={uTraceAmount:{value:1},uTraceAcne:{value:.48},uTraceHealed:{value:.42},uTraceShave:{value:.62},uTraceEye:{value:.52},uTraceScar:{value:.28},uTraceAsymmetry:{value:.58},uTraceDebug:{value:0},uPaintAmount:{value:1},uPaintChroma:{value:1},uPaintBeard:{value:0},uPaintFlush:{value:0},uSSGField:"
)
one(
 'let f=GLSL+window.KAOPU_PAINT_R02.declarations+s.fragmentShader;',
 'let f=GLSL+window.KAOPU_PAINT_R02.declarations+window.KAOPU_TRACE_R03.declarations+s.fragmentShader;'
)
one(
 'f=patchOnce(f,anchor,window.KAOPU_SSG_KERNEL.surface+window.KAOPU_PAINT_R02.surface+anchor);',
 'f=patchOnce(f,anchor,window.KAOPU_SSG_KERNEL.surface+window.KAOPU_PAINT_R02.surface+window.KAOPU_TRACE_R03.surface+anchor);'
)
one(
 'f=patchOnce(f,paintAnchor,paintAnchor+window.KAOPU_PAINT_R02.colour);',
 'f=patchOnce(f,paintAnchor,paintAnchor+window.KAOPU_PAINT_R02.colour+window.KAOPU_TRACE_R03.colour);'
)
one("material.customProgramCacheKey=()=>key()+'/ssg-paint-r02-v3';","material.customProgramCacheKey=()=>key()+'/skin-natural-traces-r03-v1';")

# Independent settings: changing marks never changes geometry, identity or the R02 base recipe.
one(
 'const errors=[],timings=[],started=performance.now();',
 "const traceDefaults=structuredClone(window.KAOPU_TRACE_R03.defaults),traceSettings=structuredClone(traceDefaults);\nconst errors=[],timings=[],started=performance.now();"
)
one(
 'U.uSSGOn.value=1;U.uPaintAmount.value=comparison?0:1;U.uPaintChroma.value=settings.chroma??current?.chroma??1;U.uPaintBeard.value=settings.beard??current?.beard??0;U.uPaintFlush.value=settings.flush??current?.flush??0;',
 "U.uSSGOn.value=1;U.uPaintAmount.value=comparison?0:1;U.uPaintChroma.value=settings.chroma??current?.chroma??1;U.uPaintBeard.value=settings.beard??current?.beard??0;U.uPaintFlush.value=settings.flush??current?.flush??0;U.uTraceAmount.value=comparison?0:traceSettings.amount;U.uTraceAcne.value=traceSettings.acne;U.uTraceHealed.value=traceSettings.healed;U.uTraceShave.value=traceSettings.shave;U.uTraceEye.value=traceSettings.eye;U.uTraceScar.value=traceSettings.scar;U.uTraceAsymmetry.value=traceSettings.asymmetry;U.uTraceDebug.value=traceSettings.debug;"
)

# Add a dedicated, bounded control block before lighting.
ui='''<div class="ssg-section-title"><span>03 / 自然生活痕迹</span><button id="trace-reset">恢复自然值</button></div><div id="trace-note">痘、痘印、剃须残留和眼周色调分层；不是一张脏斑贴图。</div><div class="ssg-sliders" id="trace-controls">${window.KAOPU_TRACE_R03.controls.map(([key,label,min,max,val])=>`<label><span>${label}</span><output id="trace-v-${key}">${val.toFixed(2)}</output><input aria-label="${label}" data-trace-param="${key}" type="range" min="${min}" max="${max}" step=".01" value="${val}"></label>`).join('')}</div><div class="ssg-checks"><select aria-label="自然痕迹诊断" id="trace-debug"><option value="0">自然合成</option><option value="1">活动粉刺蒙版</option><option value="2">痘印与凹痕蒙版</option><option value="3">剃须与胡根蒙版</option><option value="4">眼周蒙版</option><option value="5">综合痕迹蒙版</option></select></div><div class="ssg-section-title"><span>04 / 光照与检查'''
one('<div class="ssg-section-title"><span>03 / 光照与检查',ui)

# Keep the panel readable and distinguish the new research note.
one('#ssg-ab{width:100%;margin-bottom:12px;min-height:42px!important}', '#trace-note{margin:-4px 0 12px;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:9px;font-size:11px;line-height:1.45;color:rgba(255,255,255,.66)}#ssg-ab{width:100%;margin-bottom:12px;min-height:42px!important}')

# Synchronize sliders and diagnostic view.
one(
 'function sync(){',
 "function sync(){for(const [key,label,lo,hi,fallback] of window.KAOPU_TRACE_R03.controls){const v=traceSettings[key]??fallback;const el=root.querySelector('[data-trace-param='+key+']');if(el&&document.activeElement!==el)el.value=v;const o=document.getElementById('trace-v-'+key);if(o)o.textContent=v.toFixed(2);}const td=document.getElementById('trace-debug');if(td&&document.activeElement!==td)td.value=String(traceSettings.debug);"
)
one(
 "root.addEventListener('input',e=>{const pk=e.target.dataset.paintParam;",
 "root.addEventListener('input',e=>{const tk=e.target.dataset.traceParam;if(tk&&ready){const def=window.KAOPU_TRACE_R03.controls.find(x=>x[0]===tk);const v=Number(e.target.value);if(!def||!Number.isFinite(v)||v<def[2]||v>def[3])return;traceSettings[tk]=v;const o=document.getElementById('trace-v-'+tk);if(o)o.textContent=v.toFixed(2);requestDraw();return;}const pk=e.target.dataset.paintParam;"
)
one(
 "else if(e.target.id==='ssg-reset-view')camera('face');",
 "else if(e.target.id==='trace-reset'){Object.assign(traceSettings,structuredClone(traceDefaults));apply();}else if(e.target.id==='ssg-reset-view')camera('face');"
)
one(
 "$('ssg-seed').onchange=e=>{",
 "$('trace-debug').onchange=e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=0&&v<=5){traceSettings.debug=v;apply();}};\n$('ssg-seed').onchange=e=>{"
)

# Expose an atomic R03 recipe API while keeping the R02 API intact.
r03api='''window.skinSurfaceLab=api;window.skinPaintR02=api;
const traceValidate=o=>{if(!o||o.schema!=='kaopu.skin-natural-traces/3'||!o.settings)throw Error('需要本版自然痕迹配方');const v=structuredClone(o.settings);for(const [key,,lo,hi] of window.KAOPU_TRACE_R03.controls)if(!Number.isFinite(v[key])||v[key]<lo||v[key]>hi)throw Error('自然痕迹参数越界 '+key);if(!Number.isInteger(v.debug)||v.debug<0||v.debug>5)throw Error('诊断通道无效');return v;};
window.skinNaturalTracesR03={version:'SKIN-NATURAL-TRACES-R03',controls:window.KAOPU_TRACE_R03.controls.map(x=>[...x]),set(key,value){const d=window.KAOPU_TRACE_R03.controls.find(x=>x[0]===key);if(!d||!Number.isFinite(value)||value<d[2]||value>d[3])throw Error('自然痕迹参数越界');traceSettings[key]=value;apply();},debug(value){if(!Number.isInteger(value)||value<0||value>5)throw Error('诊断通道无效');traceSettings.debug=value;apply();},reset(){Object.assign(traceSettings,structuredClone(traceDefaults));apply();},archive(){return{schema:'kaopu.skin-natural-traces/3',algorithm:'skin-natural-traces-r03-v1',settings:structuredClone(traceSettings),base:api.archive()};},restore(o){const v=traceValidate(o);if(o.base)api.restore(o.base);Object.assign(traceSettings,v);apply();},report(){const b=api.report();return{...b,version:'SKIN-NATURAL-TRACES-R03',naturalTraces:{settings:structuredClone(traceSettings),controls:window.KAOPU_TRACE_R03.controls.map(x=>[...x]),kernel:b.field?.traceKernel,counts:b.field?.traceCounts,means:b.field?.traceMeans,fingerprint:b.field?.traceFingerprint,sourcePixelsCopied:false,clinicalCalibration:false,diseaseSimulation:false,space:'rest material triplanar + native facial anatomy gates',correlatedChannels:['albedo','roughness','micro-normal']},userVisualAccepted:false};}};'''
one('window.skinSurfaceLab=api;window.skinPaintR02=api;',r03api)

# Honest labels: this version studies natural variation, not the underlying skin-material replacement.
s=s.replace('皮肤绘制实验室','皮肤自然痕迹实验室').replace('PAINT · R02','TRACES · R03')
s=s.replace('REGIONAL PIGMENT / BLOOD / MICRORELIEF','LIVED-IN SKIN / SPARSE NATURAL TRACES')
s=s.replace('R02 重做分区色素、血色、胡根色和油膜；不使用参考网站的皮肤像素。','R03 在 R02 之上增加稀疏自然痕迹；学习通道结构，不复制参考网站贴图像素。')
s=s.replace('对照：R02 绘制','对照：R03 自然痕迹')
s=s.replace('document.title=\'KAOPU · 皮肤绘制实验室 R02\';',"document.title='KAOPU · 皮肤自然痕迹实验室 R03';")
s=s.replace('skin-paint-r02-v3','skin-natural-traces-r03-v1')
s=s.replace("'kaopu.skin-paint/2'","'kaopu.skin-paint/2'")

(OUT/'preview.html').write_text(s)
build={
 'version':'SKIN-NATURAL-TRACES-R03',
 'sha256':hashlib.sha256(s.encode()).hexdigest(),
 'bytes':len(s.encode()),
 'baselineR02HTMLSHA256':BASE_SHA,
 'baselineCommit':'20649aea99244040e273233e16e191d37e10ccb8',
 'sameGeometry':True,
 'sourcePixelsCopied':False,
 'extraSamplerOverR02':0,
 'textureLayers':5,
 'textureBaseBytes':1024*1024*4*5,
 'kernel':'skin-natural-traces-r03-v1',
 'channelCoupling':['albedo','roughness','micro-normal'],
 'visualAccepted':False,
 'userVisualAccepted':False
}
(OUT/'BUILD.json').write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(build,ensure_ascii=False,indent=2))
