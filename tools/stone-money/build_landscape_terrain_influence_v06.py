#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
V05_BUILDER = ROOT / 'tools/stone-money/build_landscape_terrain_influence_v05.py'
V05_HTML = ROOT / 'workbenches/landscape-terrain-influence-tool-v05/index.html'
SOURCE = ROOT / 'workbenches/landscape-surface-r5-k2-g3t3-palau-production/index.html'
OUT_DIR = ROOT / 'workbenches/landscape-terrain-influence-tool-v06'
OUTPUT = OUT_DIR / 'index.html'
WORKER = OUT_DIR / 'landscape-terrain-worker-v06.js'
META = OUT_DIR / 'build.json'

WORKER_BRIDGE = r'''
<script id="landscapeTerrainWorkerBridge">
(()=>{'use strict';
const NativeWorker=window.Worker;
window.__LTI_WORKER_MODE__='external-same-origin';
window.__LTI_WORKER_REDIRECTS__=0;
if(typeof NativeWorker!=='function'){
  document.documentElement.dataset.landscapeWorkerBridgeFailure='worker-api-missing';
  return;
}
function LandscapeWorkerBridge(url,options){
  const value=String(url||'');
  if(value.startsWith('blob:')){
    window.__LTI_WORKER_REDIRECTS__++;
    return new NativeWorker('./landscape-terrain-worker-v06.js',options);
  }
  return new NativeWorker(url,options);
}
LandscapeWorkerBridge.prototype=NativeWorker.prototype;
window.Worker=LandscapeWorkerBridge;
document.documentElement.dataset.landscapeWorkerMode='external-same-origin';
})();
</script>
'''

GENERATION_MONITOR = r'''
<script id="landscapeTerrainGenerationMonitor">
(()=>{'use strict';
const root=document.documentElement;
const status=()=>document.getElementById('ltiStatus');
let last='';
function show(text){const e=status();if(e)e.textContent=text;}
function detail(value){return String(value&&value.message?value.message:value||'').slice(0,420);}
window.addEventListener('error',e=>{window.__LTI_LAST_WINDOW_ERROR__=detail(e.error||e.message||e);});
window.addEventListener('unhandledrejection',e=>{window.__LTI_LAST_REJECTION__=detail(e.reason||e);});
const timer=setInterval(()=>{
  if(window.__LM_READY__===true){
    root.dataset.landscapeGenerationReady='true';
    root.dataset.landscapeWorkerRedirects=String(window.__LTI_WORKER_REDIRECTS__||0);
    show('原台生成完成');
    clearInterval(timer);
    return;
  }
  if(window.__LM_ERROR__){
    const message=detail(window.__LM_ERROR__);
    root.dataset.landscapeGenerationFailure=message||'unknown';
    show('生成失败：'+(message||'未知错误'));
    const box=document.getElementById('error');
    if(box&&(!box.textContent||box.textContent==='Error'))box.textContent=message||window.__LTI_LAST_WINDOW_ERROR__||window.__LTI_LAST_REJECTION__||'未知生成错误';
    clearInterval(timer);
    return;
  }
  const step=document.getElementById('step')?.textContent||'';
  if(step&&step!==last){last=step;show('生成中：'+step);}
},250);
})();
</script>
'''

WORKER_TAIL = r'''
self.onmessage=e=>{
  try{
    const data=generateScene(e.data,(p,text)=>self.postMessage({p,text}));
    const transfer=[];
    for(const part of data.parts)transfer.push(part.vertices.buffer,part.indices.buffer);
    self.postMessage({data},transfer);
  }catch(error){
    self.postMessage({error:error&&error.stack?error.stack:String(error)});
  }
};
'''

def sha256(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()

def extract_text_script(src: str, script_id: str) -> str:
    m=re.search(rf'<script[^>]*\bid=["\']{re.escape(script_id)}["\'][^>]*>(.*?)</script>',src,re.S|re.I)
    if not m:
        raise RuntimeError(f'missing source script: {script_id}')
    return m.group(1).strip()

def main() -> None:
    subprocess.run([sys.executable,str(V05_BUILDER)],cwd=ROOT,check=True)
    source=SOURCE.read_text(encoding='utf-8')
    v05=V05_HTML.read_text(encoding='utf-8')
    if '<iframe' in v05.lower():
        raise RuntimeError('V05 unexpectedly contains iframe')
    world=extract_text_script(source,'worldSource')
    generator=extract_text_script(source,'generateSource')
    worker=world+'\n\n'+generator+'\n\n'+WORKER_TAIL
    if 'generateScene' not in worker or 'self.onmessage' not in worker:
        raise RuntimeError('worker extraction failed')
    out=v05.replace('地形影响工具体系 V0.5','地形影响工具体系 V0.6')
    out=out.replace('同一页面。','同一页面；生成器改用同源静态 Worker，避开在线 CDN 对 blob Worker 的兼容风险。',1)
    out=out.replace('</head>',WORKER_BRIDGE+'\n</head>',1)
    out=out.replace('</body>',GENERATION_MONITOR+'\n</body>',1)
    if 'landscapeTerrainWorkerBridge' not in out or 'landscapeTerrainGenerationMonitor' not in out:
        raise RuntimeError('V06 injection failed')
    OUT_DIR.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(out,encoding='utf-8')
    WORKER.write_text(worker,encoding='utf-8')
    meta={
        'schema':'LANDSCAPE_TERRAIN_INFLUENCE_TOOL_V06',
        'sourceCommit':'14fa478ff4545c2c58656bf57ba5326c03492a33',
        'sourcePath':str(SOURCE.relative_to(ROOT)).replace('\\','/'),
        'outputPath':str(OUTPUT.relative_to(ROOT)).replace('\\','/'),
        'workerPath':str(WORKER.relative_to(ROOT)).replace('\\','/'),
        'bundleMode':'same-origin-html-plus-worker',
        'singleFile':False,
        'iframeCount':out.lower().count('<iframe'),
        'blobWorkerRedirected':True,
        'presetCount':10,
        'toolSchema':'LANDSCAPE_TERRAIN_INFLUENCE_INSTRUMENT_V1',
        'lightscapeAdapterComplete':False,
        'landscapeMotherCloseoutModified':False,
        'htmlSha256':sha256(OUTPUT),
        'workerSha256':sha256(WORKER)
    }
    META.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'output':str(OUTPUT),'worker':str(WORKER),'htmlBytes':OUTPUT.stat().st_size,'workerBytes':WORKER.stat().st_size},ensure_ascii=False))

if __name__=='__main__':
    main()
