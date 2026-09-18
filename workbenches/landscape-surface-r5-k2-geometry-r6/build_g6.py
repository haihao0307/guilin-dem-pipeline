from pathlib import Path
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r5/index.html"
OUT = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r6/index.html"
BUILD = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r6/build.json"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


raw = SRC.read_bytes()
source_sha = sha256(raw)
s = raw.decode("utf-8")
assert "R5.K2.G5" in s and "LANDSCAPE_VOLUMETRIC_MICROSCOPE_R2" in s

s = s.replace("R5.K2.G5 Volumetric Form", "R5.K2.G6 Live Real-Form Controls", 1)
s = s.replace("水蚀岩壁 R5.K2.G5", "水蚀岩壁 R5.K2.G6", 1)
s = s.replace("Volumetric Domain Warp + Real Cavity Geometry", "Visible Real-Form Controls + Automatic Mesh Rebuild", 1)
s = s.replace("R5.K2.G5 先扭曲完整体积域并改写源隐式场", "R5.K2.G6 保留完整体积域形变，并把真实形体控制直接暴露为自动网格重建", 1)

css = r'''
.form-build-state{margin:10px 0 12px;padding:10px 11px;border-radius:8px;background:#dfe8dd;border:1px solid #b8c8b6;font-size:11px;line-height:1.55}
.form-build-state.busy{background:#efe7d5;border-color:#cbb988}
.quick-form{margin:8px 0 12px}.quick-form button{flex:1;min-width:76px;background:#dce5d8}.quick-form button.active{background:var(--active);color:#fff}
.stage-controls[open]{padding-bottom:3px}.stage-controls>summary{font-weight:650;color:#213a32}
.surface-only{margin-top:15px;border-top:1px solid #a9b8a555;padding-top:10px}.surface-only>summary{font-weight:650;color:#6c6659}
.panel.open{display:block}.panel{width:326px}.panel .apply{position:sticky;bottom:0;z-index:2;box-shadow:0 -7px 18px #f4f5eddd}
@media(max-width:640px){.panel{width:auto}.quick-form button{min-width:70px}}
'''
s = s.replace("</style></head>", css + "</style></head>", 1)

s = s.replace('<aside class="panel glass" id="panel">', '<aside class="panel glass open" id="panel">', 1)
s = s.replace(
    '<aside class="panel glass open" id="panel"><div class="row"><h3>一套配方 · 同一世界</h3><button id="closepanel" aria-label="关闭调节">×</button></div>',
    '<aside class="panel glass open" id="panel"><div class="row"><h3>真实形体控制 · 同一世界</h3><button id="closepanel" aria-label="关闭调节">×</button></div><div class="buttons quick-form"><button data-quick-form="off">A 原始实体</button><button data-quick-form="standard" class="active">B 默认实体</button><button data-quick-form="strong">C 强实体</button></div><div id="formBuildState" class="form-build-state">当前为默认实体形体。点击 A/B/C 会立即重建；拖动真实形体滑杆后松开也会自动重建。</div>',
    1,
)
s = s.replace('<details class="stage-controls"><summary>形成阶段与几何参数</summary>', '<details class="stage-controls" open><summary>真实形体 · 会重新生成三角网格</summary>', 1)
s = s.replace('重新生成当前阶段', '立即重建真实形体', 1)
s = s.replace(
    '源形体参数会改写 rock/ground 隐式场并重新提取网格；不是材质图案。阶段与开度无地质年数映射。',
    '实体形变、体积域 Warp、洞壁切削与土壤高程都会重新生成真实三角网格。松开滑杆即自动重建；下面的材质区不改变形体。',
    1,
)
s = s.replace('</details><h4>表面 / 实时调节</h4>', '</details><details class="surface-only"><summary>材质与壳层（只改显示，不改形体）</summary><h4>表面 / 实时调节</h4>', 1)
s = s.replace('<h4>样板配方</h4>', '</details><h4>样板配方</h4>', 1)

