from __future__ import annotations

from pathlib import Path
import base64
import hashlib
import html
import json
import lzma
import re
import shutil

REPO = Path.cwd()
SOURCE = REPO / "ocean-mother/island-r018-build"
RUNTIME = REPO / "ocean-mother/island-r018"
TOOLS = REPO / "ocean-mother/island-r018-tools"
DIRECT = REPO / "ocean-mother/island-r018-direct"
FINAL = REPO / "ocean-mother/island-r018-final-v032"
VERSION = "0.3.2-island-r018"
BUILD_ID = "island-r018-delivery-polish"


def materialize() -> dict:
    manifest = json.loads((SOURCE / "PAYLOAD.json").read_text(encoding="utf-8"))
    encoded_parts: list[str] = []
    checked_parts: list[dict] = []
    for item in manifest["parts"]:
        path = SOURCE / item["name"]
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        assert len(raw) == item["bytes"], (path, len(raw), item["bytes"])
        assert digest == item["sha256"], (path, digest, item["sha256"])
        text = raw.decode("ascii")
        assert text == text.strip(), path
        encoded_parts.append(text)
        checked_parts.append({"name": path.name, "bytes": len(raw), "sha256": digest})
    encoded = "".join(encoded_parts)
    assert len(encoded) == manifest["encodedChars"]
    compressed = base64.b64decode(encoded, validate=True)
    assert len(compressed) == manifest["compressedBytes"]
    digest = hashlib.sha256(compressed).hexdigest()
    assert digest == manifest["compressedSha256"]
    package = json.loads(lzma.decompress(compressed))
    expected = {
        "BUILD.json", "PARAMETER_CATALOG.json", "README.md", "REFERENCE_STUDY.md",
        "app.mjs", "coast.css", "core.mjs", "core.test.mjs", "geometry.mjs",
        "index.html", "params.mjs", "shaders.mjs"
    }
    assert set(package["runtime"]) == expected
    if RUNTIME.exists():
        shutil.rmtree(RUNTIME)
    RUNTIME.mkdir(parents=True)
    for name, content in package["runtime"].items():
        assert Path(name).name == name
        (RUNTIME / name).write_text(content, encoding="utf-8")
    TOOLS.mkdir(parents=True, exist_ok=True)
    runner = package["qa_runner.py"].replace("0.3.1-island-r018", VERSION)
    (TOOLS / "qa_runner.py").write_text(runner, encoding="utf-8")
    return {
        "sourceVersion": manifest["version"],
        "sourceBuildId": manifest["buildId"],
        "parts": checked_parts,
        "compressedBytes": len(compressed),
        "compressedSha256": digest,
    }


def set_param_default(text: str, key: str, factor: float) -> tuple[str, dict | None]:
    pattern = re.compile(
        r"(\bkey\s*:\s*['\"]" + re.escape(key) + r"['\"][\s\S]{0,600}?\bvalue\s*:\s*)(-?\d+(?:\.\d+)?)"
    )
    match = pattern.search(text)
    if not match:
        return text, None
    old = float(match.group(2))
    new = old * factor
    value = f"{new:.4f}".rstrip("0").rstrip(".")
    updated = text[: match.start(2)] + value + text[match.end(2) :]
    return updated, {"key": key, "old": old, "new": float(value)}


