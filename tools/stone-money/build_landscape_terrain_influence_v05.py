#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'workbenches/landscape-surface-r5-k2-g3t3-palau-production/index.html'
OUT_DIR = ROOT / 'workbenches/landscape-terrain-influence-tool-v05'
OUTPUT = OUT_DIR / 'index.html'
META = OUT_DIR / 'build.json'

EXTRA_HEAD = r'''
<style id="landscapeTerrainInfluenceToolStyles">
:root{--lti-bg:rgba(6,16,20,.94);--lti-bg2:rgba(17,34,40,.96);--lti-line:rgba(231,244,246,.18);--lti-text:#eff7f7;--lti-muted:#a9b9bd;--lti-gold:#e4b269;--lti-green:#91c9aa;--lti-cyan:#73cbd9}
#ltiToggle{position:fixed;z-index:82;left:22px;top:116px;border:1px solid var(--lti-line);background:var(--lti-bg);color:var(--lti-text);padding:9px 12px;border-radius:10px;box-shadow:0 16px 42px #0007;backdrop-filter:blur(12px)}
#ltiPanel{position:fixed;z-index:81;left:22px;top:158px;width:360px;max-height:calc(100vh - 190px);overflow:auto;border:1px solid var(--lti-line);background:var(--lti-bg);color:var(--lti-text);border-radius:14px;box-shadow:0 24px 74px #0009;backdrop-filter:blur(15px);padding:14px;transform:translateX(calc(-100% - 34px));transition:transform .22s ease}
#ltiPanel.open{transform:translateX(0)}#ltiPanel *{box-sizing:border-box}#ltiPanel button,#ltiPanel input,#ltiPanel select,#ltiPanel textarea{font:inherit;color:inherit}
.lti-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.lti-eyebrow{font-size:8px;letter-spacing:.17em;color:var(--lti-gold);font-weight:800}.lti-head h2{font-size:15px;margin:4px 0 2px}.lti-sub{font-size:9px;color:var(--lti-muted);line-height:1.55}.lti-badge{font-size:8px;padding:5px 7px;border:1px solid #8bc7a455;color:#cfead9;border-radius:999px;white-space:nowrap}
.lti-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:13px 0}.lti-tabs button,.lti-grid button,.lti-actions button,.lti-stage button{border:1px solid var(--lti-line);background:#ffffff0a;border-radius:8px;padding:8px 6px}.lti-tabs button.active,.lti-grid button.active,.lti-stage button.active,.lti-actions button.primary{background:#375345;color:#fff;border-color:#7eaf91}
.lti-page{display:none}.lti-page.active{display:block}.lti-section{border-top:1px solid var(--lti-line);padding-top:11px;margin-top:11px}.lti-section h3{margin:0 0 8px;font-size:10px;letter-spacing:.08em;color:var(--lti-gold)}.lti-note{font-size:9px;color:var(--lti-muted);line-height:1.65;margin:7px 0}
.lti-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px}.lti-grid button{min-height:38px;font-size:9px;line-height:1.3;text-align:left}.lti-stage{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.lti-stage button{padding:7px 3px;font-size:8px}.lti-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}.lti-row label{font-size:9px;color:#dbe7e8}.lti-row output{font-size:9px;color:var(--lti-gold);font-variant-numeric:tabular-nums}.lti-range{width:100%;accent-color:#ba8b4c;margin:4px 0 0}.lti-input,.lti-select,.lti-textarea{width:100%;border:1px solid var(--lti-line);background:#071319;border-radius:7px;padding:7px 8px}.lti-three{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.lti-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.lti-actions button{flex:1;min-width:105px}.lti-textarea{min-height:170px;resize:vertical;font:9px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}.lti-contract{display:grid;grid-template-columns:1fr 1fr;gap:5px}.lti-contract div{border:1px solid var(--lti-line);background:#ffffff07;border-radius:8px;padding:7px;font-size:8px;line-height:1.5}.lti-contract b{display:block;color:var(--lti-cyan);font-size:8px;margin-bottom:2px}
#ltiToast{position:fixed;z-index:90;left:50%;bottom:92px;transform:translateX(-50%);display:none;background:#183027ee;color:#fff;padding:9px 12px;border-radius:9px;box-shadow:0 14px 40px #0008;font-size:10px}
@media(max-width:720px){#ltiToggle{left:10px;top:98px}#ltiPanel{left:10px;right:10px;top:140px;width:auto;max-height:calc(100vh - 205px)}.lti-grid{grid-template-columns:1fr 1fr}}
</style>
'''

