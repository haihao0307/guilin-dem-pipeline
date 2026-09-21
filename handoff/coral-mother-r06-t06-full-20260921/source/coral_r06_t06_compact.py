from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: coral_r06_t06_compact.py <t05-index.html> <output-dir>")

    source = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    html = source.read_text(encoding="utf-8")
    require("Continuous Tube Growth T05" in html, "unexpected T05 source title")
    require("const cfg={" in html and "function rebuild()" in html, "T05 runtime missing")

    html = html.replace(
        "<title>Coral Mother R06 · Continuous Tube Growth T05</title>",
        "<title>Coral Mother R06 · Compact Parameter Dock T06</title>",
        1,
    )

    # The user-facing meaning is now retention: 0 removes optional fine branches,
    # 1 preserves them. The runtime maps this to a radius/order pruning field.
    fine_markup = (
        '<label class="param fineParam"><span class="paramHead"><b>细枝保留量</b>'
        '<output id="fineO">0.120</output></span>'
        '<input id="fine" type="range" min="0" max="1" step="0.001" value="0.120">'
        '<small>0=删除可选细枝；1=完整保留</small></label>'
    )
    html, count = re.subn(
        r'<label class="param"><span class="paramHead"><b>细枝保留</b>.*?</label>',
        fine_markup,
        html,
        count=1,
        flags=re.S,
    )
    require(count == 1, "fine-branch slider markup not replaced")

    html = html.replace(
        "thickness:1.15,fine:0,tip:1",
        "thickness:.92,fineRetention:.12,fine:.1362,tip:1",
        1,
    )
    require("fineRetention:.12" in html, "cfg fine-retention patch failed")

    old_loop = (
        "function rebuild(){const m=new Mesh(),dbg=[];let activePaths=0,tubeSamples=0,tubeRings=0,activeEdges=0;"
        "for(const ids of growthPaths){let keep=false;for(let q=0;q<ids.length;q++)if(nodes[ids[q]].r>=cfg.fine){keep=true;break}"
        "if(!keep)continue;const filtered=ids.filter((id,i)=>nodes[id].r>=cfg.fine||i===0||i===ids.length-1);"
        "if(filtered.length<2)continue;"
    )
    new_loop = (
        "function rebuild(){const m=new Mesh(),dbg=[];let activePaths=0,tubeSamples=0,tubeRings=0,activeEdges=0;"
        "const retention=clamp(cfg.fineRetention??.12,0,1),fineThreshold=.035+(1-retention)*.115;cfg.fine=fineThreshold;"
        "for(const ids of growthPaths){const maxR=ids.reduce((m,id)=>Math.max(m,nodes[id].r),0),"
        "pathOrder=ids.reduce((m,id)=>Math.max(m,nodes[id].order),0),optional=pathOrder>=4||maxR<.125,"
        "coin=h01(ids[0]*92821+ids[ids.length-1]*68917);"
        "if(optional&&(maxR<fineThreshold||coin>Math.pow(Math.max(retention,.0001),.72)))continue;"
        "const filtered=ids.filter((id,i)=>nodes[id].r>=fineThreshold||i===0||(i===ids.length-1&&(!optional||retention>.35)));"
        "if(filtered.length<2)continue;"
    )
    require(old_loop in html, "T05 growth-path loop not found")
    html = html.replace(old_loop, new_loop, 1)

    event_pattern = re.compile(
        r"for\(const k of \['thickness','fine','tip','rough','point','verrucae','cupScale','cupDepth','grain','micro','glow','saturation'\]\)"
        r"\{.*?\}\}\nrebuild\(\);setView\('persp'\);requestAnimationFrame\(frame\);",
        re.S,
    )
    event_replacement = """for(const k of ['thickness','tip','rough','point','verrucae','cupScale','cupDepth','grain','micro','glow','saturation']){const el=$(k),out=$(k+'O');el.oninput=()=>{cfg[k]=Number(el.value);out.value=Number(el.value).toFixed(k==='cupScale'?1:2);if(!['point','cupScale','cupDepth','grain'].includes(k)){rebuild();markT06()}}}
const fineEl=$('fine'),fineOut=$('fineO');
fineEl.oninput=()=>{cfg.fineRetention=Number(fineEl.value);fineOut.value=cfg.fineRetention.toFixed(3);rebuild();markT06()};
function markT06(){if(window.__CORAL_R06_QA__)Object.assign(window.__CORAL_R06_QA__,{compactWorkbench:true,allAdjustablesGrouped:true,fineRetention:cfg.fineRetention,fineThreshold:cfg.fine,userFacingTriangleMetric:false,visualAcceptance:false,productionReady:false})}
$('thickness').value='0.92';$('thicknessO').value='0.92';cfg.thickness=.92;fineEl.value='0.120';fineOut.value='0.120';cfg.fineRetention=.12;
rebuild();markT06();setView('persp');requestAnimationFrame(frame);"""
    html, count = event_pattern.subn(event_replacement, html, count=1)
    require(count == 1, "slider event block not replaced")

    compact_css = r"""
<style id="t06-compact-css">
:root{--stage:clamp(360px,46vh,520px)}
html,body{overflow-x:hidden}body{padding:4px 0 8px}main{width:100%;max-width:none;margin:0;padding:0 6px}
#stage{min-height:360px;border-radius:12px}#stageInfo{margin-top:4px;padding:4px 6px;border-radius:9px;display:grid;grid-template-columns:auto auto 1fr auto;gap:4px;min-height:32px}
#stageInfo .label{padding:4px 7px;border-radius:7px;white-space:nowrap}#stageInfo .label b{font-size:8px;letter-spacing:.04em}#stageInfo .label small{display:none}
#stageInfo #hud{grid-column:auto;padding:4px 7px;border-radius:7px;text-align:right;white-space:nowrap;font-size:8px}
#stageInfo #status{grid-column:auto;display:flex;gap:3px;flex-wrap:nowrap;justify-content:flex-end;overflow:hidden;white-space:nowrap}
#stageInfo .chip{padding:4px 6px;font-size:7px}
#controls{margin-top:4px;padding:6px;border-radius:11px;background:linear-gradient(145deg,#081c18,#06130f)}
#compactHeader{min-height:26px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:2px 4px 5px;color:#91aaa2;font-size:8px;white-space:nowrap;overflow:hidden}
#compactHeader b{color:#e8f4ef;font-size:10px}#compactHeader .meta{overflow:hidden;text-overflow:ellipsis}
#workDock{display:grid;gap:5px}#toolDock{display:grid;grid-template-columns:.75fr .95fr 1.15fr 1.8fr;gap:4px}
.toolGroup{min-width:0;padding:4px;border:1px solid #ffffff10;border-radius:8px;background:#0002}.toolLabel{display:block;margin:0 0 3px;color:#7d978e;font:700 7px/1 ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}
.toolGroup .buttons{display:flex;flex-wrap:nowrap;gap:3px;overflow:auto;scrollbar-width:none}.toolGroup .buttons::-webkit-scrollbar{display:none}
.toolGroup button{padding:4px 6px;min-height:25px;border-radius:7px;font-size:8px;white-space:nowrap}
#parameterDock{padding:5px;border:1px solid #79d8cf24;border-radius:9px;background:#041814}
#parameterHead{height:24px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 4px;color:#b8cbc4;font-size:9px}#parameterHead b{color:#edf8f3;font-size:10px}
#resetParams{min-height:22px;padding:3px 7px;font-size:8px}
#parameterDock .grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px}
#parameterDock .param{min-width:0;min-height:55px;padding:5px 7px;border-radius:8px}#parameterDock .paramHead{margin-bottom:3px}#parameterDock .paramHead b{font-size:8px}#parameterDock output{font-size:8px}
#parameterDock input[type=range]{height:14px;margin:0}#parameterDock .param small{display:none}.fineParam{border-color:#e7b46f55!important;background:#e7b46f08!important}
#qaDetails{margin-top:4px;border:1px solid #ffffff0e;border-radius:8px;background:#0002}#qaDetails summary{padding:5px 7px;color:#6f8a82;font-size:8px;cursor:pointer}#qaDetails .qa{padding:0 5px 5px;grid-template-columns:repeat(8,minmax(0,1fr));gap:3px}#qaDetails .qaCard{padding:5px 6px;border-radius:6px}#qaDetails .qaCard span{font-size:6px}#qaDetails .qaCard b{font-size:8px}
@media(max-width:1800px){:root{--stage:clamp(350px,44vh,470px)}#parameterDock .grid{grid-template-columns:repeat(4,minmax(0,1fr))}#toolDock{grid-template-columns:repeat(4,minmax(0,1fr))}}
@media(max-width:1100px){:root{--stage:clamp(340px,43vh,440px)}#toolDock{grid-template-columns:repeat(2,minmax(0,1fr))}#parameterDock .grid{grid-template-columns:repeat(3,minmax(0,1fr))}#stageInfo{grid-template-columns:auto auto 1fr}#stageInfo #status{display:none}}
@media(max-width:720px){:root{--stage:56vh}body{padding-top:2px}main{padding:0 4px}#stage{min-height:480px}#stageInfo{grid-template-columns:1fr 1fr}#stageInfo #hud{grid-column:1/-1;text-align:left}#compactHeader{white-space:normal;align-items:flex-start}#compactHeader .meta{display:none}#toolDock{grid-template-columns:1fr 1fr}#parameterDock .grid{grid-template-columns:repeat(2,minmax(0,1fr))}#qaDetails .qa{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:2000px) and (max-height:1200px){:root{--stage:500px}}
</style>
"""
    html = html.replace("</head>", compact_css + "</head>", 1)

    compact_js = r"""
<script id="t06-compact-runtime">
(()=>{
  const controls=document.getElementById('controls');
  const grid=controls.querySelector('.grid');
  const qa=controls.querySelector('.qa');
  const groupDefs=[['VIEW','views'],['COMPARE','compare'],['DIAGNOSTIC','diag'],['COLOR','palette']];
  const toolDock=document.createElement('div');toolDock.id='toolDock';
  for(const [label,id] of groupDefs){const node=document.getElementById(id),g=document.createElement('div');g.className='toolGroup';const t=document.createElement('span');t.className='toolLabel';t.textContent=label;g.append(t,node);toolDock.append(g)}
  const parameterDock=document.createElement('section');parameterDock.id='parameterDock';
  const parameterHead=document.createElement('div');parameterHead.id='parameterHead';parameterHead.innerHTML='<b>函数参数 · 全部可调项</b><span>12 CONTROLS · 实时预览</span>';
  const reset=document.createElement('button');reset.id='resetParams';reset.textContent='恢复参数';parameterHead.append(reset);parameterDock.append(parameterHead,grid);
  const workDock=document.createElement('div');workDock.id='workDock';workDock.append(toolDock,parameterDock);
  const compactHeader=document.createElement('div');compactHeader.id='compactHeader';compactHeader.innerHTML='<b>Coral Mother R06 · T06</b><span class="meta">Pocillopora damicornis · Hard / stony coral · Branching Coral · Palau evidence: UNRESOLVED</span>';
  const details=document.createElement('details');details.id='qaDetails';const summary=document.createElement('summary');summary.textContent='数值 / QA';details.append(summary,qa);
  controls.replaceChildren(compactHeader,workDock,details);

  document.getElementById('refLabel').innerHTML='<b>REF · P. damicornis</b>';
  document.getElementById('genLabel').innerHTML='<b>FUNCTION · R06-T06</b>';
  document.getElementById('status').innerHTML='<span class="chip"><strong>HARD</strong> · BRANCHING</span><span class="chip"><strong>RUNTIME</strong> · 0 ASSET</span><span class="chip"><strong>MICROSCOPE</strong> · FUNCTION</span>';
  document.getElementById('hud').innerHTML='<b id="viewName">45° A/B</b> · <span id="fps">-- FPS</span> · <span id="fieldStats">-- PATHS</span>';

  const defaults={thickness:.92,fine:.12,tip:1,rough:.58,point:1.55,verrucae:.55,cupScale:24,cupDepth:.90,grain:.55,micro:.84,glow:.68,saturation:1.22};
  reset.onclick=()=>{for(const [id,value] of Object.entries(defaults)){const el=document.getElementById(id);el.value=String(value);if(typeof el.oninput==='function')el.oninput()}};

  const stamp=()=>{const rects=[...document.querySelectorAll('#parameterDock input')].map(el=>el.getBoundingClientRect());window.__CORAL_R06_T06__={ready:true,version:'R06-T06',compactWorkbench:true,adjustableControls:rects.length,allAdjustablesGrouped:true,fineRetention:Number(document.getElementById('fine').value),fineThreshold:cfg.fine,mainWidthRatio:document.querySelector('main').getBoundingClientRect().width/innerWidth,visualAcceptance:false,productionReady:false}};
  requestAnimationFrame(()=>requestAnimationFrame(stamp));addEventListener('resize',stamp);
})();
</script>
"""
    html = html.replace("</body>", compact_js + "</body>", 1)

    # Keep version metadata explicit and do not relabel scientific categories.
    html = html.replace("PROCEDURAL · R06-T05", "PROCEDURAL · R06-T06", 1)
    html = html.replace("Pocillopora 连续管状生长 T05", "Pocillopora 紧凑调参工作台 T06", 1)

    out_dir.mkdir(parents=True, exist_ok=True)
    index = out_dir / "index.html"
    index.write_text(html, encoding="utf-8")
    qa = {
        "schema": "CORAL_MOTHER_R06_T06_COMPACT_PARAMETER_DOCK_BUILD",
        "source": str(source),
        "bytes": len(html.encode("utf-8")),
        "sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "compactWorkbench": True,
        "adjustableControls": 12,
        "fineBranchSemantics": "0 removes optional fine branches; 1 preserves all",
        "fineBranchStep": 0.001,
        "defaultFineRetention": 0.12,
        "defaultThickness": 0.92,
        "runtimeGLB": 0,
        "runtimeTextures": 0,
        "networkFetchCalls": 0,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (out_dir / "BUILD_T06.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False))


if __name__ == "__main__":
    main()
