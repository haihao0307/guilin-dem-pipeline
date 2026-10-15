from pathlib import Path
import hashlib,json,re

HERE=Path(__file__).resolve().parent
REPO=HERE.parents[1]
BASE=REPO/'kaopu-unified-human-workbench/skin-natural-traces-r03/preview.html'
OUT=REPO/'kaopu-unified-human-workbench/skin-variation-dna-r01'
OUT.mkdir(parents=True,exist_ok=True)
raw=BASE.read_bytes()
BASE_SHA='7e483dbc9afa0102f1f3b16f7eb804000fb89fc91a1d906e52c68192454357f3'
assert hashlib.sha256(raw).hexdigest()==BASE_SHA,'Frozen R03.1 source SHA mismatch'
s=raw.decode('utf8')
def one(a,b):
 global s
 n=s.count(a)
 assert n==1,('DNA source anchor mismatch',a[:140],n)
 s=s.replace(a,b,1)
dna=(HERE/'dna-kernel.js').read_text()
one('/* KAOPU SSG-01 / Skin Surface Lab R01.',dna+'\n/* KAOPU SSG-01 / Skin Surface Lab R01.')
one("const VERSION='SKIN-NATURAL-TRACES-R03';","const VERSION='SKIN-VARIATION-DNA-R01';")
one('const result=window.KAOPU_TRACE_R03.pack(window.KAOPU_PAINT_R02.packColour(window.KAOPU_SSG_KERNEL.pack(generateField(seed))));',
    'const result=window.KAOPU_SKIN_VARIATION_DNA_R01.pack(window.KAOPU_TRACE_R03.pack(window.KAOPU_PAINT_R02.packColour(window.KAOPU_SSG_KERNEL.pack(generateField(seed)))));')
uniforms=['On','Amount','Vascular','Melanin','Sebum','EyePigment','EyeVascular','Acne','PIE','PIH','Scar','Follicle','Dryness','Sun','Asymmetry','Debug','Phase']
one('U={uTraceAmount:{value:1},',
    'U={'+''.join('uDna'+x+':{value:0},' for x in uniforms)+'uTraceAmount:{value:1},')
one('let f=GLSL+window.KAOPU_PAINT_R02.declarations+window.KAOPU_TRACE_R03.declarations+s.fragmentShader;',
    'let f=GLSL+window.KAOPU_PAINT_R02.declarations+window.KAOPU_TRACE_R03.declarations+window.KAOPU_SKIN_VARIATION_DNA_R01.declarations+s.fragmentShader;')
one('window.KAOPU_PAINT_R02.surface+window.KAOPU_TRACE_R03.surface+anchor',
    'window.KAOPU_PAINT_R02.surface+window.KAOPU_TRACE_R03.surface+window.KAOPU_SKIN_VARIATION_DNA_R01.surface+anchor')
one('paintAnchor+window.KAOPU_PAINT_R02.colour+window.KAOPU_TRACE_R03.colour',
    'paintAnchor+window.KAOPU_PAINT_R02.colour+window.KAOPU_TRACE_R03.colour+window.KAOPU_SKIN_VARIATION_DNA_R01.colour')
m=re.findall(r"material\.customProgramCacheKey=\(\)=>key\(\)\+[^;]+;",s)
assert len(m)==1,m
one(m[0],"material.customProgramCacheKey=()=>key()+'/skin-variation-dna-r01';")
one('const traceDefaults=structuredClone(window.KAOPU_TRACE_R03.defaults),',
    "const dnaPresets=window.KAOPU_SKIN_VARIATION_DNA_R01.presets;let dnaPreset='young',dnaSettings=structuredClone(dnaPresets.young),dnaEnabled=true,dnaDebug=0;\nconst traceDefaults=structuredClone(window.KAOPU_TRACE_R03.defaults),")
one('U.uTraceAmount.value=comparison?0:traceSettings.amount;',
    """U.uTraceAmount.value=0; // Old R03 marks become read-only event source, not double-painted.
U.uDnaOn.value=dnaEnabled&&!comparison?1:0;U.uDnaPhase.value=dnaSettings.phase;U.uDnaDebug.value=dnaEnabled&&!comparison?dnaDebug:0;
for(const [k] of window.KAOPU_SKIN_VARIATION_DNA_R01.spec){
 const name='uDna'+(k==='pie'?'PIE':k==='pih'?'PIH':k[0].toUpperCase()+k.slice(1));if(!U[name])throw Error('DNA uniform missing '+name);U[name].value=dnaSettings[k];
}""")
one('U.uTraceDebug.value=traceSettings.debug;','U.uTraceDebug.value=0;')
# Legacy fields stay in DOM for backward compatibility but are invisible and always disabled.
one('<div class="ssg-section-title"><span>03 / 自然生活痕迹</span>',
    '<div class="ssg-section-title" style="display:none"><span>03 / 自然生活痕迹</span>')
