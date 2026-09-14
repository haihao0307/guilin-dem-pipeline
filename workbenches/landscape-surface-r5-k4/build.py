from pathlib import Path
import re,json,hashlib
out=Path(__file__).resolve().parent
source=out.parent/'landscape-surface-r5-k3/index.html'
s=source.read_text();assert hashlib.sha256(s.encode()).hexdigest()=='9044b7175b0c0df5a55c14481b4c4a758c18dd42a32b25acf10ae843f3505895'
base=s
s=s.replace('R5.K3','R5.K4').replace('<body>','<body class="mm-open">',1)
s=s.replace('<button id="info">说明</button>','<button id="mmToggle">显微</button><button id="info">说明</button>',1)
s=s.replace('活喀斯特 · 有机显微表面','大形 · 连续形面 · 显微细节',1)
ui='''<section id="mmPanel" class="glass"><div class="row"><b>Microscope · 形面融合</b><button id="mmClose" aria-label="关闭显微">×</button></div><div class="row"><label for="mmStrength">局部形面强度</label><output id="mmStrengthOut">1.00</output></div><input id="mmStrength" type="range" min="0" max="1" step=".05" value="1"><div class="mm-modes"><button data-mm="0">原状</button><button data-mm="1">仅色区</button><button data-mm="2">仅法线</button><button data-mm="3" class="active">形面融合</button></div><div class="buttons"><button id="mmFocus">细看</button><button id="mmSide">侧看</button><button id="mmQuad">四态并排</button><button id="mmSectionButton">实体截线</button></div><small>同一坐标场逐层细化；强度归零恢复原状。</small></section><div id="mmLabels" hidden><span>原状</span><span>仅色区</span><span>仅法线</span><span>真实形面＋细节</span></div><aside id="mmSection" class="glass"><div class="row"><b>同一高度的实体截线</b><button id="mmSectionClose">×</button></div><canvas id="mmSectionCanvas" width="480" height="260"></canvas><small>灰：原形　绿：当前真实三角面截线；坐标未夸大。</small></aside>'''
s=s.replace('<header>',ui+'<header>',1)
s=s.replace('</style>','''#mmPanel{display:none;position:absolute;left:22px;bottom:98px;width:308px;border-radius:12px;padding:14px;z-index:3}.mm-open #mmPanel{display:block}.mm-open #karstPanel{display:none}#mmPanel small,#mmSection small{display:block;font-size:10px;opacity:.75;line-height:1.7;margin-top:8px}#mmPanel .buttons{margin-top:8px}#mmPanel button{font-size:11px;padding:8px}.mm-modes{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}.mm-modes button{background:#e2e8da}.mm-modes button.active{background:var(--active)}#mmLabels{position:absolute;inset:0;pointer-events:none;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;padding-top:120px}#mmLabels[hidden]{display:none}.mm-quad #karstPanel,.mm-quad #mmPanel,.mm-quad nav.views,.mm-quad header .brand{display:none}#mmLabels span{margin:12px;color:#f6f3e8;text-shadow:0 1px 4px #000;font-size:13px}#mmSection{display:none;position:absolute;right:22px;bottom:100px;width:min(490px,90vw);padding:12px;border-radius:12px;z-index:5}#mmSection.open{display:block}#mmSectionCanvas{height:auto;touch-action:auto}.immersive #mmPanel,.immersive #mmSection{display:none}@media(max-width:640px){#mmPanel{left:12px;right:12px;width:auto;bottom:91px;max-height:30vh;overflow:auto;padding:10px}#mmPanel button{min-height:36px}#mmLabels{padding-top:92px}.brand{max-width:205px}.brand h1{font-size:12px}.subline{font-size:8px}#mmSection{left:12px;right:12px;bottom:310px;width:auto}#mmLabels span{font-size:10px}}
</style>''',1)
s=s.replace("<script>'use strict';\nconst VS=",'<script>'+ (out/'microscope-field.js').read_text()+"</script><script>'use strict';\nconst VS=",1)
s=s.replace('uniform mat4 uVP;out vec3 p;', 'layout(location=5) in vec3 aMMRef;uniform float uMMTarget;uniform mat4 uVP;out vec3 p;',1)
s=s.replace('void main(){vec3 z=aRest*.13;', 'void main(){vec3 z=(uMMTarget>.5?aMMRef:aRest)*.13;',1)
s=s.replace('q=aRest;d=aD;', 'q=uMMTarget>.5?aMMRef:aRest;d=aD;',1)
fspos=s.index('const FS=')
s=s[:fspos]+s[fspos:].replace('float bmH(vec3 p)',(out/'microscope.glsl').read_text()+'\nfloat bmH(vec3 p)',1)
addition='''
float mmSupport=mmPatch(q)*uMMTarget*uMMStrength;
if(mmSupport>0.&&uMMMode>0){vec3 ms=mmSpectrum(q);float cavity=smoothstep(.02,.26,-ms.x),edge=smoothstep(.02,.22,ms.x);if(uMMMode==1){albedo=mix(albedo,mix(vec3(.20,.245,.23),vec3(.72,.70,.59),clamp(.5+ms.x*1.4,0.,1.)),mmSupport*.65);}if(uMMMode==2||uMMMode==3){height*=1.-.75*mmSupport;height+=mmSupport*(ms.y*.70+(uMMMode==2?ms.x:0.))*.13/.42;}if(uMMMode==3){albedo*=1.+mmSupport*(.055*edge-.11*cavity);rough=clamp(rough+mmSupport*(.06*cavity+min(.045,ms.z*4.)-.025*edge),.35,1.);}}
'''
s=s.replace('if(uMicro>0.&&uMode==0&&!cap){',addition+'if(uMicro>0.&&uMode==0&&!cap){',1)
s=s.replace("'uKarstTops','uKarstWet']","'uKarstTops','uKarstWet','uMMTarget','uMMStrength','uMMMode']",1)
s=s.replace('livingAnchors=LivingKarst.anchors(parts);livingRebuild();', 'livingAnchors=LivingKarst.anchors(parts);livingRebuild();mmPrepare();',1)
start=s.index('function draw(){');end=s.index('function sync(){',start);s=s[:start]+s[end:]
s=s.replace('function getState(){return {process:', 'function getState(){return {micro:{...mmState},process:',1)
s=s.replace("'label,process,recipe,schema,view'].includes", "'label,process,recipe,schema,view','label,micro,process,recipe,schema,view'].includes",1)
s=s.replace('if(s.process)livingSet({...s.process,playing:false});state=', 'if(s.process)livingSet({...s.process,playing:false});if(s.micro)mmSet(s.micro);state=',1)
s=s.replace("release:'limestone-water-surface-r5-k3'","release:'limestone-water-surface-r5-k4'")
s=s.replace('try{initGL();livingInit();controls();livingControls();', (out/'microscope-renderer.js').read_text()+'\ntry{initGL();livingInit();controls();livingControls();mmControls();',1)
s=s.replace("requestAnimationFrame(render);build(recipe).catch(fail)","requestAnimationFrame(render);build(recipe).then(()=>mmFocus()).catch(fail)",1)
s=s.replace('<p id="details">','<p>R5.K4 在现有岩壁一处半径7的局部区域接入连续坐标域和17层嵌套余弦。第2—5层进入受约束的真实形面；第6—16层在片元求值并逐层按屏幕足迹过滤。静态细节不读取时间。颜色、粗糙度和细微法线从同一结构场派生；相机不改变几何精度。本轮没有生成新的穿透洞穴或重演原作的完整光线步进。</p><p id="details">',1)
for ident in ['worldSource','generateSource']:
 pattern=rf'<script id="{ident}"[^>]*>([\s\S]*?)</script>';assert re.search(pattern,s)[1]==re.search(pattern,base)[1]
(out/'index.html').write_text(s)
(out/'BUILD.json').write_text(json.dumps({'sourceCommit':'a202d8e06ca4572665079f20072e586150053336','sourceSha256':hashlib.sha256(base.encode()).hexdigest(),'candidateSha256':hashlib.sha256(s.encode()).hexdigest(),'candidateBytes':len(s.encode()),'worldGeneratorUnchanged':True,'baseGeometryGeneratorUnchanged':True,'boundedLocalGeometryChanged':True,'zeroStrengthRestoresBase':True,'visualApproved':False,'productionReady':False},indent=2)+'\n')
print(len(s.encode()))