EXTRA_BODY = r'''
<button id="ltiToggle" aria-controls="ltiPanel" aria-expanded="true">地形影响工具</button>
<aside id="ltiPanel" class="open" aria-label="Landscape 地形影响工具体系">
  <div class="lti-head"><div><div class="lti-eyebrow">LANDSCAPE TERRAIN INFLUENCE INSTRUMENT</div><h2>地形影响工具体系 V0.5</h2><div class="lti-sub">原 R5.K2.G3.T3 内核直接运行。无 iframe、无远程嵌套；十种形体、结构算子、表面算子与 Lightscape 中立输出合同统一在同一页面。</div></div><span class="lti-badge" id="ltiStatus">连接原台</span></div>
  <div class="lti-tabs"><button data-lti-tab="forms" class="active">十种形体</button><button data-lti-tab="ops">影响算子</button><button data-lti-tab="export">输出合同</button></div>
  <section class="lti-page active" data-lti-page="forms">
    <div class="lti-section"><h3>同源异形配方</h3><div class="lti-grid" id="ltiPresetGrid"></div><p class="lti-note">这十项是同一生成器的已调配方，不是十个外部模型。切换后仍可继续修改节理、溶蚀、洞腔、崩落、壳层 Warp、土层和外观。</p></div>
    <div class="lti-section"><h3>观察入口</h3><div class="lti-actions"><button data-lti-view="hero">全貌</button><button data-lti-view="cliff">岩壁</button><button data-lti-view="cave">洞壁</button><button data-lti-view="foot">坡脚</button><button data-lti-view="back">背面</button><button data-lti-view="section">剖面</button></div></div>
    <div class="lti-actions"><button id="ltiOpenOriginalPanel" class="primary">打开原始完整调节面板</button><button id="ltiHide">收起工具</button></div>
  </section>
  <section class="lti-page" data-lti-page="ops">
    <div class="lti-section"><h3>形成阶段</h3><div class="lti-stage" id="ltiStageGrid"></div></div>
    <div class="lti-section"><h3>真实几何算子</h3>
      <div class="lti-row"><label>节理裂隙</label><output data-out="fracture"></output></div><input class="lti-range" data-op="fracture" type="range" min="0" max="1.5" step=".05">
      <div class="lti-row"><label>溶沟侵蚀</label><output data-out="relief"></output></div><input class="lti-range" data-op="relief" type="range" min="0" max="1.5" step=".05">
      <div class="lti-row"><label>真实几何强度</label><output data-out="geo"></output></div><input class="lti-range" data-op="geo" type="range" min=".8" max="2.4" step=".05">
      <div class="lti-row"><label>洞腔／凹陷偏置</label><output data-out="concavity"></output></div><input class="lti-range" data-op="concavity" type="range" min=".2" max="1.25" step=".05">
      <div class="lti-row"><label>尖刺安全门</label><output data-out="spikeGuard"></output></div><input class="lti-range" data-op="spikeGuard" type="range" min="0" max="1" step=".05">
      <div class="lti-row"><label>土层微形体</label><output data-out="soilMicro"></output></div><input class="lti-range" data-op="soilMicro" type="range" min="0" max="1.5" step=".05">
      <div class="lti-actions"><button id="ltiApplyGeometry" class="primary">应用并重建真实几何</button></div>
    </div>
    <div class="lti-section"><h3>比例与表面算子</h3>
      <div class="lti-row"><label>高度</label><output data-out="heightScale"></output></div><input class="lti-range" data-op="heightScale" type="range" min=".65" max="1.55" step=".01">
      <div class="lti-row"><label>宽度</label><output data-out="widthScale"></output></div><input class="lti-range" data-op="widthScale" type="range" min=".65" max="1.60" step=".01">
      <div class="lti-row"><label>整体尺度</label><output data-out="overallScale"></output></div><input class="lti-range" data-op="overallScale" type="range" min=".60" max="1.60" step=".01">
      <div class="lti-row"><label>全壳层 Warp</label><output data-out="shellWarp"></output></div><input class="lti-range" data-op="shellWarp" type="range" min=".2" max="2.5" step=".05">
      <div class="lti-row"><label>连续破除</label><output data-out="shellBreakup"></output></div><input class="lti-range" data-op="shellBreakup" type="range" min="0" max="1.5" step=".05">
      <div class="lti-row"><label>湿润外观</label><output data-out="wet"></output></div><input class="lti-range" data-op="wet" type="range" min="0" max="1" step=".05">
      <p class="lti-note">高度／宽度／尺度、壳层 Warp 会改变可见形体或最终表面；湿润只改变外观，不得冒充地形几何。</p>
    </div>
  </section>
  <section class="lti-page" data-lti-page="export">
    <div class="lti-section"><h3>Lightscape 中立输入</h3>
      <label class="lti-note">目标地形真值 ID</label><input id="ltiTerrainTruth" class="lti-input" value="UNBOUND_TERRAIN_TRUTH">
      <div class="lti-row"><label>作用域</label></div><select id="ltiScope" class="lti-select"><option value="mask">区域 Mask</option><option value="spline-corridor">样条走廊</option><option value="volume">三维影响体</option><option value="whole-tile">整块地形</option></select>
      <div class="lti-row"><label>影响半径（米）</label><output id="ltiRadiusOut">120</output></div><input id="ltiRadius" class="lti-range" type="range" min="5" max="1000" step="5" value="120">
      <label class="lti-note">世界米制锚点 X / Y / Z</label><div class="lti-three"><input id="ltiX" class="lti-input" type="number" value="0"><input id="ltiY" class="lti-input" type="number" value="0"><input id="ltiZ" class="lti-input" type="number" value="0"></div>
    </div>
    <div class="lti-section"><h3>统一输出字段</h3><div class="lti-contract"><div><b>heightDelta</b>普通地表高度增量</div><div><b>solidDeltaSDF</b>洞穴、悬挑、负角度岩壁和体积变化</div><div><b>surface / normal</b>最终表面与法线</div><div><b>materialMasks</b>岩性、土层、湿痕和风化</div><div><b>collisionField</b>与可见形体同源碰撞</div><div><b>waterOcclusionField</b>与岩体同源的水体遮挡</div><div><b>soilField</b>土层及岩体承托</div><div><b>identity</b>来源提交、配方与参数哈希</div></div></div>
    <div class="lti-section"><h3>配方 JSON</h3><textarea id="ltiJson" class="lti-textarea" readonly></textarea><div class="lti-actions"><button id="ltiDownload" class="primary">下载 JSON</button><button id="ltiCopy">复制 JSON</button></div><p class="lti-note">这是适配前的中立合同。没有 Lightscape 正式 API 时，不冒称已完成插件接入。</p></div>
  </section>
</aside>
<div id="ltiToast"></div>
<script id="landscapeTerrainInfluenceTool">
(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const PRESETS=['P01 高耸礁塔','P02 宽顶岛丘','P03 穿洞高峰','P04 双峰脊塔','P05 蘑菇基座','P06 细腰孤峰','P07 阶台岩岛','P08 偏心斜塔','P09 洞群厚峰','P10 复合群峰'];
const STAGES=['原岩','节理','溶蚀','脱落','土层'];
const DEFAULTS={fracture:1,relief:1,geo:1.65,concavity:.85,spikeGuard:.95,soilMicro:.8,heightScale:1,widthScale:1,overallScale:1,shellWarp:1.9,shellBreakup:1.18,wet:0};
let currentPreset=0,currentStage=4,booted=false;
function toast(t){const e=$('#ltiToast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',2600)}
function originalInput(id){return document.getElementById(id)}
function value(id,fallback=0){const e=originalInput(id);const v=e?Number(e.value):fallback;return Number.isFinite(v)?v:fallback}
function setOriginal(id,v,fire=true){const e=originalInput(id);if(!e)return false;e.value=String(v);if(fire)e.dispatchEvent(new Event('input',{bubbles:true}));return true}
function syncOutputs(){$$('[data-op]').forEach(e=>{const k=e.dataset.op,v=value(k,DEFAULTS[k]);e.value=String(v);const o=$(`[data-out="${k}"]`);if(o)o.textContent=Number(v).toFixed(2)});$('#ltiRadiusOut').textContent=$('#ltiRadius').value;refreshJson()}
function renderPresets(){const g=$('#ltiPresetGrid');g.innerHTML='';PRESETS.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.classList.toggle('active',i===currentPreset);b.onclick=()=>{const src=document.querySelector(`[data-palau="${i}"]`);if(src){src.click();currentPreset=i;renderPresets();setTimeout(syncOutputs,200);toast('已调用 '+name)}else toast('原配方按钮尚未就绪')};g.appendChild(b)})}
function renderStages(){const g=$('#ltiStageGrid');g.innerHTML='';STAGES.forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.classList.toggle('active',i===currentStage);b.onclick=()=>{const src=document.querySelector(`[data-stage="${i}"]`);if(src){src.click();currentStage=i;renderStages();refreshJson()}else toast('阶段控制尚未就绪')};g.appendChild(b)})}
function payload(){const lm=window.__LM__;return {schema:'LANDSCAPE_TERRAIN_INFLUENCE_INSTRUMENT_V1',status:'adapter-contract-not-lightscape-plugin',source:{repository:'haihao0307/guilin-dem-pipeline',commit:'14fa478ff4545c2c58656bf57ba5326c03492a33',workbench:'workbenches/landscape-surface-r5-k2-g3t3-palau-production/index.html',kernel:lm?.release||'R5.K2.G3.T3'},input:{terrainTruthId:$('#ltiTerrainTruth').value.trim()||'UNBOUND_TERRAIN_TRUTH',scope:$('#ltiScope').value,influenceRadiusMeters:Number($('#ltiRadius').value),anchorMeters:{x:Number($('#ltiX').value)||0,y:Number($('#ltiY').value)||0,z:Number($('#ltiZ').value)||0},units:'m',upAxis:'Y'},preset:{index:currentPreset,id:'P'+String(currentPreset+1).padStart(2,'0'),name:PRESETS[currentPreset]},stage:{index:currentStage,name:STAGES[currentStage]},operators:{fracture:value('fracture',1),relief:value('relief',1),geometryStrength:value('geo',1.65),cavityConcavity:value('concavity',.85),spikeGuard:value('spikeGuard',.95),soilMicro:value('soilMicro',.8),heightScale:value('heightScale',1),widthScale:value('widthScale',1),overallScale:value('overallScale',1),shellWarp:value('shellWarp',1.9),shellBreakup:value('shellBreakup',1.18),wetAppearance:value('wet',0)},outputs:['heightDelta','solidDeltaSDF','surfaceField','normalField','materialMasks','collisionField','waterOcclusionField','soilField'],runtimeEvidence:lm?.report?{geometryGridM:lm.report.geometryGridM,parts:lm.report.parts,signatures:lm.signatures}:null,notes:['十种形体是同一函数生成器的配方，不是外部模型。','真实几何、碰撞和水体遮挡必须读取同一固体／空腔定义。','湿润与颜色只属于外观。','正式 Lightscape API 未提供前，本 JSON 只作为中立适配合同。']}}
function refreshJson(){const e=$('#ltiJson');if(e)e.value=JSON.stringify(payload(),null,2)}
function download(name,text){const a=document.createElement('a');a.download=name;a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
function bind(){if(booted)return;booted=true;document.documentElement.dataset.lightscapeToolReady='true';$('#ltiStatus').textContent='原台内核已连接';renderPresets();renderStages();$$('[data-lti-tab]').forEach(b=>b.onclick=()=>{$$('[data-lti-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('[data-lti-page]').forEach(p=>p.classList.toggle('active',p.dataset.ltiPage===b.dataset.ltiTab))});$('#ltiToggle').onclick=()=>{const p=$('#ltiPanel'),open=!p.classList.contains('open');p.classList.toggle('open',open);$('#ltiToggle').setAttribute('aria-expanded',String(open))};$('#ltiHide').onclick=()=>{$('#ltiPanel').classList.remove('open');$('#ltiToggle').setAttribute('aria-expanded','false')};$('#ltiOpenOriginalPanel').onclick=()=>document.getElementById('panelbtn')?.click();$$('[data-lti-view]').forEach(b=>b.onclick=()=>{const src=document.querySelector(`[data-view="${b.dataset.ltiView}"]`);src?.click()});$$('[data-op]').forEach(e=>{e.oninput=()=>{const k=e.dataset.op,o=$(`[data-out="${k}"]`);if(o)o.textContent=Number(e.value).toFixed(2);if(['heightScale','widthScale','overallScale','shellWarp','shellBreakup','wet'].includes(k))setOriginal(k,Number(e.value),true);refreshJson()}});$('#ltiApplyGeometry').onclick=()=>{for(const k of ['fracture','relief','geo','concavity','spikeGuard','soilMicro']){const e=$(`[data-op="${k}"]`);setOriginal(k,Number(e.value),false)}document.getElementById('apply')?.click();toast('正在按同一源场重建真实几何');setTimeout(syncOutputs,600)};['ltiTerrainTruth','ltiScope','ltiRadius','ltiX','ltiY','ltiZ'].forEach(id=>document.getElementById(id).addEventListener(id==='ltiTerrainTruth'?'input':'change',syncOutputs));$('#ltiRadius').addEventListener('input',syncOutputs);$('#ltiDownload').onclick=()=>download('LANDSCAPE_TERRAIN_INFLUENCE_RECIPE_FOR_LIGHTSCAPE.json',$('#ltiJson').value);$('#ltiCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#ltiJson').value);toast('JSON 已复制')}catch{$('#ltiJson').select();document.execCommand('copy');toast('JSON 已复制')}};syncOutputs();setInterval(refreshJson,1800)}
let tries=0;const timer=setInterval(()=>{tries++;if(window.__LM__&&document.querySelector('[data-palau="0"]')){clearInterval(timer);bind()}else if(tries>150){clearInterval(timer);$('#ltiStatus').textContent='原台连接超时';document.documentElement.dataset.lightscapeToolFailure='original-kernel-timeout'}},200);
})();
</script>
'''

