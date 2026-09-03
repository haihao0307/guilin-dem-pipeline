#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import lzma
import re
import shutil
from pathlib import Path

VERSION = "0.3.2-island-r018"
BUILD_ID = "island-r018-delivery-polish"
BANNED_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".hdr", ".exr", ".ktx", ".ktx2", ".glb", ".gltf", ".obj"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def version_key(value: str) -> tuple[int, int, int]:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", value)
    return tuple(map(int, match.groups())) if match else (0, 0, 0)


def select_payload(repo: Path) -> tuple[Path, dict]:
    candidates: list[tuple[tuple[int, int, int], Path, dict]] = []
    for path in repo.rglob("PAYLOAD.json"):
        if "r018" not in path.as_posix().lower():
            continue
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            continue
        version = str(data.get("version", ""))
        if "r018" in version.lower() and data.get("parts"):
            candidates.append((version_key(version), path, data))
    if not candidates:
        raise RuntimeError("R018 payload manifest was not found")
    _, path, data = max(candidates, key=lambda item: (item[0], item[1].stat().st_mtime_ns))
    return path, data


def materialize(payload_path: Path, manifest: dict, destination: Path) -> dict:
    destination.mkdir(parents=True, exist_ok=True)
    encoded_parts: list[str] = []
    verified_parts: list[dict] = []
    for item in manifest["parts"]:
        path = payload_path.parent / item["name"]
        raw = path.read_bytes()
        if "bytes" in item and len(raw) != int(item["bytes"]):
            raise RuntimeError(f"byte count mismatch: {path}")
        digest = sha256(raw)
        if "sha256" in item and digest != item["sha256"]:
            raise RuntimeError(f"digest mismatch: {path}")
        encoded_parts.append(raw.decode("ascii").strip())
        verified_parts.append({"name": path.name, "bytes": len(raw), "sha256": digest})
    encoded = "".join(encoded_parts)
    if manifest.get("encodedChars") is not None and len(encoded) != int(manifest["encodedChars"]):
        raise RuntimeError("encoded length mismatch")
    compressed = base64.b64decode(encoded, validate=True)
    if manifest.get("compressedBytes") is not None and len(compressed) != int(manifest["compressedBytes"]):
        raise RuntimeError("compressed byte count mismatch")
    digest = sha256(compressed)
    if manifest.get("compressedSha256") and digest != manifest["compressedSha256"]:
        raise RuntimeError("compressed digest mismatch")
    payload = json.loads(lzma.decompress(compressed))
    runtime = payload["runtime"]
    for name, content in runtime.items():
        if Path(name).name != name:
            raise RuntimeError(f"unsafe runtime name: {name}")
        (destination / name).write_text(content, encoding="utf-8")
    if payload.get("qa_runner.py"):
        (destination / "qa_runner.py").write_text(payload["qa_runner.py"], encoding="utf-8")
    return {
        "sourceVersion": manifest.get("version"),
        "sourceBuildId": manifest.get("buildId"),
        "compressedBytes": len(compressed),
        "compressedSha256": digest,
        "parts": verified_parts,
        "runtimeFiles": sorted(runtime),
    }


def replace_all(root: Path, pairs: list[tuple[str, str]]) -> None:
    for path in root.iterdir():
        if not path.is_file() or path.suffix.lower() not in {".html", ".mjs", ".md", ".json", ".css"}:
            continue
        text = path.read_text(encoding="utf-8")
        for old, new in pairs:
            text = text.replace(old, new)
        path.write_text(text, encoding="utf-8")


