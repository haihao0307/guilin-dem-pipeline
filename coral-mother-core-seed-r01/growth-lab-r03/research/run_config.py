from pathlib import Path
import json,sys,time,hashlib,numpy as np
from normal_growth import MeshGrowth
from triangle_collision import intersections
config_path=Path(sys.argv[1]);config=json.loads(config_path.read_text());out=Path(config['out']);out.mkdir(parents=True,exist_ok=True)
sources={}
for name in ['normal_growth.py','triangle_collision.py','run_config.py']:
 data=Path(__file__).with_name(name).read_bytes();(out/name).write_bytes(data);sources[name]=hashlib.sha256(data).hexdigest()
(out/'parameters.json').write_text(json.dumps({**config,'source_sha256':sources,'numpy_version':np.__version__,'time_unit':'dimensionless iteration'},indent=2))
m=MeshGrowth(**config['options']);start=time.monotonic()
edge=np.sort(np.concatenate([m.f[:,[0,1]],m.f[:,[1,2]],m.f[:,[2,0]]]),axis=1);unique,count=np.unique(edge,axis=0,return_counts=True)
assert np.all(count==2) and len(m.p)-len(unique)+len(m.f)==2,'Seed is not a single closed genus-zero surface'
assert not len(intersections(m.p,m.f)),'Seed intersects itself'
m.save(out/'stage-000.json')
for i in range(config['steps']):
 m.step()
 if m.t%20==0 or m.t==config['steps']:
  m.save(out/f'stage-{m.t:03}.json');print(json.dumps({'iteration':m.t,'seconds':time.monotonic()-start,**m.stats()}),flush=True)
