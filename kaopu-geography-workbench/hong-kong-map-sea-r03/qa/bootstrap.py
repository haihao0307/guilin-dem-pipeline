from pathlib import Path
import numpy as np,json,gzip,base64
R=Path(__file__).resolve().parents[1];d=json.loads((R/'data/scene.json').read_text());b=json.loads((R/'data/background-pack.json').read_text())
for k,dt in [('heights','<f4'),('mask','u1')]:np.save(R/f'data/{k}.npy',np.frombuffer(gzip.decompress(base64.b64decode(b[k])),dt).reshape(d['height'],d['width']))
