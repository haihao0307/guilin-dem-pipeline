#!/usr/bin/env python3
"""Build Landscape Mother R5.K1 from the user-approved R5 without touching macro geometry.

This patcher is intentionally strict:
- source HTML must match the frozen R5 SHA-256;
- worldSource (macro SDF / cave / foot / soil / detachment relationships) must remain byte-identical;
- only the generate worker gains read-only process tracing and the UI gains reporting text;
- visualApproved/productionReady/truthApproved remain false.
"""
from __future__ import annotations
from pathlib import Path
import hashlib, json, re, sys

ROOT=Path(__file__).resolve().parent
REPO_ROOT=ROOT.parents[1]
BASE=REPO_ROOT/'workbenches/landscape-surface-r5/index.html'
MODULE=ROOT/'karst_living_r1.js'
OUT=REPO_ROOT/'workbenches/landscape-karst-living-r1/index.html'
BASE_SHA256='ac46bf029cf2a9d5ffd3dcc5a53a29990be7aedcc17aa84be27462c8e6e89ec2'
BASE_COMMIT='039d3a7f32c73ff3ac292c5bbb18c3f6f5535b90'


def sha(b:bytes)->str:return hashlib.sha256(b).hexdigest()
def one(text:str,old:str,new:str,label:str)->str:
    n=text.count(old)
    if n!=1:raise RuntimeError(f'{label}: expected exactly one sentinel, got {n}')
    return text.replace(old,new,1)

def script_bytes(text:str,script_id:str)->bytes:
    m=re.search(rf'<script id="{re.escape(script_id)}"[^>]*>(.*?)</script>',text,re.S)
    if not m:raise RuntimeError(f'missing script {script_id}')
    return m.group(1).encode('utf-8')

def build(base_text:str,module_text:str)->tuple[str,dict]:
    macro_before=script_bytes(base_text,'worldSource')
    out=base_text
    out=one(out,'<title>Landscape Mother · 水蚀石灰岩 R5 表面显微层</title>',
            '<title>Landscape Mother · 水蚀石灰岩 R5.K1 活喀斯特诊断</title>','title')
    out=one(out,'<h1>葡萄峰丛 · 水蚀岩壁 R5</h1>',
            '<h1>葡萄峰丛 · 水蚀岩壁 R5.K1</h1>','heading')
    gen="<script id=\"generateSource\" type=\"text/plain\">'use strict';\nfunction generateScene(config,progress=()=>{}){"
    gen_new="<script id=\"generateSource\" type=\"text/plain\">'use strict';\n"+module_text+"\nfunction generateScene(config,progress=()=>{}){"
    out=one(out,gen,gen_new,'worker-module')

    start="const W=World,w=W.create(config),start=performance.now(),parts=[],step=.5;"
    inject=start+"\nconst karstAnchors=[{x:-6,z:8.8},{x:-4.8,z:8.3},{x:-7.2,z:8.4},{x:-5.6,z:7.1},{x:-6.5,z:10.2},{x:-3.9,z:9.5},{x:-8.2,z:9.3},{x:-6.0,z:11.0},{x:-2.5,z:8.8}];\nconst karstLiving=KarstLivingR1.buildDripSites({sdf:w.rock,anchors:karstAnchors,seed:config.seed,stage:Math.max(0,Math.min(1,(config.stage-1)/3)),yTop:w.bounds[1][1],yBottom:w.bounds[0][1],scanStep:.35,inputWater:1,maxSites:6,catchmentRadius:2.4,catchmentSamples:10,fractureField:()=>Math.max(0,Math.min(1,config.fracture/1.5)),vulnerabilityField:()=>.65});"
    out=one(out,start,inject,'karst-build')

    attach='report.generatedRenderBytes=bytes;report.unpackedRenderBytes=unpackedBytes;report.waterRouting=waterReports;'
    attach_new=attach+'report.karstLiving=karstLiving;report.karstLivingInvariant=KarstLivingR1.checkInvariants(karstLiving);'
    out=one(out,attach,attach_new,'karst-report')

    detail='；仅缓存当前阶段。上方 KB 是页面文件大小；MiB 是运行数据量，不含全部浏览器内存。`;dirty=true}'
    detail_new='；活喀斯特追踪 ${report.karstLiving?.sites?.length||0} 个洞顶滴水点，预算误差 ${(report.karstLiving?.totals?.massBalanceError??0).toExponential(1)}；仅缓存当前阶段。上方 KB 是页面文件大小；MiB 是运行数据量，不含全部浏览器内存。`;dirty=true}'
    out=one(out,detail,detail_new,'ui-report')

    macro_after=script_bytes(out,'worldSource')
    if macro_before!=macro_after:raise RuntimeError('PROTECTED MACRO worldSource changed')
    meta={
      'schema':'LANDSCAPE_KARST_LIVING_R1_BUILD_RECEIPT',
      'sourceCommit':BASE_COMMIT,
      'sourceSha256':sha(base_text.encode('utf-8')),
      'protectedWorldSourceSha256':sha(macro_before),
      'protectedWorldSourceByteIdentical':True,
      'karstModuleSha256':sha(module_text.encode('utf-8')),
      'visualApproved':False,'productionReady':False,'truthApproved':False,
      'claims':['relative process stage only','read-only macro geometry','proxy geochemistry only']
    }
    return out,meta

def main()->None:
    if not BASE.exists():raise SystemExit(f'missing accepted base: {BASE}')
    raw=BASE.read_bytes()
    if sha(raw)!=BASE_SHA256:raise SystemExit(f'accepted R5 hash mismatch: {sha(raw)}')
    module=MODULE.read_text(encoding='utf-8')
    out,meta=build(raw.decode('utf-8'),module)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(out,encoding='utf-8')
    meta['outputSha256']=sha(out.encode('utf-8'));meta['outputBytes']=len(out.encode('utf-8'))
    receipt=OUT.with_name('BUILD_RECEIPT.json')
    receipt.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(meta,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