def main():
    src = SOURCE.read_text(encoding='utf-8')
    if 'R5.K2.G3.T3' not in src or 'P10 复合群峰' not in src:
        raise RuntimeError('authoritative source markers missing')
    if '<iframe' in src.lower():
        raise RuntimeError('source unexpectedly contains iframe')
    out = src.replace('</head>', EXTRA_HEAD + '\n</head>', 1)
    out = out.replace('</body>', EXTRA_BODY + '\n</body>', 1)
    if out == src or 'landscapeTerrainInfluenceTool' not in out:
        raise RuntimeError('tool injection failed')
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(out, encoding='utf-8')
    META.write_text(json.dumps({
        'schema':'LANDSCAPE_TERRAIN_INFLUENCE_TOOL_V05',
        'sourceCommit':'14fa478ff4545c2c58656bf57ba5326c03492a33',
        'sourcePath':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
        'outputPath':str(OUTPUT.relative_to(ROOT)).replace('\\','/'),
        'selfContained':True,
        'iframeCount':out.lower().count('<iframe'),
        'presetCount':10,
        'toolSchema':'LANDSCAPE_TERRAIN_INFLUENCE_INSTRUMENT_V1',
        'lightscapeAdapterComplete':False,
        'landscapeMotherCloseoutModified':False
    },ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(OUTPUT),'bytes':OUTPUT.stat().st_size},ensure_ascii=False))

if __name__=='__main__':
    main()