def polish() -> list[dict]:
    changes: list[dict] = []
    for path in RUNTIME.iterdir():
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        count = text.count("0.3.1-island-r018") + text.count("island-r018-causal-polish")
        if count:
            text = text.replace("0.3.1-island-r018", VERSION)
            text = text.replace("island-r018-causal-polish", BUILD_ID)
            path.write_text(text, encoding="utf-8")
            changes.append({"file": path.name, "change": "version identity", "count": count})

    core = RUNTIME / "core.mjs"
    text = core.read_text(encoding="utf-8")
    text, count = re.subn(
        r"export\s+const\s+DOMAIN\s*=\s*\{[^;]+?\};",
        "export const DOMAIN={minX:-160,maxX:160,minZ:-160,maxZ:160,width:320,depth:320};",
        text,
        count=1,
        flags=re.S,
    )
    assert count == 1
    core.write_text(text, encoding="utf-8")
    changes.append({"file": "core.mjs", "change": "expand finite ocean domain", "count": 1})

    app = RUNTIME / "app.mjs"
    text = app.read_text(encoding="utf-8")
    substitutions = [
        (r"terrainGeo=gridMesh\(gl,mobile\?160:260,mobile\?160:260,", "terrainGeo=gridMesh(gl,mobile?220:360,mobile?220:360,", "terrain density"),
        (r"waterGeo=gridMesh\(gl,mobile\?160:260,mobile\?160:260,", "waterGeo=gridMesh(gl,mobile?220:360,mobile?220:360,", "water density"),
        (r"N=innerWidth<760\?72:120,K=12", "N=innerWidth<760?84:144,K=14", "curl tessellation"),
        (r"smooth\(-\.1,\.7,-\(nx\*dir\[0\]\+nz\*dir\[1]\)\)", "smooth(-.16,.64,-(nx*dir[0]+nz*dir[1]))", "breaker facing spread"),
        (r"if\(facing<\.06\)continue", "if(facing<.035)continue", "breaker facing threshold"),
        (r"Math\.min\(1\.25,w\.depth\*\.67\)", "Math.min(1.52,w.depth*.78)", "breaker crest height"),
    ]
    for pattern, replacement, label in substitutions:
        text, count = re.subn(pattern, replacement, text)
        if count:
            changes.append({"file": "app.mjs", "change": label, "count": count})
    if "r018ContextRecovery" not in text:
        marker = "addEventListener('unhandledrejection',e=>fail(e.reason));"
        assert marker in text
        recovery = """
// r018ContextRecovery: a deterministic recovery path after tab suspension or WebGL loss.
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();qa.contextLost=true;$('status').textContent='图形上下文暂停，请重新启动';});
canvas.addEventListener('webglcontextrestored',()=>location.reload());
addEventListener('pageshow',()=>{lastFrame=performance.now();opaqueDirty=true;});
"""
        text = text.replace(marker, marker + recovery, 1)
        changes.append({"file": "app.mjs", "change": "context and pageshow recovery", "count": 1})
    app.write_text(text, encoding="utf-8")

    params = RUNTIME / "params.mjs"
    text = params.read_text(encoding="utf-8")
    for key, factor in (("curlOuter", 1.18), ("curlMiddle", 1.15), ("curlInner", 1.12), ("foam", 1.12), ("spray", 1.08)):
        text, record = set_param_default(text, key, factor)
        if record:
            changes.append({"file": "params.mjs", "change": "causal default", **record})
    params.write_text(text, encoding="utf-8")

    index = RUNTIME / "index.html"
    text = index.read_text(encoding="utf-8")
    text = text.replace("R018 海岛实验室", "R018.2 海岛实验室")
    text = text.replace("ISLAND LAB / R018", "ISLAND LAB / R018.2")
    text = text.replace("R018 · 研究候选", "R018.2 · 交付候选")
    text = re.sub(r"coast\.css\?v=[^\"']+", "coast.css?v=r0182", text)
    text = re.sub(r"app\.mjs\?v=[^\"']+", "app.mjs?v=r0182", text)
    if 'id="restartRuntime"' not in text:
        marker = '<button id="pause">暂停</button>'
        assert marker in text
        text = text.replace(marker, marker + '<button id="restartRuntime" type="button">重新启动</button>', 1)
        changes.append({"file": "index.html", "change": "explicit restart control", "count": 1})
    if "r018RecoveryBridge" not in text:
        bridge = """<script id="r018RecoveryBridge">(()=>{const b=document.getElementById('restartRuntime');if(!b)return;b.addEventListener('click',()=>{b.disabled=true;b.textContent='重新启动中';const api=window.OceanIsland||window.OceanCoastR012;try{if(typeof api?.restart==='function'){api.restart();setTimeout(()=>{b.disabled=false;b.textContent='重新启动'},450);return}}catch(e){console.warn(e)}location.reload()});addEventListener('pageshow',e=>{if(e.persisted){const api=window.OceanIsland||window.OceanCoastR012;try{api?.resume?.()}catch{}}});})();</script>"""
        text = text.replace("</body>", bridge + "</body>", 1)
        changes.append({"file": "index.html", "change": "recovery bridge", "count": 1})
    index.write_text(text, encoding="utf-8")

    build_path = RUNTIME / "BUILD.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build.update({
        "version": VERSION,
        "buildId": BUILD_ID,
        "date": "2026-09-03",
        "parentCandidate": "0.3.1-island-r018",
        "runtimeRepair": "geometry controls retain live stepping; explicit restart, pageshow clock repair and WebGL recovery are present",
        "domainMeters": [-160, 160],
        "nearshoreMeshDesktop": 360,
        "nearshoreMeshMobile": 220,
        "mediaWarmupSeconds": 8,
        "deliveryPolicy": "verified online HTML plus self-contained direct-open HTML",
        "visualApproved": False,
        "productionApproved": False,
    })
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    changes.append({"file": "BUILD.json", "change": "delivery metadata", "count": 1})

    readme = RUNTIME / "README.md"
    text = readme.read_text(encoding="utf-8")
    if "R018.2 delivery polish" not in text:
        text += "\n## R018.2 delivery polish\n\nExpanded ocean domain, denser nearshore meshes, more legible three-band breakers, stronger foam transfer defaults, explicit runtime restart, tab-resume clock repair, WebGL recovery, and a self-contained direct-open build. Automated gates do not constitute human visual approval.\n"
        readme.write_text(text, encoding="utf-8")
        changes.append({"file": "README.md", "change": "delivery note", "count": 1})
    return changes


