#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path


def build(source: Path, output: Path, report: Path) -> None:
    s = source.read_text(encoding="utf-8")
    s = s.replace(
        "<title>Ocean Mother | R018.8 海岛金岸真实感工作台</title>",
        "<title>Ocean Mother | R018.9 海岛近岸水体修正版</title>",
        1,
    )
    s = s.replace("ISLAND GOLD COAST / R018.8", "ISLAND GOLD COAST / R018.9")
    s = s.replace("R018.8 · 真实感候选", "R018.9 · 近岸水体修正版")
    s = s.replace(
        "version:'0.3.8-island-r018-wave-refinement'",
        "version:'0.3.9-island-r018-wave-refinement-lazy-deep'",
        1,
    )
    s = s.replace(
        "buildId:'island-r018-wave-refinement-deep-restore'",
        "buildId:'island-r018-wave-refinement-lazy-v001-deep'",
        1,
    )

    css = """
/* R018.9 startup guard. The original V001 deep runtime starts only after Deep is selected. */
#loading{pointer-events:none!important}
#loading.done{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
#deepLoading{position:fixed;inset:0;z-index:6;display:none;place-items:center;background:linear-gradient(180deg,#071a25 0%,#0a2b3b 58%,#0a4250 100%);color:#eafcff;text-align:center;padding:24px}
#deepLoading .deepLoadCard{width:min(420px,calc(100vw - 36px));padding:26px 28px;border:1px solid rgba(220,248,255,.28);border-radius:26px;background:rgba(8,31,42,.62);box-shadow:0 24px 80px rgba(0,0,0,.32);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}
#deepLoading strong{display:block;font-size:20px;letter-spacing:.05em;margin-bottom:8px}#deepLoading span{display:block;color:#bad8e1;font-size:12px;line-height:1.7}#deepLoading i{display:block;width:132px;height:3px;margin:18px auto 0;border-radius:99px;overflow:hidden;background:rgba(230,250,255,.12)}#deepLoading i::after{content:'';display:block;width:48%;height:100%;border-radius:inherit;background:#8eeeff;animation:deepLoadFlow 1.25s ease-in-out infinite alternate}@keyframes deepLoadFlow{from{transform:translateX(-12%)}to{transform:translateX(120%)}}body.deep-mode:not(.deep-ready) #deepLoading{display:grid}body.deep-ready #deepLoading{display:none}
"""
    i = s.find("</style>")
    assert i > 0, "outer style block missing"
    s = s[:i] + css + s[i:]

    stage = '<main id="stage"><canvas id="ocean" aria-label="异形海岛、无限海面、浪墙、卷浪、泡沫墙和浓烟的程序化三维工作台"></canvas><iframe id="deepFrame" title="Ocean Mother 原始深海工作台 V001" hidden></iframe></main>'
    assert stage in s, "stage marker missing"
    loading = '<div id="deepLoading" aria-live="polite"><div class="deepLoadCard"><strong>正在恢复原始深海 V001</strong><span>深海保持上一版源码，只在进入深海时启动。海岛近岸不会再被深海初始化拖慢。</span><i></i></div></div>'
    s = s.replace(stage, stage + loading, 1)

    eager = "const deepFrame=document.getElementById('deepFrame');\ndeepFrame.srcdoc=ORIGINAL_DEEP_HTML;\nlet activeZone='island';"
    lazy = """const deepFrame=document.getElementById('deepFrame');
let deepLoaded=false;
let deepDocumentReady=false;
function ensureDeepLoaded(){if(deepLoaded)return;deepLoaded=true;document.body.classList.remove('deep-ready');deepFrame.srcdoc=ORIGINAL_DEEP_HTML;}
function innerDeepPause(wantPaused){try{const b=deepFrame.contentDocument?.getElementById('pause');if(!b)return;const isPaused=(b.textContent||'').includes('继续');if(isPaused!==wantPaused)b.click();}catch(_e){}}
let activeZone='island';
window.__OCEAN_ZONE__=activeZone;"""
    assert eager in s, "eager deep startup marker missing"
    s = s.replace(eager, lazy, 1)

    pattern = re.compile(
        r"function setZone\(zone\)\{.*?\n\}\ndocument\.querySelectorAll\('\[data-zone\]'\)\.forEach\(b=>b\.onclick=\(\)=>setZone\(b\.dataset\.zone\)\);\ndeepFrame\.addEventListener\('load',\(\)=>\{window\.__OCEAN_DEEP_READY__=!!deepFrame\.contentWindow\?\.OceanMother;\}\);",
        re.S,
    )
    match = pattern.search(s)
    assert match, "zone controller marker missing"
    zone = """function setZone(zone){
  activeZone=zone==='deep'?'deep':'island';
  const deep=activeZone==='deep';
  if(deep){ensureDeepLoaded();document.body.classList.toggle('deep-ready',deepDocumentReady);}
  document.body.classList.toggle('deep-mode',deep);deepFrame.hidden=!deep;
  if(deep)innerDeepPause(false);else if(deepLoaded)innerDeepPause(true);
  document.querySelectorAll('[data-zone]').forEach(b=>b.classList.toggle('selected',b.dataset.zone===activeZone));
  document.getElementById('pause').textContent=deep?(deepFrame.contentDocument?.getElementById('pause')?.textContent||'暂停'):(paused?'继续运行':'暂停');
  if(!deep){last=performance.now();setView('overview');}window.__OCEAN_ZONE__=activeZone;
}
document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>setZone(b.dataset.zone));
deepFrame.addEventListener('load',()=>{deepDocumentReady=true;window.__OCEAN_DEEP_READY__=!!deepFrame.contentWindow?.OceanMother;if(activeZone==='deep')document.body.classList.add('deep-ready');});"""
    s = s[: match.start()] + zone + s[match.end() :]

    s = s.replace(
        "window.__OCEAN_DELIVERY_POLICY__={defaultDeliverable:'interactive-3d-html-webgl',imageGeneration:false,imageAllowedOnlyByExplicitUserRequest:true,visualApproved:false,productionApproved:false};",
        "window.__OCEAN_DELIVERY_POLICY__={defaultDeliverable:'interactive-3d-html-webgl',imageGeneration:false,imageAllowedOnlyByExplicitUserRequest:true,deepStartup:'lazy-original-v001',nearshoreLocked:true,visualApproved:false,productionApproved:false};",
        1,
    )
    s = s.replace(
        "preserveDrawingBuffer:true,powerPreference:'high-performance'",
        "preserveDrawingBuffer:false,powerPreference:'high-performance'",
        1,
    )
    s = s.replace(
        "syncEffects();resize();setTimeout(()=>document.getElementById('loading').classList.add('done'),550);requestAnimationFrame(draw);",
        "syncEffects();resize();document.getElementById('loading').classList.add('done');requestAnimationFrame(draw);",
        1,
    )

    required = [
        "window.__OCEAN_ZONE__=activeZone",
        "deepStartup:'lazy-original-v001'",
        "antialiased advected filament field",
        "three-layer crest lip and falling sheet",
        "Ocean Mother · 原始深海工作台 V001",
        "document.getElementById('loading').classList.add('done');requestAnimationFrame(draw);",
    ]
    for marker in required:
        assert marker in s, marker
    assert s.count("deepFrame.srcdoc=ORIGINAL_DEEP_HTML;") == 1
    assert "deepFrame.srcdoc=ORIGINAL_DEEP_HTML;\nlet activeZone" not in s
    assert not re.findall(
        r"https?://|data:image/|\.png\b|\.jpe?g\b|\.webp\b|\.glb\b|\.gltf\b",
        s,
        re.I,
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(s, encoding="utf-8")
    identity = {
        "format": "ocean-mother-r0189-direct-open-build",
        "version": "0.3.9-island-r018-wave-refinement-lazy-deep",
        "buildId": "island-r018-wave-refinement-lazy-v001-deep",
        "sourceBytes": source.stat().st_size,
        "outputBytes": output.stat().st_size,
        "outputSha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "startupZone": "island",
        "deepRestore": "frozen Ocean Mother V001, lazy startup only",
        "loadingOverlayPointerPolicy": "non-blocking and dismissed before first heavy frame",
        "nearshoreLocked": [
            "terrain",
            "island",
            "sand",
            "rocks",
            "fire",
            "smoke",
            "camera presets",
            "UI layout",
        ],
        "changed": [
            "foam field",
            "water crest shaping",
            "curling-wave lip",
            "deep runtime startup timing",
            "startup overlay interaction",
        ],
        "runtimeImageAssets": 0,
        "externalModels": 0,
        "externalCdn": 0,
        "generatedImagesUsed": False,
        "visualApproved": False,
        "productionApproved": False,
    }
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text(
        json.dumps(identity, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(identity, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--r0188", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    build(args.r0188, args.output, args.report)


if __name__ == "__main__":
    main()