one('<div class="ssg-sliders" id="trace-controls">',
    '<div class="ssg-sliders" style="display:none" id="trace-controls">')
one('<div id="trace-note">','<div id="trace-note" style="display:none">')
one('<div class="ssg-checks"><select aria-label="自然痕迹诊断" id="trace-debug">',
    '<div class="ssg-checks" style="display:none"><select aria-label="自然痕迹诊断" id="trace-debug">')
one('<button id="trace-reset">恢复自然值</button>',
    '<button id="trace-reset" style="display:none">恢复自然值</button>')

dna_html='''<div class="ssg-section-title"><span>03 / SkinVariationDNA · 七类自然变化</span><button id="dna-enable" aria-label="自然变化开关">自然变化：开启</button></div>
<div id="dna-panel"><p class="dna-note">同一人物、同一镜头、同一冷暖灯光；只改变自然痕迹。关闭可查看不添加 DNA 的皮肤。</p>
 <label class="dna-label">人物预设 <select id="dna-preset" aria-label="三种自然皮肤预设"><option value="young">年轻｜少量粉刺和胡茬</option><option value="adult">成年｜眼周、痘印、自然色斑</option><option value="mature">成熟｜色素变化、血管、旧痘痕</option></select></label>
 <div class="ssg-sliders" id="dna-controls"></div>
 <label class="dna-label">语义蒙版 <select id="dna-debug" aria-label="DNA 七类解剖蒙版"><option value="0">自然合成</option><option value="1">1 · 血管/血色</option><option value="2">2 · 色素/雀斑</option><option value="3">3 · 皮脂粗糙度</option><option value="4">4 · 眼周 pigment/vascular</option><option value="5">5 · 粉刺/PIE/PIH/疤痕</option><option value="6">6 · 胡根/毛囊</option><option value="7">7 · 干燥/细屑</option><option value="8">七类综合诊断</option></select></label>
 <p class="dna-note">旧痘坑目前只有微法线候选，不冒称真实顶点位移；胡根已导出根点契约，独立毛发工具仍待接入。</p>
</div><div class="ssg-section-title"><span>04 / 光照与检查'''
one('<div class="ssg-section-title"><span>04 / 光照与检查',dna_html)
one('#trace-note{',
    '#dna-panel{margin:6px 0 14px}#dna-panel .dna-note{display:block;font-size:11px;line-height:1.5;color:rgba(255,255,255,.64);margin:6px 0 10px}#dna-panel .dna-label{display:block;font-size:12px;margin:12px 0}#dna-panel select{width:100%;margin-top:5px;background:#23272c;color:#eee;border:1px solid #555;padding:7px;border-radius:6px}#trace-note{')
