"""Recover losslessly packaged map samples from this standalone HTML for audit/rebuild."""
from pathlib import Path
import re,json,base64,gzip
import numpy as np
R=Path(__file__).resolve().parent
s=(R/'index.html').read_text();d=json.loads(re.search(r'<script>window.HK_MAP_DATA=(.*?);</script>',s,re.S).group(1));p=R/'data';p.mkdir(exist_ok=True)
shape=(d['height'],d['width'])
for key,name,dtype in [('heights','heights.npy','<f4'),('mask','mask.npy','u1')]:
 a=np.frombuffer(gzip.decompress(base64.b64decode(d.pop(key))),dtype=dtype).reshape(shape);np.save(p/name,a)
(p/'scene.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
print('Recovered',shape,'grid without quantization; source datum',d['datum'])