state_anchor = "let state={theta:.50,phi:1.26,radius:116,target:[-3,20,0],mode:1,section:false,scope:0,shellScale:.94,shellContrast:1.20,shellCoverage:.78,shellDirection:18,shellWarp:1.10,shellBreakup:.72,micro:0,breakContrast:1.00,wet:0,exposure:1.08,grass:true,selected:0},gl,program,U={},parts=[],report=null,busy=false,worker=null,epoch=0,dirty=true,eye,viewName='hero',errorLog=[],renderTimes=[],cache=new Map();"
assert state_anchor in s
s = s.replace(state_anchor, state_anchor + "\nlet formRebuildTimer=0,pendingFormReason='';", 1)

key_anchor = "function key(r){return JSON.stringify(r)}\nasync function build(newRecipe){"
assert key_anchor in s
helpers = r'''function key(r){return JSON.stringify(r)}
function panelRecipe(){return {...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,sourceForm:+$('#sourceForm').value,sourceScale:+$('#sourceScale').value,sourceWarp:+$('#sourceWarp').value,sourceErosion:+$('#sourceErosion').value,geo:+$('#geo').value,concavity:+$('#concavity').value,spikeGuard:+$('#spikeGuard').value,soilMicro:+$('#soilMicro').value,seed:+$('#seed').value}}
function mainMeshReport(){return report?.parts?.find(p=>p.name==='主岩体')||null}
function updateFormEvidence(prefix='真实网格已生成'){
  const el=$('#formBuildState');if(!el||!report)return;
  const p=mainMeshReport(),src=report.sourceMicroscope,soil=report.soilMicroscope;
  const sig=p?.signature||'--',short=sig.split(':')[0],warp=src?.maxDomainWarpM??0,cut=src?.maxFieldOffsetM??0,ground=soil?.maxSampleOffsetM??0;
  el.classList.remove('busy');
  el.textContent=`${prefix}｜主岩体 ${Number(report.mainVertices||0).toLocaleString()} 顶点｜签名 ${short}｜体积域 ${warp.toFixed(2)} m｜切削 ${cut.toFixed(2)} m｜地面 ${ground.toFixed(2)} m`;
}
async function rebuildForm(reason='真实形体参数'){
  const el=$('#formBuildState');$('#panel').classList.add('open');
  if(busy){pendingFormReason=reason;clearTimeout(formRebuildTimer);formRebuildTimer=setTimeout(()=>rebuildForm(pendingFormReason),260);return}
  if(el){el.classList.add('busy');el.textContent=`正在按“${reason}”重新计算体积场并生成真实三角网格……`}
  const before=mainMeshReport()?.signature||'';
  try{
    await build(panelRecipe());
    const after=mainMeshReport()?.signature||'';
    updateFormEvidence(before&&after&&before!==after?'真实形体已经改变':'真实网格已重建');
    toast(before&&after&&before!==after?'真实三角网格已改变':'真实三角网格已重建');
  }catch(e){if(el){el.classList.remove('busy');el.textContent='真实形体重建失败：'+(e.message||e)}throw e}
}
function queueFormRebuild(reason){pendingFormReason=reason;clearTimeout(formRebuildTimer);formRebuildTimer=setTimeout(()=>rebuildForm(pendingFormReason),140)}
async function build(newRecipe){'''
s = s.replace(key_anchor, helpers, 1)

upload_anchor = "gl.bindVertexArray(null);report=data.report;$('#status').textContent="
assert upload_anchor in s
s = s.replace(upload_anchor, "gl.bindVertexArray(null);report=data.report;updateFormEvidence();$('#status').textContent=", 1)