ui_js="""const DNA=window.KAOPU_SKIN_VARIATION_DNA_R01;
const dnaControls=$('dna-controls');
dnaControls.innerHTML=DNA.spec.map(([k,label,min,max])=>'<label><span>'+label+'</span><output id="dna-v-'+k+'">0.00</output><input type="range" data-dna-param="'+k+'" aria-label="'+label+'" min="'+min+'" max="'+max+'" step=".01" value="0"></label>').join('');
function dnaSync(){
 $('dna-preset').value=dnaPreset;$('dna-enable').textContent=dnaEnabled?'自然变化：开启':'自然变化：关闭';
 $('dna-enable').setAttribute('aria-pressed',String(dnaEnabled));$('dna-debug').value=String(dnaDebug);
 for(const [k] of DNA.spec){const el=root.querySelector('[data-dna-param='+k+']');if(el&&document.activeElement!==el)el.value=dnaSettings[k];const o=$('dna-v-'+k);if(o)o.textContent=dnaSettings[k].toFixed(2);}
}
function dnaApply(){apply();dnaSync();}
$('dna-enable').onclick=()=>{dnaEnabled=!dnaEnabled;dnaApply();};
$('dna-preset').onchange=e=>{const p=e.target.value;if(!Object.prototype.hasOwnProperty.call(dnaPresets,p))return;dnaPreset=p;dnaSettings=structuredClone(dnaPresets[p]);dnaEnabled=true;dnaDebug=0;dnaApply();};
$('dna-debug').onchange=e=>{const v=Number(e.target.value);if(Number.isInteger(v)&&v>=0&&v<=8){dnaDebug=v;dnaApply();}};
root.addEventListener('input',e=>{const k=e.target.dataset.dnaParam;if(!k)return;const row=DNA.spec.find(x=>x[0]===k),v=Number(e.target.value);if(!row||!Number.isFinite(v)||v<row[2]||v>row[3])return;dnaSettings[k]=v;dnaApply();});
dnaSync();
window.skinVariationDNA_R01={
 version:'SKIN-VARIATION-DNA-R01',schema:DNA.schema,
 get enabled(){return dnaEnabled;},get preset(){return dnaPreset;},get settings(){return structuredClone(dnaSettings);},
 setEnabled(value){if(typeof value!=='boolean')throw Error('DNA switch requires boolean');dnaEnabled=value;dnaApply();},
 setPreset(key){if(!Object.prototype.hasOwnProperty.call(dnaPresets,key))throw Error('Unknown DNA preset');dnaPreset=key;dnaSettings=structuredClone(dnaPresets[key]);dnaEnabled=true;dnaDebug=0;dnaApply();},
 set(key,value){const r=DNA.spec.find(x=>x[0]===key);if(!r||!Number.isFinite(value)||value<r[2]||value>r[3])throw Error('Invalid DNA parameter '+key);dnaSettings[key]=value;dnaApply();},
 debug(v){if(!Number.isInteger(v)||v<0||v>8)throw Error('DNA diagnostic range 0..8');dnaDebug=v;dnaApply();},
 archive(){return{schema:DNA.schema,enabled:dnaEnabled,preset:dnaPreset,settings:structuredClone(dnaSettings),debug:dnaDebug};},
 restore(recipe){if(!recipe||recipe.schema!==DNA.schema||typeof recipe.enabled!=='boolean'||!Object.prototype.hasOwnProperty.call(dnaPresets,recipe.preset)||!Number.isInteger(recipe.debug)||recipe.debug<0||recipe.debug>8)throw Error('Invalid DNA recipe');const v=DNA.validate(recipe.settings);dnaPreset=recipe.preset;dnaSettings=v;dnaEnabled=recipe.enabled;dnaDebug=recipe.debug;dnaApply();},
 roots(seed){return DNA.roots(seed);},
 report(){const b=api.report();return{...b,version:'SKIN-VARIATION-DNA-R01',variationDNA:b.field?.variationDNA||null,dna:{enabled:dnaEnabled,preset:dnaPreset,settings:structuredClone(dnaSettings),debug:dnaDebug,semanticMaps:7,facts:DNA.facts},userVisualAccepted:false};}
};
"""
one('window.skinNaturalTracesR03={version:',ui_js+'window.skinNaturalTracesR03={version:')
s=s.replace('皮肤自然痕迹实验室 R03','皮肤自然变化工作台 R01')
s=s.replace('TRACES · R03','SKIN DNA · R01')
s=s.replace('LIVED-IN SKIN / SPARSE NATURAL TRACES','SKIN DNA / LIVED-IN FEATURES')
path=OUT/'preview.html';path.write_text(s)
build={'version':'SKIN-VARIATION-DNA-R01','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
 'bytes':path.stat().st_size,'inheritedR03SHA256':BASE_SHA,'sameGeometry':True,
 'sourcePixelsCopied':False,'newTextureLayers':2,'totalTextureLayers':7,
 'textureBaseBytes':7*1024*1024*4,'samplersAdded':0,
 'semanticMaps':['VascularMap','MelaninVariationMap','SebumRoughnessMap','UnderEyeMap','AcneHistoryMap','FollicleAndBeardMap','DrynessAndFlakeMap'],
 'presets':['young','adult','mature'],'vertexDisplacementImplemented':False,
 'nativeSSSRetained':True,'nativePoresRetained':True,'hairAdapterIntegrated':False,'userVisualAccepted':False}
(OUT/'BUILD.json').write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(build,ensure_ascii=False,indent=2))
