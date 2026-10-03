"""Reproduce the isolated optical candidate from its preserved standalone baseline.
All runtime assets remain embedded; this is a build-time source transformation.
No download or external runtime dependency is introduced.
"""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parent.parent
base=ROOT/'dist/KAOPU-r04-阴影过滤候选.html'
assert hashlib.sha256(base.read_bytes()).hexdigest()=='3ac8f23e7f3ade2605e03a1e4ea2644d1c6e2bf8d7d1f0b889e7a34308c6fbab'
old=(ROOT/'qa/r04-optics-front-return/anemone-optics-before.js').read_text()
new=(ROOT/'qa/r04-optics-front-return/anemone-optics-after.js').read_text()
old_host=(ROOT/'optics-stage/src/anemone-host.js').read_text()
new_host=(ROOT/'optics-stage/src/anemone-front-return-host.js').read_text()
controls='<label class="optics-label">前侧组织返回（近似） <output id="anemoneFrontReturnValue">0.65</output><input id="anemoneFrontReturn" type="range" min="0" max="1" step="0.05" value="0.65"></label><label class="optics-label">组织返回诊断<select id="anemoneFrontReturnView"><option value="beauty">完整材质</option><option value="return-only">仅返回贡献</option><option value="layer-reflectance">有限厚度返回率</option><option value="normal-thickness">法向组织厚度</option></select></label>'
s=base.read_text();assert s.count(old)==1 and s.count(old_host)==1
s=s.replace(old,new+'\nwindow.KAOPU_BASE_OPTICS=window.AnemoneOptics;window.AnemoneOptics=window.AnemoneOptics.frontReturn;\n').replace(old_host,new_host)
s=s.replace('<label class="switch" style="margin:13px 0"><input id="anemoneTransmission"',controls+'<label class="switch" style="margin:13px 0"><input id="anemoneTransmission"')
s=s.replace('content="2026-10-03-anemone-r04-optics-stage"','content="2026-10-03-anemone-r04-front-return-stage"')
out=ROOT/'dist/KAOPU-r04-组织返回候选.html';out.write_text(s)
assert hashlib.sha256(out.read_bytes()).hexdigest()=='d2c362898381068bb4883e4e80003bbf5814cb15a160c9a5ad0c4ca4c5547fc9'
print(out.stat().st_size,hashlib.sha256(out.read_bytes()).hexdigest())