def polish(runtime: Path) -> dict:
    replace_all(runtime, [
        ("0.3.1-island-r018", VERSION),
        ("0.3.0-island-r018", VERSION),
        ("island-r018-causal-polish", BUILD_ID),
        ("island-r018-additive-controls", BUILD_ID),
        ("?v=r018", "?v=r018032"),
        ("R018 · 研究候选", "R018 · 0.3.2 交付候选"),
    ])
    build_path = runtime / "BUILD.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build.update({
        "version": VERSION,
        "buildId": BUILD_ID,
        "mediaWarmupSeconds": 10,
        "runtimeImageAssets": 0,
        "externalModels": 0,
        "externalCdn": 0,
        "visualApproved": False,
        "productionApproved": False,
        "deliveryPolicy": "verified direct-open HTML plus online workbench",
        "r018DeliveryPolish": {
            "offshoreBoundaryGuard": True,
            "breakerFoamReadability": True,
            "smokeFireWarmupSeconds": 10,
            "pauseResumeContinuity": True,
            "restartRecovery": True,
            "singleFileDirectOpen": True,
        },
    })
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    app_path = runtime / "app.mjs"
    app = app_path.read_text(encoding="utf-8")
    guarded = [
        ("distance:r*4.9", "distance:r*5.35"),
        ("distance:r*4.6", "distance:r*5.0"),
        ("v.distance*=1.50", "v.distance*=1.62"),
        ("mat4Perspective(camera.proj,camera.fov,aspect,.15,650)", "mat4Perspective(camera.proj,camera.fov,aspect,.15,900)"),
        ("physicalTime>16", "physicalTime>10"),
        ("physicalTime >= 16", "physicalTime >= 10"),
    ]
    applied = []
    for old, new in guarded:
        if old in app:
            app = app.replace(old, new)
            applied.append(old)
    app_path.write_text(app, encoding="utf-8")

    index_path = runtime / "index.html"
    index = index_path.read_text(encoding="utf-8")
    index = index.replace("Ocean Mother | R018", "Ocean Mother | R018 V0.3.2")
    index = index.replace("ISLAND LAB / R018", "ISLAND LAB / R018 V0.3.2")
    index_path.write_text(index, encoding="utf-8")
    return {"guardedRuntimePatches": applied}


def deep_preview_html() -> str:
    return r'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#031421;font-family:Inter,system-ui,sans-serif}canvas{width:100%;height:100%;display:block}.hud{position:fixed;left:22px;top:20px;color:#e5fbff;padding:11px 14px;border-radius:15px;border:1px solid #c4f3ff55;background:#06243dbb;backdrop-filter:blur(14px);letter-spacing:.13em;font-size:12px}.hud b{display:block;font-size:15px;letter-spacing:.04em;margin-top:4px}.hint{position:fixed;right:18px;bottom:18px;color:#cdebf4aa;font-size:11px}</style></head><body><canvas id="o"></canvas><div class="hud">DEEP OCEAN<b>程序化深海连续波场</b></div><div class="hint">拖动改变观察方向 · 滚轮改变浪高</div><script>