def deep_srcdoc() -> str:
    return """<!doctype html><html><head><meta charset=utf-8><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#03202d;color:#e9fbff;font:14px system-ui}canvas{width:100%;height:100%;display:block}.ui{position:fixed;top:16px;right:16px;display:flex;gap:8px}.ui button{border:1px solid #ffffff55;background:#0d4159aa;color:white;border-radius:999px;padding:9px 13px;backdrop-filter:blur(12px)}#panel{position:fixed;left:18px;bottom:18px;max-width:290px;padding:14px;border:1px solid #ffffff44;border-radius:16px;background:#062c3db8;backdrop-filter:blur(16px)}#panel.closed{display:none}b{display:block;font-size:16px;margin-bottom:5px}small{opacity:.75}</style></head><body><canvas id=c></canvas><div class=ui><button id=pause>暂停</button><button id=reset>复位</button><button id=togglePanel>参数</button></div><div id=panel><b>深海连续场</b><small>程序化长涌浪、风纹与深水光学。拖动改变观察方向，滚轮改变浪尺度。</small></div><script>const c=document.getElementById('c'),x=c.getContext('2d',{alpha:false});let t=0,run=1,scale=1,yaw=0,last=performance.now();function size(){const d=Math.min(devicePixelRatio||1,1.5);c.width=innerWidth*d;c.height=innerHeight*d}addEventListener('resize',size);size();c.onpointermove=e=>{if(e.buttons)yaw+=e.movementX*.004};c.onwheel=e=>{scale=Math.max(.55,Math.min(2.2,scale*Math.exp(-e.deltaY*.001)))};pause.onclick=()=>{run=!run;pause.textContent=run?'暂停':'继续'};reset.onclick=()=>{scale=1;yaw=0;t=0};togglePanel.onclick=()=>panel.classList.toggle('closed');function frame(n){const dt=Math.min(.05,(n-last)/1000);last=n;if(run)t+=dt;const w=c.width,h=c.height,g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#85c9dc');g.addColorStop(.28,'#206f8c');g.addColorStop(1,'#031927');x.fillStyle=g;x.fillRect(0,0,w,h);const horizon=h*.40;for(let band=0;band<18;band++){const yy=horizon+band*h*.035;x.beginPath();for(let i=0;i<=w;i+=6){const q=i/w*12*scale+yaw;const wave=Math.sin(q+band*.52-t*(1.0-band*.022))*7+Math.sin(q*2.17-t*.64+band)*2.4;const persp=1+band*.12;x.lineTo(i,yy+wave*persp)}x.strokeStyle=`rgba(${170+band*2},${220+band},235,${.28-band*.009})`;x.lineWidth=1+band*.11;x.stroke()}x.fillStyle='rgba(255,255,255,.08)';for(let i=0;i<22;i++){const px=(i*173+t*24)%w,py=horizon+((i*71)%Math.max(1,h-horizon));x.fillRect(px,py,30+12*Math.sin(i+t),1)}requestAnimationFrame(frame)}requestAnimationFrame(frame);</script></body></html>"""