old_controls = "for(let k of ['fracture','relief','sourceForm','sourceWarp','sourceErosion','geo','concavity','spikeGuard','soilMicro'])$('#'+k).oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);$('#sourceScale').oninput=e=>$('#sourceScaleOut').textContent=(+e.target.value).toFixed(2)+' m';const formPresets={off:{sourceForm:0,sourceScale:7.5,sourceWarp:0,sourceErosion:0},standard:{sourceForm:1.30,sourceScale:7.5,sourceWarp:1.40,sourceErosion:1.10},strong:{sourceForm:2.10,sourceScale:8.6,sourceWarp:1.85,sourceErosion:1.45}};$$('[data-form]').forEach(b=>b.onclick=()=>{let p=formPresets[b.dataset.form];for(let k of Object.keys(p)){$('#'+k).value=p[k];let out=$('#'+k+'Out');if(out)out.textContent=k==='sourceScale'?p[k].toFixed(2)+' m':p[k].toFixed(2)}$$('[data-form]').forEach(x=>x.classList.toggle('active',x===b))});"
assert old_controls in s
new_controls = r'''const geometryKeys=['fracture','relief','sourceForm','sourceWarp','sourceErosion','geo','concavity','spikeGuard','soilMicro'];
for(let k of geometryKeys){const input=$('#'+k);input.oninput=e=>$('#'+k+'Out').textContent=(+e.target.value).toFixed(2);input.onchange=()=>queueFormRebuild(input.previousElementSibling?.querySelector('label')?.textContent||k)}
$('#sourceScale').oninput=e=>$('#sourceScaleOut').textContent=(+e.target.value).toFixed(2)+' m';$('#sourceScale').onchange=()=>queueFormRebuild('实体变化尺度');
const formPresets={off:{sourceForm:0,sourceScale:7.5,sourceWarp:0,sourceErosion:0},standard:{sourceForm:1.30,sourceScale:7.5,sourceWarp:1.40,sourceErosion:1.10},strong:{sourceForm:2.10,sourceScale:8.6,sourceWarp:1.85,sourceErosion:1.45}};
async function useFormPreset(name,button){let p=formPresets[name];for(let k of Object.keys(p)){$('#'+k).value=p[k];let out=$('#'+k+'Out');if(out)out.textContent=k==='sourceScale'?p[k].toFixed(2)+' m':p[k].toFixed(2)}$$('[data-form],[data-quick-form]').forEach(x=>x.classList.toggle('active',(x.dataset.form||x.dataset.quickForm)===name));await rebuildForm(button?.textContent||name)}
$$('[data-form]').forEach(b=>b.onclick=()=>useFormPreset(b.dataset.form,b).catch(e=>toast(e.message)));
$$('[data-quick-form]').forEach(b=>b.onclick=()=>useFormPreset(b.dataset.quickForm,b).catch(e=>toast(e.message)));'''
s = s.replace(old_controls, new_controls, 1)

old_apply = "$('#apply').onclick=()=>{build({...recipe,fracture:+$('#fracture').value,relief:+$('#relief').value,sourceForm:+$('#sourceForm').value,sourceScale:+$('#sourceScale').value,sourceWarp:+$('#sourceWarp').value,sourceErosion:+$('#sourceErosion').value,geo:+$('#geo').value,concavity:+$('#concavity').value,spikeGuard:+$('#spikeGuard').value,soilMicro:+$('#soilMicro').value,seed:+$('#seed').value}).catch(e=>toast(e.message));$('#panel').classList.remove('open')};"
assert old_apply in s
s = s.replace(old_apply, "$('#apply').onclick=()=>rebuildForm('立即重建').catch(e=>toast(e.message));", 1)

# Make geometry presets explicit in exported interface and retain up to four recent builds.
s = s.replace("while(cache.size>1)cache.delete(cache.keys().next().value)", "while(cache.size>4)cache.delete(cache.keys().next().value)", 1)
s = s.replace("window.__LM__={release:'limestone-water-surface-r5'", "window.__LM__={release:'limestone-water-surface-r6-live-form',rebuildForm", 1)

raw_out = s.encode("utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_bytes(raw_out)

build = {
    "schema": "LANDSCAPE_R5_K2_G6_LIVE_FORM_CONTROLS_V1",
    "date": "2026-09-17",
    "sourcePath": str(SRC.relative_to(ROOT)),
    "sourceSha256": source_sha,
    "candidatePath": str(OUT.relative_to(ROOT)),
    "candidateSha256": sha256(raw_out),
    "candidateBytes": len(raw_out),
    "geometryKernel": "unchanged from validated G5 volumetric source field",
    "interaction": {
        "panelOpenByDefault": True,
        "realFormSectionOpenByDefault": True,
        "quickPresetsTriggerRebuild": True,
        "geometrySlidersTriggerRebuildOnRelease": True,
        "manualRebuildKeepsPanelOpen": True,
        "meshSignatureVisible": True,
        "surfaceOnlyControlsCollapsed": True,
    },
    "visualApproved": False,
    "productionReady": False,
}
BUILD.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(build, ensure_ascii=False))