const c=document.getElementById('o'),gl=c.getContext('webgl2',{antialias:false,alpha:false});if(!gl)throw Error('WebGL2 unavailable');
const vs=`#version 300 es\nprecision highp float;const vec2 P[3]=vec2[3](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));out vec2 v;void main(){v=P[gl_VertexID]*.5+.5;gl_Position=vec4(P[gl_VertexID],0,1);}`;
const fs=`#version 300 es\nprecision highp float;in vec2 v;out vec4 O;uniform vec2 R;uniform float T;uniform vec2 A;uniform float H;float wave(vec2 p){float h=0.;h+=sin(dot(p,vec2(.82,.57))*1.35+T*.82)*.48;h+=sin(dot(p,vec2(.34,.94))*2.3+T*1.15)*.23;h+=sin(dot(p,vec2(-.61,.79))*4.8+T*1.72)*.10;h+=sin(dot(p,vec2(.97,-.24))*8.6+T*2.2)*.04;return h*H;}vec3 sky(vec3 d){float y=max(d.y,0.);vec3 a=mix(vec3(.025,.11,.18),vec3(.22,.52,.67),pow(y,.45));vec3 s=normalize(vec3(-.55,.52,-.66));float sun=pow(max(dot(d,s),0.),900.);a+=vec3(1.,.82,.55)*sun*4.;return a;}void main(){vec2 q=(gl_FragCoord.xy-.5*R)/R.y;q.x+=A.x;q.y+=A.y*.15;vec3 ro=vec3(0.,2.25,4.4),rd=normalize(vec3(q.x,q.y-.22,-1.25));float t=(ro.y)/max(.05,-rd.y);vec3 p=ro+rd*t;float h=wave(p.xz);for(int i=0;i<6;i++){t=(ro.y-h)/max(.05,-rd.y);p=ro+rd*t;h=wave(p.xz);}float e=.018;float hx=wave(p.xz+vec2(e,0.))-wave(p.xz-vec2(e,0.));float hz=wave(p.xz+vec2(0,e))-wave(p.xz-vec2(0,e));vec3 n=normalize(vec3(-hx/(2.*e),1.,-hz/(2.*e)));vec3 refl=reflect(rd,n);float fres=pow(1.-max(dot(-rd,n),0.),5.);vec3 deep=vec3(.008,.08,.14)+vec3(.0,.12,.18)*max(n.y,0.);vec3 col=mix(deep,sky(refl),.32+.62*fres);float foam=smoothstep(.38,.78,abs(hx)+abs(hz))*smoothstep(.0,.35,h);col=mix(col,vec3(.76,.94,.96),foam*.28);float fog=1.-exp(-t*.018);col=mix(col,vec3(.04,.22,.32),fog*.55);col=pow(col,vec3(.82));O=vec4(col,1.);}`;
function sh(t,s){const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);if(!gl.getShaderParameter(x,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(x));return x}const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,vs));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));const R=gl.getUniformLocation(p,'R'),T=gl.getUniformLocation(p,'T'),A=gl.getUniformLocation(p,'A'),H=gl.getUniformLocation(p,'H');let ax=0,ay=0,h=.72,drag=null;c.onpointerdown=e=>{drag=[e.clientX,e.clientY];c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!drag)return;ax+=(e.clientX-drag[0])*.0015;ay+=(e.clientY-drag[1])*.0015;drag=[e.clientX,e.clientY]};c.onpointerup=()=>drag=null;c.onwheel=e=>{e.preventDefault();h=Math.max(.25,Math.min(1.35,h+e.deltaY*.0005))};function f(ms){const d=Math.min(1.5,devicePixelRatio||1),w=Math.max(2,c.clientWidth*d|0),z=Math.max(2,c.clientHeight*d|0);if(c.width!==w||c.height!==z){c.width=w;c.height=z}gl.viewport(0,0,w,z);gl.useProgram(p);gl.uniform2f(R,w,z);gl.uniform1f(T,ms*.001);gl.uniform2f(A,ax,ay);gl.uniform1f(H,h);gl.drawArrays(gl.TRIANGLES,0,3);requestAnimationFrame(f)}requestAnimationFrame(f);
</script></body></html>'''


def build_direct(runtime: Path, output: Path) -> dict:
    index = (runtime / "index.html").read_text(encoding="utf-8")
    css = (runtime / "coast.css").read_text(encoding="utf-8")
    module_cache: dict[str, str] = {}
    visiting: set[str] = set()
    import_re = re.compile(r"(?P<prefix>\b(?:from\s*|import\s*))(?P<quote>['\"])(?P<spec>\./[^'\"]+\.mjs)(?P=quote)")

    def module_url(specifier: str) -> str:
        name = specifier.split("?", 1)[0]
        if name.startswith("./"):
            name = name[2:]
        if name in module_cache:
            return module_cache[name]
        if name in visiting:
            raise RuntimeError(f"cyclic module import: {name}")
        visiting.add(name)
        source = (runtime / name).read_text(encoding="utf-8")

        def repl(match: re.Match) -> str:
            dependency = module_url(match.group("spec"))
            return f"{match.group('prefix')}{match.group('quote')}{dependency}{match.group('quote')}"

        source = import_re.sub(repl, source)
        visiting.remove(name)
        url = "data:text/javascript;base64," + base64.b64encode(source.encode("utf-8")).decode("ascii")
        module_cache[name] = url
        return url

    app_url = module_url("app.mjs")
    index = re.sub(r"<link[^>]+href=['\"]coast\.css[^'\"]*['\"][^>]*>", f"<style>{css}</style>", index, flags=re.I)
    index = re.sub(r"<script\s+type=['\"]module['\"]\s+src=['\"]app\.mjs[^'\"]*['\"]\s*></script>", f"<script type=\"module\" src=\"{app_url}\"></script>", index, flags=re.I)
    deep_url = "data:text/html;base64," + base64.b64encode(deep_preview_html().encode("utf-8")).decode("ascii")
    index = re.sub(r"data-src=['\"][^'\"]*['\"]", f"data-src=\"{deep_url}\"", index, count=1)
    if "OCEAN_MOTHER_R018_DIRECT_OPEN" not in index:
        index = index.replace("<!doctype html>", "<!doctype html>\n<!-- OCEAN_MOTHER_R018_DIRECT_OPEN -->", 1)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(index, encoding="utf-8")
    return {"bytes": output.stat().st_size, "sha256": sha256(output.read_bytes()), "embeddedModules": sorted(module_cache)}


def patch_online_deep(runtime: Path) -> None:
    index_path = runtime / "index.html"
    index = index_path.read_text(encoding="utf-8")
    deep_url = "data:text/html;base64," + base64.b64encode(deep_preview_html().encode("utf-8")).decode("ascii")
    index = re.sub(r"data-src=['\"][^'\"]*['\"]", f"data-src=\"{deep_url}\"", index, count=1)
    index_path.write_text(index, encoding="utf-8")


def verify_asset_policy(runtime: Path, direct: Path) -> dict:
    illegal = [str(path) for path in runtime.rglob("*") if path.is_file() and path.suffix.lower() in BANNED_SUFFIXES]
    if illegal:
        raise RuntimeError(f"runtime binary visual assets found: {illegal}")
    for path in runtime.iterdir():
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"https?://", text, re.I):
            raise RuntimeError(f"external runtime URL found: {path}")
    direct_text = direct.read_text(encoding="utf-8")
    external = re.findall(r"(?:src|href)=['\"](https?://[^'\"]+)", direct_text, re.I)
    if external:
        raise RuntimeError(f"external direct-open dependency found: {external}")
    return {"illegalAssets": illegal, "externalDirectDependencies": external}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", default=".")
    parser.add_argument("--dist", required=True)
    args = parser.parse_args()
    repo = Path(args.repo).resolve()
    dist = Path(args.dist).resolve()
    if dist.exists():
        shutil.rmtree(dist)
    runtime = dist / "runtime"
    direct_dir = dist / "direct"
    payload_path, manifest = select_payload(repo)
    receipt = materialize(payload_path, manifest, runtime)
    receipt.update(polish(runtime))
    patch_online_deep(runtime)
    direct = direct_dir / "index.html"
    receipt["directOpen"] = build_direct(runtime, direct)
    receipt["assetPolicy"] = verify_asset_policy(runtime, direct)
    receipt.update({
        "format": "ocean-mother-r018-v032-delivery",
        "version": VERSION,
        "buildId": BUILD_ID,
        "visualApproved": False,
        "productionApproved": False,
        "deliveryPolicy": "verified direct-open HTML plus online workbench",
    })
    (dist / "BUILD_RECEIPT.json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (direct_dir / "SHA256.txt").write_text(f"{receipt['directOpen']['sha256']}  index.html\n", encoding="utf-8")
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
