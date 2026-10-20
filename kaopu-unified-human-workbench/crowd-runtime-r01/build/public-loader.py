#!/usr/bin/env python3
"""Build the crowd page around the SHA-locked native F13 public loader.

Typical use after committing the application's gzip chunks::

    python3 build/public-loader.py --config APP_MANIFEST.json \
      --prefix https://raw.githubusercontent.com/OWNER/REPO/COMMIT/crowd-runtime-r01/ \
      --out public.html

The config accepts pack-app.py's compression/runtimeBytes/runtimeSHA256/parts,
or encoding/decodedBytes/decodedSHA256 aliases. For several ordered IIFEs, use
{"packages": [config, ...]}. The builder never fetches or changes upstream F13.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_LOADER_BYTES = 3757
ORIGINAL_LOADER_SHA256 = "d27160db8057f6d6a22bc0565ef4c03da995cfc54bd5cb1f8b2ecb2f458daaaf"
RUNTIME_BYTES = 8590615
RUNTIME_SHA256 = "cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790"
LOADER_ANCHOR = "const source=new TextDecoder().decode(bytes);document.open();document.write(source);document.close();"
API_ANCHOR = "window.hairF13={report:ic,"
API_REPLACEMENT = "window.hairF13={_raw:()=>({THREE:B1,PhotoDynamics:ne,viewer:f2,model:ys,fibers:u8,motion:I1,dynamics:M1}),report:ic,"
BODY_ANCHOR = '<body class="presets-workbench workbench-entry-layout">'
OVERLAY = ('<div id="crowd-runtime-bootstrap" style="position:fixed;inset:0;z-index:2147479000;'
           'display:grid;place-items:center;background:#f4f3eb;color:#234235;pointer-events:auto;'
           'font:16px/1.7 system-ui;text-align:left;padding:24px;box-sizing:border-box">'
           '<div style="width:min(560px,100%);padding:24px;box-sizing:border-box">'
           '<h1 style="margin:0 0 12px;font:600 26px/1.4 system-ui;color:#234235">完整人物 · 多人运行台</h1>'
           '<p style="margin:0 0 18px;font:16px/1.7 system-ui;color:#405f50">正在准备原生身体与发丝…</p>'
           '<pre id="crowd-runtime-bootstrap-progress" style="margin:0;max-height:40vh;overflow:auto;'
           'white-space:pre-wrap;font:13px/1.7 system-ui;color:#526d5e">正在初始化完整人物</pre>'
           '</div></div>')


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def positive_size(value: object, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{label} must be a positive integer")
    return value


def checked_sha(value: object, label: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[a-fA-F0-9]{64}", value):
        raise ValueError(f"{label} must be a SHA-256 hex digest")
    return value.lower()


def immutable_url(value: object, label: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be an HTTPS raw GitHub URL")
    parsed = urlparse(value)
    segments = parsed.path.strip("/").split("/")
    if (parsed.scheme != "https" or parsed.netloc != "raw.githubusercontent.com"
            or parsed.query or parsed.fragment or len(segments) < 4
            or not re.fullmatch(r"[a-fA-F0-9]{40}", segments[2])):
        raise ValueError(f"{label} must pin a 40-character Git commit in a raw.githubusercontent.com URL")
    return value


def normalize_config(config: dict, prefix_override: str | None) -> list[dict]:
    raw_packages = config.get("packages", [config])
    if not isinstance(raw_packages, list) or not raw_packages:
        raise ValueError("config.packages must be a nonempty array")
    common_prefix = prefix_override or config.get("prefix", "")
    packages = []
    for index, item in enumerate(raw_packages):
        if not isinstance(item, dict):
            raise ValueError(f"package {index} must be an object")
        label = str(item.get("name", f"app-{index}"))
        encoding = item.get("encoding", item.get("compression", "gzip"))
        if encoding not in ("gzip", "identity"):
            raise ValueError(f"{label}: encoding must be gzip or identity")
        prefix = prefix_override or item.get("prefix", common_prefix)
        if prefix and not prefix.endswith("/"):
            raise ValueError(f"{label}: prefix must end in /")
        parts = item.get("parts")
        if parts is None and "url" in item:
            # A verified uncompressed IIFE can also be served as a single file.
            parts = [{"url": item["url"], "bytes": item.get("bytes"), "sha256": item.get("sha256")}]
            encoding = item.get("encoding", item.get("compression", "identity"))
        if not isinstance(parts, list) or not parts:
            raise ValueError(f"{label}: parts must be a nonempty array")
        normalized_parts = []
        for part_index, part in enumerate(parts):
            if not isinstance(part, dict):
                raise ValueError(f"{label}: part {part_index} must be an object")
            part_label = f"{label} part {part_index}"
            url = part.get("url")
            if url is None:
                path = part.get("path")
                if not prefix or not isinstance(path, str) or not path or path.startswith("/") or ".." in path.split("/"):
                    raise ValueError(f"{part_label}: supply a fixed prefix and relative path, or an absolute url")
                url = urljoin(prefix, path)
            normalized_parts.append({
                "url": immutable_url(url, part_label),
                "bytes": positive_size(part.get("bytes"), f"{part_label} bytes"),
                "sha256": checked_sha(part.get("sha256"), f"{part_label} sha256"),
            })
        decoded_bytes = item.get("decodedBytes", item.get("runtimeBytes", item.get("bytes")))
        decoded_sha = item.get("decodedSHA256", item.get("runtimeSHA256", item.get("sha256")))
        packages.append({
            "name": label,
            "encoding": encoding,
            "decodedBytes": positive_size(decoded_bytes, f"{label} decodedBytes"),
            "decodedSHA256": checked_sha(decoded_sha, f"{label} decodedSHA256"),
            "parts": normalized_parts,
        })
    return packages


BOOTSTRAP = r"""(()=>{
'use strict';
const config=__CONFIG__;
const receipt=window.__CROWD_RUNTIME_LOADER__={schema:'crowd-runtime-loader@1',state:'fetching-app',nativeRuntime:{bytes:8590615,sha256:'cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790'},packages:[],startedAt:new Date().toISOString()};
const panel=document.getElementById('crowd-runtime-bootstrap'),progress=document.getElementById('crowd-runtime-bootstrap-progress');
function status(message,state){progress.textContent=message;if(state)receipt.state=state;panel.dataset.state=receipt.state;document.documentElement.dataset.crowdLoaderState=receipt.state;}
const observer=new MutationObserver(()=>{if(document.getElementById('crowd-app')){panel.remove();observer.disconnect();receipt.uiMounted=true;}});observer.observe(document.body,{childList:true});
status('正在校验多人场景数据…');
const hex=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchPart(part){
 for(let attempt=0;attempt<3;attempt++){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
  try{const response=await fetch(part.url,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status+' '+part.url);const bytes=await response.arrayBuffer();if(bytes.byteLength!==part.bytes||await hex(bytes)!==part.sha256)throw Error('场景分片校验失败：'+part.url);return new Uint8Array(bytes);}
  catch(error){if(attempt===2)throw error;}
  finally{clearTimeout(timer);}
 }
}
async function loadPackage(pkg,index){
 let next=0,done=0;const chunks=new Array(pkg.parts.length);
 await Promise.all(Array.from({length:Math.min(3,chunks.length)},async()=>{while(next<chunks.length){const partIndex=next++;chunks[partIndex]=await fetchPart(pkg.parts[partIndex]);status('正在校验多人场景 '+(index+1)+' / '+config.length+'，数据分片 '+(++done)+' / '+chunks.length);}}));
 let stream=new Blob(chunks).stream();if(pkg.encoding==='gzip')stream=stream.pipeThrough(new DecompressionStream('gzip'));
 const bytes=await new Response(stream).arrayBuffer();if(bytes.byteLength!==pkg.decodedBytes||await hex(bytes)!==pkg.decodedSHA256)throw Error('完整场景版本校验失败：'+pkg.name);
 receipt.packages.push({name:pkg.name,bytes:bytes.byteLength,sha256:pkg.decodedSHA256,parts:pkg.parts.length,verified:true,dispatched:false});
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
async function waitForNative(){
 const started=performance.now();
 while(true){
  const api=window.hairF13,report=api?.report?.();
  if(report?.errors?.length)throw Error('原生人物初始化失败：'+JSON.stringify(report.errors));
  if(report?.ready){const raw=api._raw?.();if(!raw?.THREE?.Mesh||!raw.PhotoDynamics||!raw.viewer||!raw.model||!raw.fibers||!raw.motion||!raw.dynamics)throw Error('已锁定 F13 原生接口不完整');return api;}
  if(performance.now()-started>480000)throw Error('原生人物初始化超时');
  await sleep(150);
 }
}
async function start(){
 const sources=[];for(let i=0;i<config.length;i++)sources.push(await loadPackage(config[i],i));
 status('场景数据已校验，正在等待完整人物初始化…','waiting-native');
 const api=await waitForNative();api.setManual(true);api.pause(true);window.lifelikeIdle?.pause?.(true);
 for(let i=0;i<sources.length;i++){
  status('正在启动统一多人场景…','dispatching-app');let scriptError=null;
  const onError=event=>{scriptError=event.error||new Error(event.message||'场景脚本执行失败');};window.addEventListener('error',onError);
  try{const script=document.createElement('scr'+'ipt');script.dataset.crowdPackage=config[i].name;script.textContent=sources[i];document.body.append(script);script.remove();if(scriptError)throw scriptError;receipt.packages[i].dispatched=true;}
  finally{window.removeEventListener('error',onError);}
 }
 receipt.finishedAt=new Date().toISOString();status('统一多人场景程序已启动','app-dispatched');if(document.getElementById('crowd-app')){panel.remove();observer.disconnect();receipt.uiMounted=true;}
 // Dispatched means verified IIFEs executed. The application owns scene readiness.
}
start().catch(error=>{receipt.error=String(error?.stack||error);status('多人场景载入未完成：\n'+receipt.error,'failed');console.error(error);});
})();"""


def build(original: bytes, packages: list[dict]) -> tuple[bytes, dict]:
    if len(original) != ORIGINAL_LOADER_BYTES or digest(original) != ORIGINAL_LOADER_SHA256:
        raise ValueError("The original F13 public loader does not match its pinned bytes and SHA-256")
    source = original.decode("utf-8")
    if source.count(LOADER_ANCHOR) != 1:
        raise ValueError("F13 loader anchor drift")
    bootstrap = BOOTSTRAP.replace("__CONFIG__", json.dumps(packages, ensure_ascii=True, separators=(",", ":")))
    # htmlpreview also rewrites literal script tags inside strings. Keep dynamic
    # tag delimiters split, including within this nested bootstrap string.
    if re.search(r"</?script\b", bootstrap, re.I):
        raise ValueError("The bootstrap contains a literal script tag; split its name")
    replacement = (
        "let source=new TextDecoder().decode(bytes);"
        f"const crowdApiAnchor={json.dumps(API_ANCHOR)};"
        "if(source.split(crowdApiAnchor).length!==2)throw Error('F13 API anchor drift');"
        f"source=source.replace(crowdApiAnchor,{json.dumps(API_REPLACEMENT)});"
        f"const crowdBodyAnchor={json.dumps(BODY_ANCHOR)};"
        "if(source.split(crowdBodyAnchor).length!==2)throw Error('F13 opening body anchor drift');"
        f"source=source.replace(crowdBodyAnchor,crowdBodyAnchor+{json.dumps(OVERLAY, ensure_ascii=True)});"
        "if(source.split('</body>').length!==2)throw Error('F13 body anchor drift');"
        "source=source.replace('</body>',()=>'<scr'+'ipt>'+"
        + json.dumps(bootstrap, ensure_ascii=True)
        + "+'</scr'+'ipt></body>');document.open();document.write(source);document.close();"
    )
    source = source.replace(LOADER_ANCHOR, replacement).replace(
        "<title>参考发型 · 发丝与动作 / F13</title>",
        "<title>统一人物运行场 · R01</title>",
    ).replace('正在载入完整人物 P01…<br>', '完整人物 · 多人运行台<br>正在准备原生身体与发丝…<br>')
    if len(re.findall(r"<script\b", source, re.I)) != 1 or len(re.findall(r"</script\b", source, re.I)) != 1:
        raise ValueError("The public loader must contain exactly one literal script tag pair")
    result = source.encode("utf-8")
    receipt = {
        "schema": "crowd-runtime-public-build@1",
        "originalLoader": {"bytes": ORIGINAL_LOADER_BYTES, "sha256": ORIGINAL_LOADER_SHA256},
        "nativeRuntime": {"bytes": RUNTIME_BYTES, "sha256": RUNTIME_SHA256},
        "injection": {"apiAnchor": API_ANCHOR, "apiReplacement": API_REPLACEMENT, "changesNativeSourceOnDisk": False},
        "packages": packages,
        "bootstrap": {"bytes": len(bootstrap.encode()), "sha256": digest(bootstrap.encode())},
        "publicLoader": {"bytes": len(result), "sha256": digest(result)},
    }
    return result, receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--config", "--manifest", dest="config", type=Path, required=True)
    parser.add_argument("--prefix", help="Fixed raw GitHub commit prefix, ending in /")
    parser.add_argument("--original-loader", type=Path, default=ROOT / "vendor/f13-public.html")
    parser.add_argument("--out", type=Path, default=ROOT / "public.html")
    parser.add_argument("--receipt", type=Path, help="Optional build receipt; defaults to PUBLIC_BUILD.json beside --out")
    args = parser.parse_args()
    config = json.loads(args.config.read_text(encoding="utf-8"))
    if not isinstance(config, dict):
        raise ValueError("config must be a JSON object")
    packages = normalize_config(config, args.prefix)
    result, receipt = build(args.original_loader.read_bytes(), packages)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(result)
    receipt_path = args.receipt or args.out.with_name("PUBLIC_BUILD.json")
    receipt_path.parent.mkdir(parents=True, exist_ok=True)
    receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"path": str(args.out), **receipt["publicLoader"], "packages": len(packages), "receipt": str(receipt_path)}))


if __name__ == "__main__":
    main()