def build_direct_open() -> dict:
    modules = {path.name: path.read_text(encoding="utf-8") for path in RUNTIME.glob("*.mjs")}
    import_pattern = re.compile(r"(?P<prefix>\b(?:import|export)\s+(?:(?:[^'\";]+?\s+from\s+)?))(?P<quote>['\"])(?P<spec>\./[^'\"]+)(?P=quote)")
    cache: dict[str, str] = {}
    active: list[str] = []

    def module_url(name: str) -> str:
        name = Path(name).name
        if name in cache:
            return cache[name]
        if name in active:
            raise RuntimeError("cyclic module graph: " + " -> ".join(active + [name]))
        source = modules[name]
        active.append(name)

        def replace_import(match: re.Match) -> str:
            dependency = Path(match.group("spec")).name
            return match.group("prefix") + match.group("quote") + module_url(dependency) + match.group("quote")

        source = import_pattern.sub(replace_import, source)
        active.pop()
        url = "data:text/javascript;base64," + base64.b64encode(source.encode("utf-8")).decode("ascii")
        cache[name] = url
        return url

    app_url = module_url("app.mjs")
    document = (RUNTIME / "index.html").read_text(encoding="utf-8")
    css = (RUNTIME / "coast.css").read_text(encoding="utf-8")
    document, count = re.subn(r"<link[^>]+href=['\"]coast\.css[^>]*>", f"<style>{css}</style>", document, count=1, flags=re.I)
    assert count == 1
    srcdoc = html.escape(deep_srcdoc(), quote=True)
    document, count = re.subn(
        r"<iframe\s+id=['\"]deepFrame['\"][^>]*></iframe>",
        f'<iframe id="deepFrame" title="深海工作台" src="about:blank" srcdoc="{srcdoc}" hidden></iframe>',
        document,
        count=1,
        flags=re.I,
    )
    assert count == 1
    document, count = re.subn(
        r"<script\s+type=['\"]module['\"]\s+src=['\"]app\.mjs[^'\"]*['\"]\s*></script>",
        f'<script type="module">import {json.dumps(app_url)};</script>',
        document,
        count=1,
        flags=re.I,
    )
    assert count == 1
    DIRECT.mkdir(parents=True, exist_ok=True)
    output = DIRECT / "Ocean_Mother_R018_0.3.2_Direct_Open.html"
    output.write_text(document, encoding="utf-8")
    text = output.read_text(encoding="utf-8")
    assert output.stat().st_size > 50000
    assert "restartRuntime" in text and "R018.2" in text
    assert not re.search(r"<script[^>]+src=", text, re.I)
    assert not re.search(r"<link[^>]+stylesheet", text, re.I)
    assert not re.search(r"https?://", text, re.I)
    return {
        "path": str(output.relative_to(REPO)),
        "bytes": output.stat().st_size,
        "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
        "singleFile": True,
        "directFileProtocolTarget": True,
        "deepPreviewEmbedded": "srcdoc=" in text,
        "restartControl": "restartRuntime" in text,
    }


def audit() -> dict:
    banned = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".hdr", ".exr", ".ktx", ".ktx2", ".glb", ".gltf", ".obj"}
    assert not [path for path in RUNTIME.rglob("*") if path.suffix.lower() in banned]
    files = {}
    for path in sorted(RUNTIME.iterdir()):
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        assert not re.search(r"data\s*:\s*image/|https?://", text, re.I), path
        files[path.name] = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return files


def main() -> None:
    source = materialize()
    changes = polish()
    standalone = build_direct_open()
    files = audit()
    report = {
        "format": "ocean-mother-r018-final-v032",
        "date": "2026-09-03",
        "version": VERSION,
        "buildId": BUILD_ID,
        "source": source,
        "changes": changes,
        "runtimeFiles": files,
        "standalone": standalone,
        "assetPolicy": {"runtimeImageAssets": 0, "externalModels": 0, "externalCdn": 0},
        "approvals": {"automatedGatePassed": False, "visualApproved": False, "productionApproved": False},
    }
    FINAL.mkdir(parents=True, exist_ok=True)
    (FINAL / "FINALIZE_REPORT.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"version": VERSION, "runtimeFiles": len(files), "standaloneBytes": standalone["bytes"]}))


if __name__ == "__main__":
    main()
