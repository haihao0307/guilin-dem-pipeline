"""Final adjustments from directly inspected candidate screenshots."""
from pathlib import Path
import sys
root=Path(sys.argv[1]);p=root/'app.mjs';s=p.read_text()
s=s.replace('yaw:.22,pitch:.16,distance:19','yaw:3.65,pitch:.25,distance:15')
s=s.replace('camera.distance=v.distance;camera.dirty=true;',"camera.distance=v.distance;if(name==='overview'&&innerWidth<760){camera.target=[-8,.5,-4];camera.yaw=3.2;camera.pitch=.37;camera.distance=84}camera.dirty=true;")
s=s.replace("if(resizePending)resize();const raw=", "if(config.paused&&!opaqueDirty&&!resizePending&&!glassDirty){lastFrame=now;metrics(now);return}if(resizePending)resize();const raw=")
p.write_text(s)
p=root/'shaders.mjs';s=p.read_text().replace('float relief=.013*fbm','float relief=.004*fbm');p.write_text(s)
print('Fire view points from land toward water; portrait includes fire; idle pause performs no draw calls')
