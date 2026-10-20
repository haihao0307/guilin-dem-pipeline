#!/usr/bin/env python3
"""Build a same-document extension of the pinned public native human runtime."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src'
UPSTREAM = ROOT / 'reference' / 'mp05-studio-r10'
DIST = ROOT / 'dist'
PINNED_REVISION = 'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49'
UPSTREAM_DIRECTORY = 'kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef'


def fingerprint(data: bytes) -> dict:
    return {
        'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(),
        'gitBlobSHA1': hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest(),
    }


def build() -> None:
    for path in [SOURCE / 'shell.html', SOURCE / 'app.mjs', SOURCE / 'style.css', SOURCE / 'native-host.mjs', UPSTREAM / 'platform-runtime' / 'preview.html']:
        if not path.is_file():
            raise SystemExit('Missing required source: ' + str(path))
    upstream_html = (UPSTREAM / 'platform-runtime' / 'preview.html').read_bytes()
    html = upstream_html.decode('utf-8')
    reviewed_patches = []
    def replace_once(before: str, after: str) -> None:
        nonlocal html
        if html.count(before) != 1:
            raise SystemExit('A reviewed same-document patch no longer matches exactly once: ' + before[:100])
        reviewed_patches.append([before, after])
        html = html.replace(before, after, 1)
    expected = "new URL('./asset-cache/'+h,location.href)"
    if html.count(expected) != 1:
        raise SystemExit('The retained native fetch adapter does not match its reviewed source.')
    replace_once(expected, "new URL('./upstream/platform-runtime/asset-cache/'+h,location.href)")
    # The original adapter lived in an iframe. In the shared document it also
    # receives URL objects from the frozen-body loader, so handle URL and Request.
    original_input = "const raw=typeof input==='string'?input:input.url; if(raw.startsWith('https://raw.githubusercontent.com/'))"
    replacement_input = "const raw=typeof input==='string'?input:(input instanceof URL?input.href:input?.url); if(typeof raw==='string'&&raw.startsWith('https://raw.githubusercontent.com/'))"
    if html.count(original_input) != 1:
        raise SystemExit('The retained native fetch input adapter has changed.')
    replace_once(original_input, replacement_input)
    # ImageLoader uses <img>, not fetch, so the original fetch shim cannot
    # redirect these two retained skin maps. Use their already verified cached
    # bytes as well; do not remove or replace the native skin inputs.
    face_module = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/FaceSkin.mjs'
    image_expression = 'new URL("./assets/"+e,"' + face_module + '").href'
    image_cache = {name: hashlib.sha256((face_module.rsplit('/', 1)[0] + '/assets/' + name).encode()).hexdigest() for name in ['detail.png', 'chroma.png']}
    for cached_name in image_cache.values():
        if not (UPSTREAM / 'platform-runtime' / 'asset-cache' / cached_name).is_file():
            raise SystemExit('A retained skin image is absent from the verified cache: ' + cached_name)
    replace_once(image_expression, 'new URL("./upstream/platform-runtime/asset-cache/"+' + json.dumps(image_cache, separators=(',', ':')) + '[e],location.href).href')
    original_title = re.search(r'<title>[^<]*</title>', html)
    if not original_title:
        raise SystemExit('The retained native HTML has no title.')
    replace_once(original_title.group(0), '<title>独立衣物叠穿 · KAOPU R01</title>')
    importmap = '<script type="importmap">' + json.dumps({'imports': {'three': './upstream/vendor/three.module.js'}}, separators=(',', ':')) + '</script>'
    replace_once('<head>', '<head>' + importmap)
    replace_once('</head>', '<link rel="stylesheet" href="./style.css"></head>')
    shell = (SOURCE / 'shell.html').read_bytes().decode('utf-8')
    replace_once('</body>', '\n' + shell + '\n<script type="module" src="./app.mjs"></script>\n</body>')
    # Serve the retained native runtime as its original, already published blob.
    # Assemble the reviewed extension in this same document, after validating
    # both the source and the exact patched result. There is no iframe or second
    # model. No modules run before the one complete document write.
    patches_json = json.dumps(reviewed_patches, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
    loader = '''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>独立衣物叠穿 · KAOPU R01</title>
<style>body{margin:0;background:#edece7;color:#343c37;font:16px/1.7 system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{max-width:34rem;padding:2.5rem}small{color:#778079}h1{font-size:26px;font-weight:500}p{overflow-wrap:anywhere}</style></head><body><main><small>KAOPU · 穿着研究</small><h1>独立衣物叠穿</h1><p id="bootstrap-status">正在准备原人物与独立衣物…</p></main><script>
(async function(){
 const status=document.getElementById('bootstrap-status');
 const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
 try {
  const response=await fetch('./upstream/platform-runtime/preview.html');
  if(!response.ok)throw Error('原人物运行时下载失败：'+response.status);
  const bytes=await response.arrayBuffer();
  if(await digest(bytes)!=='__ORIGINAL_SHA__')throw Error('原人物运行时来源校验不一致。');
  let html=new TextDecoder().decode(bytes);
  const patches=__PATCHES__;
  for(const [before,after] of patches){
   const first=html.indexOf(before);
   if(first<0||html.indexOf(before,first+before.length)>=0)throw Error('已审查的人物接口发生变化。');
   html=html.replace(before,()=>after);
  }
  if(await digest(new TextEncoder().encode(html))!=='__ASSEMBLED_SHA__')throw Error('叠穿宿主组装校验不一致。');
  document.open();document.write(html);document.close();
 } catch(error) {status.textContent=error.message;status.setAttribute('role','alert');console.error(error);}
})();
</script></body></html>'''.replace('__ORIGINAL_SHA__', hashlib.sha256(upstream_html).hexdigest()).replace('__PATCHES__', patches_json).replace('__ASSEMBLED_SHA__', hashlib.sha256(html.encode('utf-8')).hexdigest())

    if DIST.exists():
        if DIST.resolve().parent != ROOT.resolve() or DIST.name != 'dist':
            raise SystemExit('Refusing to clean an unexpected output directory.')
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    source_manifest = []
    inventory = json.loads((ROOT / 'reference' / 'download-inventory.json').read_text(encoding='utf-8'))
    allowed_sources = {row['path'] for row in inventory['files']}
    # The reference directory contains only the selected public runtime closure.
    # Keep the original HTML as an unmodified source reference in upstream/.
    excluded_prefixes = ('qa-', 'test-', 'profile.', 'bake-', 'unit.')
    excluded_names = {'DOWNLOAD_REPORT.json', 'SOURCE_AUDIT.md', 'NATIVE_RUNTIME_AUDIT.md'}
    for path in sorted(UPSTREAM.rglob('*')):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(UPSTREAM)
        if relative.as_posix() not in allowed_sources:
            continue
        if relative.parts[0] in {'clips', 'boot'} or path.name in excluded_names:
            continue
        if len(relative.parts) == 1 and path.name.startswith(excluded_prefixes):
            continue
        target = DIST / 'upstream' / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        source_manifest.append({'path': relative.as_posix(), **fingerprint(path.read_bytes())})

    authored_manifest = []
    for path in sorted(SOURCE.rglob('*')):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(SOURCE)
        if relative.as_posix() == 'index.html':
            raise SystemExit('The native-host builder owns index.html; edit shell.html instead.')
        target = DIST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, target)
        authored_manifest.append({'path': relative.as_posix(), **fingerprint(path.read_bytes())})
    (DIST / 'index.html').write_bytes(loader.encode('utf-8'))
    if (ROOT / 'BUILD_MANIFEST.json').is_file():
        shutil.copyfile(ROOT / 'BUILD_MANIFEST.json', DIST / 'BUILD_MANIFEST.json')
    manifest = {
        'schema': 'kaopu-layering-source-provenance@1',
        'version': 'TAILOR-LAYERING-R01',
        'upstreamRepository': 'haihao0307/guilin-dem-pipeline',
        'upstreamRevision': PINNED_REVISION,
        'upstreamDirectory': UPSTREAM_DIRECTORY,
        'personRevision': 'd413d108704af47cf531ee8c25d93f682c3176e3',
        'motionRevisionRetainedButNotActivated': '8d0860881f34cd6d459b1099028f56dfc7b70a2c',
        'lightingRevision': 'beb3dda0a28f732e1e387dd68cc0d90f27ce8b7b',
        'nativeRuntimeOriginal': fingerprint(upstream_html),
        'hostHTML': fingerprint(loader.encode('utf-8')),
        'assembledRuntimeHTML': fingerprint(html.encode('utf-8')),
        'runtimeLoading': 'One same-document write after verifying the unmodified source and the exact reviewed patch result by SHA-256',
        'nativeRuntimePatches': [
            'Resolve the original cached-asset adapter under upstream/platform-runtime/asset-cache.',
            'Accept URL objects as well as string and Request inputs in the same-document fetch adapter.',
            'Resolve the two original face detail/chroma ImageLoader inputs to their unchanged, verified local cached bytes.',
            'Add host title, importmap, stylesheet, shell and application module; keep the original runtime DOM and scripts.'
        ],
        'sameDocumentNativeHost': True,
        'iframeRequired': False,
        'upstreamFiles': source_manifest,
        'authoredFiles': authored_manifest,
        'upstreamBytes': sum(row['bytes'] for row in source_manifest),
        'authoredBytes': sum(row['bytes'] for row in authored_manifest),
    }
    (DIST / 'SOURCE_PROVENANCE.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({
        'directory': str(DIST),
        'upstreamFiles': len(source_manifest),
        'upstreamBytes': manifest['upstreamBytes'],
        'authoredFiles': len(authored_manifest),
        'htmlBytes': len(loader.encode('utf-8')),
        'totalBytes': sum(p.stat().st_size for p in DIST.rglob('*') if p.is_file()),
        'originalRuntimeSHA256': manifest['nativeRuntimeOriginal']['sha256'],
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    build()
