"""Build plus bounded GPU submissions. No driver waits on the UI thread."""
from pathlib import Path
import sys,json,hashlib
from build_v056 import build,replace
b,s,o=map(Path,sys.argv[1:4]);build(b,s,o)
p=o/'runtime.js';text=p.read_text()
text=replace(text,'function draw(){let g=S.gl,now=performance.now();',"function draw(){let g=S.gl,now=performance.now();if(S.gpuFence){let status=g.clientWaitSync(S.gpuFence,0,0);if(status===g.TIMEOUT_EXPIRED)return false;g.deleteSync(S.gpuFence);S.gpuFence=null;if(status===g.WAIT_FAILED)throw Error('GPU frame completion failed');}")
text=replace(text,'g.flush();S.lastDraw=now;',"S.gpuFence=g.fenceSync(g.SYNC_GPU_COMMANDS_COMPLETE,0);g.flush();S.lastDraw=now;")
p.write_text(text)
m=json.loads((o/'BUILD.json').read_text());m['gpuSubmission']={'maxFramesInFlight':1,'blockingFinish':False,'clientWaitTimeoutNs':0}
m['scientificStatus']['seasonalSelection']='deterministic rule scenarios; tropical cyclones require manual selection'
m['files']['runtime.js']={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(o/'BUILD.json').write_text(json.dumps(m,ensure_ascii=False,separators=(',',':'))+'\n')
