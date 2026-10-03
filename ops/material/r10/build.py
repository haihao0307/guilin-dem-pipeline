# R10 bounded patch: inherit R09, improve inspection, never import rejected R08 geometry.
import os,json,base64,hashlib,urllib.request,pathlib,re,sys,time
REPO='haihao0307/guilin-dem-pipeline'
API='https://api.github.com/repos/'+REPO
ROOT=pathlib.Path('r10_build');ROOT.mkdir(exist_ok=True)
TOKEN=os.environ['GH_TOKEN']
def api(path,method='GET',data=None):
 req=urllib.request.Request(API+path,method=method,headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json'},data=None if data is None else json.dumps(data).encode())
 with urllib.request.urlopen(req,timeout=90) as r:return json.load(r)
def file(path,ref):
 o=api('/contents/'+path+'?ref='+ref);return base64.b64decode(o['content']).decode(),o['sha']
def change(s,a,b):
 if a not in s:raise RuntimeError('Missing original signature: '+a[:110])
 return s.replace(a,b)
def save(name,s): (ROOT/name).write_text(s)
if sys.argv[1]=='build':
 head=api('/branches/gh-pages')['commit']['sha'];oldroot,rootsha=file('kaopu-material-workbench/index.html',head)
 names=['app.js','index.html','ui.css','wet-baseline.frag','wet-material-baseline.frag','wet-material.frag','iq-baseline.frag','iq-merged.frag']
 original={n:file('kaopu-material-workbench/lab-r09/'+n,head)[0] for n in names}
 expected={'app.js':'b67c666a8fb2651b303a457ab48a3d89eacea213efba1cf74005b11b1ab2551e','iq-merged.frag':'af46bc0291e305deac8fc919d814204970b2f09e495668b226eb179046d0c0b4','wet-material.frag':'4f4eddeaf2aa71a75fa50e5de975289da94a4e6f2ddeb791fb1dc9b5a97ca0d7'}
 for n,h in expected.items():assert hashlib.sha256(original[n].encode()).hexdigest()==h,(n,'R09 source changed')
 (ROOT/'original').mkdir(exist_ok=True)
 for n,s in original.items():(ROOT/'original'/n).write_text(s)
 (ROOT/'before.html').write_text(oldroot)
 (ROOT/'release.json').write_text(json.dumps({'rootBefore':rootsha,'baseCommit':head,'sources':expected}))
 for n in names:save(n,original[n])
 iq=original['iq-merged.frag']
 extra='''
// Inspection quality is independent from object identity. Extra octave amplitudes do not rewrite the first seven octaves.
uniform int uHD,uAASamples,uRigLook;
uniform float uMicro,uDetailZoom,uSurfaceRough,uSurfaceWet,uMicaDark,uMicaReflect;
float microTail(vec3 p){
 const mat3 m=mat3(0.,.80,.60,-.80,.36,-.48,-.60,-.48,.64);
 float a=.5;for(int j=0;j<7;j++){p=m*p*2.01;a*=.52;}
 float f=0.;for(int j=0;j<3;j++){f+=a*(2.*noise(p)-1.);p=m*p*2.01;a*=.52;}return f;
}
'''
 # Insert after fbm and before intersection helpers: noise is already declared here.
 iq=change(iq,'// https://iquilezles.org/articles/intersectors/',extra+'\n// https://iquilezles.org/articles/intersectors/')
 iq=change(iq,'int oct = int(max(6.0,floor(log2(iResolution.x)-2.0)));','int oct = uHD==1?7:int(max(6.0,floor(log2(iResolution.x)-2.0)));')
 iq=change(iq,'d += 0.06*uDisp*dis;','if(uHD==1&&uMicro>0.0){vec3 off=uNoiseSeed==0?vec3(0.):vec3(float(uNoiseSeed)*.317,float(uNoiseSeed)*.713,float(uNoiseSeed)*.113);dis+=doDisp*uMicro*microTail(4.*q+off);}\n        d += 0.06*uDisp*dis;')
 iq=change(iq,'if( abs(h.x)<0.0001 )','if( abs(h.x)<(uHD==1?0.000035:0.0001) )')
 iq=change(iq,'map(pos+0.0003*e,dis,time).x','map(pos+(uHD==1?max(.000045,.0003/(max(uDetailZoom,1.)*max(iResolution.x/960.,1.))):.0003)*e,dis,time).x')
 # Preserve original appearances, offer both original light arrangements through the common rig.
 iq=change(iq,'if(uSharedRig==0&&uLook==1){','if((uSharedRig==0&&uLook==1)||(uSharedRig==1&&uRigLook==1)){')
 iq=change(iq,'mate_alb *= 1.0-0.9*is_mica;','mate_alb *= 1.0-uMicaDark*is_mica;\n        if(uSurfaceWet>0.)mate_alb*=mix(1.,.66,uSurfaceWet);')
 iq=change(iq,'float mate_ks = 0.4 + 1.1*is_mica;','float mate_ks = 0.4 + uMicaReflect*is_mica;')
 iq=change(iq,'64.0*mate_ks);','64.0*mate_ks/uSurfaceRough*(1.+uSurfaceWet));')
 # Screen-fixed studio grey; geometry and background are not one texture.
 iq=change(iq,'vec3 col = uSharedRig==1?uBackground:vec3(0.0,0.0,0.0);','vec2 studioUV=(KP_NATIVE_PIXEL/iResolution.xy-.5);\n    float backdropGain=.78+.36*exp(-dot(studioUV*vec2(1.,1.3),studioUV*vec2(1.,1.3))*3.);\n    vec3 col=uSharedRig==1?uBackground*backdropGain:vec3(0.);')
 start=iq.index('void mainImage(')
 iq=iq[:start]+'''void mainImage(out vec4 fragColor,in vec2 fragCoord){
 ivec2 q=ivec2(fragCoord);srand(hash1i1i(q.x+hash1i1i(q.y+hash1i1i(iFrame))));
 vec3 col=vec3(0.);int samples=uHD==1?clamp(uAASamples,1,2):1;
 for(int m=0;m<2;m++){if(m>=samples)break;for(int n=0;n<2;n++){if(n>=samples)break;
 vec2 offset=samples==1?vec2(0.):((vec2(float(m),float(n))+.5)/float(samples)-.5)/uDetailZoom;
 vec2 fc=fragCoord+offset;vec2 p=(2.*fc-iResolution.xy)/iResolution.y;
 col+=render(p,iTime,1.0);
 }}col/=float(samples*samples);col+=(1./255.)*frand();fragColor=vec4(col,1.);
}
void main(){mainImage(fragColor,gl_FragCoord.xy);}
'''
 save('iq-merged.frag',iq)
 wet=original['wet-material.frag']
 wet=change(wet,'uniform int uSharedRig;','uniform int uSharedRig;uniform int uRigLook,uHD,uAASamples;uniform float uDetailZoom;')
 # Both wet lighting and backdrop use the IQ pair, including the blue alternate.
 sig='lpos[0]=rotateLight(lpos[0],uKeyAngles);'
 wet=change(wet,sig,'if(uRigLook==1){lpos[0]=4.*normalize(vec3(1.,.8,-.3));lpos[1]=4.*normalize(vec3(-1.,.5,.45));rad[0]=.65*vec3(16.,12.,8.);rad[1]=vec3(8.,12.,18.);}\n '+sig)
 wet=change(wet,'vec3 col=uBackground;','vec2 suv=KP_NATIVE_PIXEL/iResolution.xy-.5;vec3 col=uBackground*(.78+.36*exp(-dot(suv*vec2(1.,1.3),suv*vec2(1.,1.3))*3.));')
 # True supersampled rays. Do not enable teacher AA / depth-of-field by accident.
 wet=change(wet,'void main(){\n if(uBaseline==1)', 'void shadeWetAt(vec2 pixel){\n if(uBaseline==1)')
 # Restrict pixel substitutions to the new entry, not original teacher functions.
 k=wet.index('void shadeWetAt(');wet=wet[:k]+wet[k:].replace('gl_FragCoord.xy','pixel')
 wet+='''
void main(){int samples=uHD==1?clamp(uAASamples,1,2):1;vec3 total=vec3(0.);
 for(int m=0;m<2;m++){if(m>=samples)break;for(int n=0;n<2;n++){if(n>=samples)break;
 vec2 o=samples==1?vec2(0.):((vec2(float(m),float(n))+.5)/float(samples)-.5);
 shadeWetAt(KP_WET_SAMPLE);total+=outColor.rgb;
 }}outColor=vec4(total/float(samples*samples),1.);}
'''
 save('wet-material.frag',wet)
 app=original['app.js'].replace('R09','R10').replace('r09','r10')
 app=change(app,"const rigDefault={enabled:false,", "const rigDefault={enabled:false,") # original reset rig stays available
 app=change(app,"let states=clone(frozen),rig=clone(rigDefault),", "const extraDefaults={micro:.35,surfaceRough:1,surfaceWet:0,micaDark:.9,micaReflect:1.1};Object.assign(frozen.iq,extraDefaults);\nconst studioDefault={...clone(rigDefault),enabled:true,background:[.058,.064,.073],look:0};rigDefault.look=0;\nconst quality={mode:'auto',samples:1,hd:true};let manualResolution=0,saveTimer=0,lastEdit=0,inspectorTab='color';\nlet states=clone(frozen),rig=clone(studioDefault),")
 # zoomSource remains a camera-ray transform, never a CSS magnifier.
 a=app.index('function zoomSource(');b=app.index('\nfunction makeRenderer',a)
 app=app[:a]+'''function zoomSource(s){return s.replace(/gl_FragCoord\\.xy/g,'((gl_FragCoord.xy-.5*iResolution.xy)/uInspectZoom+.5*iResolution.xy+uInspectPan*iResolution.y)').replaceAll('KP_NATIVE_PIXEL','gl_FragCoord.xy').replaceAll('KP_WET_SAMPLE','((gl_FragCoord.xy+o-.5*iResolution.xy)/uInspectZoom+.5*iResolution.xy+uInspectPan*iResolution.y)').replace('#version 300 es','#version 300 es\\nuniform highp float uInspectZoom;uniform highp vec2 uInspectPan;');}
'''+app[b:]
 app=change(app,'uBackground:rr.background};','uBackground:rr.background,uRigLook:rr.look||0,uHD:useRig&&quality.hd?1:0,uAASamples:quality.samples,uDetailZoom:q.zoom,uMicro:s.micro||0,uSurfaceRough:s.surfaceRough||1,uSurfaceWet:s.surfaceWet||0,uMicaDark:s.micaDark??.9,uMicaReflect:s.micaReflect??1.1};')
 app=change(app,'function draw(){if(!ready)return;','function draw(){if(!ready)return;resizeForQuality();')
 app=change(app,'dirty=false;frames++;','dirty=false;frames++;updateReadout();')
 app=change(app,"function mark(){dirty=true;", "function mark(){dirty=true;lastEdit=performance.now();queueSave();")
 app=change(app,"$('sharedRig').checked=rig.enabled;}", "$('sharedRig').checked=rig.enabled;if($('returnMaterial'))$('returnMaterial').hidden=states[active].view===0;updateReadout();}")
 app=change(app,"'法线'","'表面朝向 · 几何推导'")
 app=change(app,"'原02暗灰外观'","'原02蓝灰外观'")
 app=change(app,"$('relation').textContent=wet?", "attachExtras(wet);$('relation').textContent=wet?")
 app=change(app,'updateControls();}\nfunction select(', 'updateControls();showInspector(inspectorTab);}\nfunction select(')
 app=change(app,"function reset(){$('rotate').textContent='开始旋转';states[active]=clone(frozen[active]);rig=clone(rigDefault);", "function reset(){$('rotate').textContent='开始旋转';states[active]=clone(frozen[active]);")
 # Look buttons are material presets, preserve shape. Blue preset explicitly restores its matching light arrangement for both stones.
 app=change(app,'states.iq.specular=.45;}build();','states.iq.specular=.45;}rig.enabled=true;rig.look=dark?1:0;build();')
 app=change(app,"states.iq.view=4+i;$('channel').value=4+i;mark();", "states.iq.view=states.iq.view===4+i?0:4+i;$('channel').value=states.iq.view;mark();")
 app=change(app,"rig=clone(rigDefault);rig.enabled=true;states.wet.baseline=false;", "rig=clone(studioDefault);states.wet.baseline=false;")
 # Defaults retain original geometry; persistence never overwrites frozen reference.
 app=change(app,"const requested=new URLSearchParams(location.search).get('case')||'home';select(", "installInspector();restoreSession();const requested=new URLSearchParams(location.search).get('case')||'iq';select(")
 app=change(app,"$('status').textContent='R10 · 两套原形体就绪 · 960 × 540 · 运行无贴图';", "$('status').textContent='R10 · 原形体继承 / 高清射线重算 / 独立材质层 / 共用双灯';")
 # Expose test hooks without modifying the main source interfaces.
 app=change(app,"setResolution:w=>{for(const r of Object.values(renderers)){r.canvas.width=w;r.canvas.height=w*9/16;}dirty=true;draw();}", "setResolution:w=>{manualResolution=w;for(const r of Object.values(renderers)){r.canvas.width=w;r.canvas.height=w*9/16;}dirty=true;draw();},setQuality:o=>{Object.assign(quality,o);manualResolution=0;dirty=true;draw();},quality:()=>clone(quality),showInspector,legacy:()=>{quality.hd=false;quality.samples=1;rig=clone(rigDefault);states.iq.micro=0;manualResolution=960;build();draw();}")
 extras=r'''
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem('KAOPU_R10_STATE',JSON.stringify(score()));}catch(e){}},700);}
function restoreSession(){try{const text=localStorage.getItem('KAOPU_R10_STATE');if(text){const o=JSON.parse(text);if(o.sourceFingerprint===sourceFingerprint&&o.schema==='kaopu.stone.r10'){importScore(o);}}}catch(e){console.warn('旧参数未载入',e.message);}}
function requestedWidth(){if(manualResolution)return manualResolution;const box=$('resultView').getBoundingClientRect(),device=window.devicePixelRatio||1;return quality.mode==='auto'?Math.min(2560,Math.max(960,Math.ceil(box.width*device/16)*16)):Number(quality.mode);}
function resizeForQuality(){if(overview&&!manualResolution)return;const w=requestedWidth();for(const r of Object.values(renderers)){const limit=Math.min(r.gl.getParameter(r.gl.MAX_RENDERBUFFER_SIZE),4096);const rw=Math.min(w,limit);if(r.canvas.width!==rw){r.canvas.width=rw;r.canvas.height=Math.round(rw*9/16);}}}
function updateReadout(){if(!$('resolutionInfo')||!renderers.result)return;const c=renderers.result.canvas;$('resolutionInfo').textContent=`${c.width} × ${c.height} · ${quality.samples===2?'4次子像素采样':'原生采样'} · ${Math.round(inspect[active].result.zoom*100)}%`;$('surfaceModeNote').textContent=states[active].view===0?'完整材质 · 形体与斑纹独立':'当前为诊断通道；其他材质层仍保留。点击“返回完整材质”。';}
function showInspector(tab){inspectorTab=tab;if(active==='wet'&&['shape','layers'].includes(tab))inspectorTab='color';for(const [key,ids] of Object.entries({color:['colorPanel'],shape:['shapePanel'],layers:['layersPanel'],light:['rigPanel'],quality:['qualityPanel']})){for(const id of ids)$(id).hidden=key!==inspectorTab;}document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('on',b.dataset.tab===inspectorTab);b.hidden=active==='wet'&&['shape','layers'].includes(b.dataset.tab);});}
function attachExtras(wet){
 if(!wet){slider('iqBase','surfaceRough','反光宽窄 / 粗糙',.35,2.5,.01);slider('iqBase','surfaceWet','湿润响应',0,1,.01);slider('iqBase','micaDark','云母暗斑深度',0,1,.01);slider('iqBase','micaReflect','云母反光强度',0,2.5,.01);slider('shapeControls','micro','微起伏 · 原噪声延展',0,1,.01);}
 $('microExplanation').hidden=wet;
 $('qualityInfo').textContent=wet?'01 保留原形体、裂纹与苔层几何；原老师高频颗粒仍包含程序推导的光照朝向细节，不冒充全部是轮廓位移。':'02 保留原7层几何噪声，微起伏只延展同一噪声的第8—10层。几何频谱不随镜头换成另一块石头。';
 for(let i=0;i<4;i++){if($('layer'+i)){$('layer'+i).classList.toggle('layerOff',!states.iq.layers[i].on);}}
}
function installInspector(){
 $('darkLook').textContent='原02 · 蓝灰丰富斑纹';$('iqOriginal').textContent='原03 · 白灰云母';$('rigPanel').open=true;
 const colorPanel=$('palettes').closest('section');colorPanel.id='colorPanel';
 const inspector=document.createElement('aside');inspector.id='inspector';
 inspector.innerHTML='<div class="inspectorHead"><b>材质控制室</b><span>参数即时保存</span></div><div class="inspectorTabs"><button data-tab="color">色彩</button><button data-tab="shape">形状</button><button data-tab="layers">斑纹层</button><button data-tab="light">双灯</button><button data-tab="quality">精度</button></div><div id="inspectorBody"></div>';
 const desk=document.createElement('div');desk.id='desk';const view=document.createElement('div');view.id='viewColumn';$('stage').before(desk);desk.append(view,inspector);view.append($('stage'),$('closed'));const hint=document.querySelector('.hint');if(hint)view.append(hint);
 $('rigPanel').querySelector('summary').textContent='共同工作室 · 原 IQ 主光＋次光';$('rigPanel').querySelector('p.muted').textContent='01、02默认使用同一组暖主光与冷次光、灰色工作室背景。灯光变化不会改变石头或斑纹种子。';
 const qualityPanel=document.createElement('section');qualityPanel.className='panel';qualityPanel.id='qualityPanel';qualityPanel.innerHTML='<h3>高清观察</h3><label class="qualityRow">渲染像素<select id="renderQuality"><option value="auto">匹配显示像素 · 自动</option><option value="1920">1920 × 1080</option><option value="2560">2560 × 1440</option><option value="3840">3840 × 2160 · 高耗时</option><option value="960">960 × 540 · 原版对照</option></select></label><label class="qualityRow">边缘 / 颗粒采样<select id="sampleQuality"><option value="1">原生清晰</option><option value="2">精修 · 每像素4次射线</option></select></label><p id="qualityInfo" class="muted"></p><p id="microExplanation" class="muted">微起伏在“形状”页独立调节；不是锐化贴图。放大后重新求交、重新着色。</p><button id="exactR09">R09原始采样对照</button><button id="hdReturn">返回高清工作室</button><p class="muted">4K与4次采样会明显增加GPU工作量；不降低或随机替换模型。</p>';
 $('inspectorBody').append(colorPanel,$('shapePanel'),$('layersPanel'),$('rigPanel'),qualityPanel);
 document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>showInspector(b.dataset.tab));
 $('renderQuality').onchange=e=>{quality.mode=e.target.value;manualResolution=0;quality.hd=true;dirty=true;draw();};$('sampleQuality').onchange=e=>{quality.samples=+e.target.value;dirty=true;draw();};
 $('exactR09').onclick=()=>{quality.hd=false;quality.mode='960';quality.samples=1;rig=clone(rigDefault);states.iq.micro=0;manualResolution=960;updateControls();draw();};
 $('hdReturn').onclick=()=>{quality.hd=true;quality.mode='auto';manualResolution=0;rig=clone(studioDefault);states.iq.micro=.35;updateControls();draw();};
 const bar=document.createElement('div');bar.className='qualityBar';bar.innerHTML='<span id="surfaceModeNote"></span><b id="resolutionInfo"></b><button id="returnMaterial" hidden>返回完整材质</button>';view.prepend(bar);$('returnMaterial').onclick=()=>{states[active].view=0;updateControls();};
 window.addEventListener('resize',()=>{if(!manualResolution)dirty=true;});
 // Maintain obvious access to a large same-camera ten-color contact sheet.
 const oldGallery=gallery;$('galleryButton').onclick=async()=>{await oldGallery();$('gallery').classList.add('fullGallery');};
 $('rigReset').textContent='恢复统一双灯';$('rigReset').onclick=()=>{rig=clone(studioDefault);updateControls();};
}
'''
 app=app.replace('function tick(t){',extras+'\nfunction tick(t){')
 # Keep thumbnail draws separate; their resolution never changes the saved surface definition.
 app=app.replace("window.KAOPU9={ready:true", "window.KAOPU10=window.KAOPU9={ready:true")
 save('app.js',app)
 html=original['index.html'].replace('R09','R10').replace('原版继承','高清观察室')
 html=html.replace('原始基线默认不变，改动可一键恢复。','原形体保留；默认统一双灯与灰背景，原始采样可回看。')
 # Distinct version badge is never only a query string.
 html=html.replace('石头材质总工作台','石头材质 · 高清观察室')
 save('index.html',html)
 css=original['ui.css']+'''\n/* R10: side-by-side inspection, not more hidden panels below a giant image. */
:root{color-scheme:dark}html{scrollbar-color:#52616b #111a20}body{background:#10171c;color:#e3e9eb}main{max-width:1920px;padding:18px 24px}header{background:#10171cf7;border-bottom:1px solid #2b383f;padding:12px 0;gap:16px}header small{letter-spacing:.18em;color:#c6b28a}header h1{font-size:22px}button,select{border-radius:7px;transition:border-color .15s,background .15s}button:hover{border-color:#c9b88c}button.on,button.gold{background:#d5c398;color:#172026}#catalog{gap:12px;margin:14px 0}#catalog:not(.overview) .case canvas{width:78px;height:48px}#catalog:not(.overview) .case{grid-template-columns:78px 1fr;padding:0;min-height:56px}#catalog:not(.overview) .case span{padding:7px 12px}#catalog:not(.overview) em{font-size:11px}.titleRow{margin:12px 0}.titleRow h2{font-size:20px}.titleRow p{font-size:12px}.toolbar{margin:12px 0;padding:10px;background:#19232a}#desk{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:16px;align-items:start}#viewColumn{min-width:0;position:sticky;top:82px}#inspector{min-width:0;border:1px solid #34424a;border-radius:12px;background:#172127;overflow:hidden;max-height:calc(100vh - 120px);display:flex;flex-direction:column;position:sticky;top:82px}.inspectorHead{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid #293941}.inspectorHead span{font-size:11px;color:#9db2b7}.inspectorTabs{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:9px;border-bottom:1px solid #2b3a43}.inspectorTabs button{padding:8px 3px;font-size:12px}.inspectorTabs button[hidden]{display:none}#inspectorBody{overflow-y:auto;overscroll-behavior:contain;padding:10px;min-height:0;max-height:70vh}#inspector .panel{margin:0;padding:10px;background:transparent;border:0}#inspector .controls{grid-template-columns:1fr;gap:10px}#inspector .control{grid-template-columns:105px minmax(0,1fr) 48px;font-size:12px}#inspector .colorRow{display:flex;justify-content:space-between;gap:12px;align-items:center}#inspector input[type=color]{width:88px;height:30px;border-radius:6px;background:transparent;border:1px solid #44555d}#inspector .palettes{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}#inspector .palettes button{padding:5px;font-size:10px;min-width:0}#inspector .palettes i{height:16px}#inspector .layers{display:block}#inspector .layer{margin:0 0 12px;padding:12px 10px;border:1px solid #344852;border-radius:9px;background:#111c23}.layerOff{opacity:.78}.layerHead{gap:5px;align-items:center}.layerHead button{font-size:10px;padding:5px}.layerHead label{font-size:12px}.sectionHead{flex-wrap:wrap;gap:8px}#lookButtons{display:flex;flex-wrap:wrap;gap:6px}#lookButtons button{font-size:12px}.qualityBar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:11px;color:#a9babd;margin:0 0 8px}.qualityBar b{font-weight:500;color:#d9cda9}.qualityBar button{font-size:11px;padding:4px 8px}.stage{gap:10px}.stage .viewport{max-width:none;max-height:none;aspect-ratio:16/9;width:100%}.stage canvas{width:100%;height:100%;display:block;touch-action:none}.pane{border-color:#3b494f;border-radius:10px}.paneHead{padding:10px 12px;min-height:44px}.paneHead div{display:flex;gap:4px;align-items:center}.hint{font-size:11px;padding:8px 0;color:#94a7ad}.qualityRow{display:flex;flex-direction:column;gap:8px;margin:15px 0}.qualityRow select{width:100%;padding:9px}.fullGallery{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.fullGallery figure{margin:0}.fullGallery img{width:100%;display:block}.fullGallery figcaption{font-size:11px}.muted{line-height:1.65}#functions{margin-top:28px}#teacherPanel{margin-top:20px}footer{padding-top:18px}#qualityInfo{padding:10px;border-left:2px solid #b9a67c;background:#111b21}#channel{max-width:140px}#closed{padding:60px 20px}[hidden]{display:none!important}
@media(min-width:1500px){#desk{grid-template-columns:minmax(0,1fr) 410px}#inspectorBody{max-height:74vh}}
@media(max-width:1050px){main{padding:12px}#desk{grid-template-columns:1fr}#viewColumn,#inspector{position:static}#inspector{max-height:none}#inspectorBody{max-height:none}#inspector .control{grid-template-columns:130px 1fr 48px}#catalog:not(.overview) .case{display:grid}header{position:static}.stage{grid-template-columns:1fr}#channel{max-width:130px}}
@media(max-width:600px){main{padding:8px}header h1{font-size:18px}header nav{gap:4px}header nav button{padding:7px;font-size:11px}#catalog:not(.overview) .case{grid-template-columns:55px 1fr}#catalog:not(.overview) .case canvas{width:55px;height:40px}#catalog em{display:none}#catalog b{font-size:11px}#catalog:not(.overview) .case span{padding:5px}.titleRow h2{font-size:17px}.titleRow p{font-size:11px}.toolbar{gap:5px;padding:8px}.toolbar button{font-size:11px;padding:6px}.paneHead{padding:7px}.paneHead b{font-size:11px}.paneHead button{padding:4px 6px}.paneHead output{font-size:10px}.qualityBar{font-size:10px}#inspector .control{grid-template-columns:110px 1fr 43px}.inspectorHead{padding:12px}.inspectorTabs{position:sticky;top:0;background:#172127;z-index:4}}
'''
 save('ui.css',css)
 # Static audit: no rejected geometry, no texture dependency, exact old files remain unchanged.
 assert 'rockBase' not in iq and 'vec3(1.4,-1.5,1.3)*sin( float(i)*vec3(63,103,4)+2.0 )' in iq
 for n in ['iq-merged.frag','wet-material.frag']:
  s=(ROOT/n).read_text();assert 'sampler2D' not in s and not re.search(r'\btexture\s*\(',s),n
 (ROOT/'BASELINE_AUDIT.json').write_text(json.dumps({'base':'R09','frozenByteIdentical':{n:(ROOT/n).read_text()==original[n] for n in ['wet-baseline.frag','wet-material-baseline.frag','iq-baseline.frag']},'geometry':'IQ original planes and seven-octave fBm retained; optional fixed micro tail only','noTexture':True},indent=2))
 # Build a portable exact-content companion. Online page stays the primary delivery.
 bundle={n:(ROOT/n).read_text() for n in names if n.endswith('.frag')}
 portable=html.replace('<link rel="stylesheet" href="ui.css">','<style>'+css+'</style>').replace('<script src="app.js"></script>','<script>window.KAOPU_BUNDLE='+json.dumps(bundle).replace('</','<\\/')+';</script><script>'+app.replace('</','<\\/')+'</script>')
 save('R10_STANDALONE.html',portable)
 save('NOTES.md','# R10 高清材质观察室\n\n继承 R09 两套原形体，不使用被否定的 R08。01 默认启用 IQ 主次灯；两个对象共用灰色程序背景。\n\n实际 canvas 像素匹配屏幕，可选1080p/1440p/4K；放大改变采样射线，不做CSS放大。可选4次射线采样减少锯齿，代价是GPU工作量增加。IQ原七层噪声保留；第8—10层同源微起伏独立控制，形体不随镜头换层。\n\n右侧常驻色彩、形状、四层斑纹、双灯、精度控制。原02蓝灰与原03白灰外观都可恢复；各层参数、导航与窗口状态可保存。\n\n没有法线贴图；照明仍使用由函数梯度求得的表面朝向。01原老师的部分高频信息属于程序光照朝向层，不被冒称为全部真实位移。诊断通道不改变材质。\n\n用户所说云母层不是发光层；保持原云母暗斑/反光并开放独立强度。\n\n源码授权沿用原 IQ/TDM CC BY-NC-SA 3.0；未新获商业授权。\n')
 print('BUILD_R10_OK',len(app),len(iq))
elif sys.argv[1]=='publish':
 rel=json.loads((ROOT/'release.json').read_text());head=api('/branches/gh-pages')['commit']['sha'];c=api('/git/commits/'+head);cur,sha=file('kaopu-material-workbench/index.html',head)
 if sha!=rel['rootBefore']:raise RuntimeError('Material root concurrently changed; not overwritten')
 entries=[]
 for p in ROOT.iterdir():
  if not p.is_file() or p.name in ['before.html','release.json']:continue
  entries.append({'path':'kaopu-material-workbench/lab-r10/'+p.name,'mode':'100644','type':'blob','content':p.read_text()})
 index=(ROOT/'index.html').read_text().replace('href="ui.css"','href="lab-r10/ui.css"').replace('src="app.js"','src="lab-r10/app.js"')
 entries += [{'path':'kaopu-material-workbench/index.html','mode':'100644','type':'blob','content':index},{'path':'kaopu-material-workbench/history/hub-before-r10.html','mode':'100644','type':'blob','content':cur}]
 tree=api('/git/trees','POST',{'base_tree':c['tree']['sha'],'tree':entries})['sha'];commit=api('/git/commits','POST',{'message':'feat(material): R10 high-resolution inspection, visible layer controls, shared IQ lighting; preserve R09 geometry','tree':tree,'parents':[head]})['sha']
 api('/git/refs/heads/gh-pages','PATCH',{'sha':commit,'force':False});save('public-index.html',index);rel['publishCommit']=commit;rel['publicIndexSHA256']=hashlib.sha256(index.encode()).hexdigest();(ROOT/'release.json').write_text(json.dumps(rel));print('PUBLISHED_COMMIT',commit)
elif sys.argv[1]=='archive':
 proof=json.loads(pathlib.Path('evidence/PUBLICATION_PROOF.json').read_text());proof['release']=json.loads((ROOT/'release.json').read_text());proof['baselineAudit']=json.loads((ROOT/'BASELINE_AUDIT.json').read_text())
 content=json.dumps(proof,ensure_ascii=False,indent=2);payload={'message':'test(material): archive R10 public rendering and regression proof','content':base64.b64encode(content.encode()).decode(),'branch':'main'}
 api('/contents/kaopu-material-workbench/lab-r10/PUBLICATION_PROOF.json','PUT',payload)
 print('ARCHIVED_PROOF')
