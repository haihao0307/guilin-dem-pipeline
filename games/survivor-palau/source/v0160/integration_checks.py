"""Source-authored integration hardening. Frozen renderer is not edited."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'releases/v0.1.6.0';p=OUT/'Stone_Money_Island_V0.1.6.0_Direct_Open.html';s=p.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:90],s.count(a));s=s.replace(a,b)
rep('function frame(now){\n requestAnimationFrame(frame);', '''let smiGpuFence=null,smiReviewHold=false,smiReviewRequest=null,smiReviewTarget=0,smiCompletedAt=0;
function frame(now){
 requestAnimationFrame(frame);
 if(smiGpuFence){
  const status=gl.clientWaitSync(smiGpuFence,0,0);
  if(status===gl.TIMEOUT_EXPIRED)return;
  if(status===gl.WAIT_FAILED){qa.errors.push('GPU completion wait failed');return;}
  gl.deleteSync(smiGpuFence);smiGpuFence=null;qa.completedFrames=(qa.completedFrames||0)+1;
  if(smiCompletedAt)qa.completedFrameMs=now-smiCompletedAt;smiCompletedAt=now;
  if(smiReviewRequest&&qa.completedFrames>=smiReviewTarget){smiReviewHold=true;const done=smiReviewRequest;smiReviewRequest=null;done(true);}
 }
 if(smiReviewHold||qa.errors.length)return;''')
rep('frameCount++;qa.frames++;qa.physicalTime=physicalTime;','smiGpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();\n frameCount++;qa.frames++;qa.physicalTime=physicalTime;')
rep('const api={qa,getState:', '''const api={qa,holdForReview:()=>new Promise(resolve=>{if(smiReviewHold){resolve(true);return;}smiReviewTarget=qa.frames+1;smiReviewRequest=resolve;opaqueDirty=true;}),resumeFromReview:()=>{smiReviewHold=false;smiReviewRequest=null;lastFrame=performance.now();},getState:''')
# Camera composition changes do not alter clouds, sea materials or their parameters.
rep('overview:{target:[0,6.5,0],yaw:incomingYaw+.34,pitch:.37,distance:r*6.15}', 'overview:{target:[0,6.5,0],yaw:.48,pitch:.12,distance:r*7.2}')
rep('deepfish:{target:[DEEP_FISH_POS[0],waterLevel(physicalTime,config)+.18,DEEP_FISH_POS[2]],yaw:2.12,pitch:.10,distance:72}', 'deepfish:{target:[DEEP_FISH_POS[0],.18,DEEP_FISH_POS[2]],yaw:.48,pitch:.055,distance:160}')
rep('v.distance*=1.05;v.yaw=incomingYaw+.28;v.fov=63*Math.PI/180;', 'v.distance*=1.05;v.yaw=.48;v.fov=63*Math.PI/180;')
s=s.replace(' · 钓点 ${CANOE_STATE.targetDistance.toFixed(0)} m',' · 外海 ${CANOE_STATE.targetDistance.toFixed(0)} m').replace('参数 · 3 页','设置').replace('石钱岛 · 原版海天接回 / V0.1.6.0','1944 · 帕劳')
css='''
/* Clear inherited top before docking the same element at bottom. */
#cameraBar{top:auto!important;bottom:82px!important;height:44px!important;min-height:0!important;max-height:44px!important;width:max-content!important;align-items:center!important;border-radius:18px!important;box-sizing:border-box!important;background:rgba(12,35,43,.55)!important;box-shadow:none!important;backdrop-filter:none!important;padding:3px!important}
#cameraBar button{height:36px!important;min-height:36px!important;padding:5px 13px!important;flex:0 0 auto!important;border-radius:14px!important;color:#f4fff9!important}
#cameraBar button:not([data-view="overview"]):not([data-view="shore"]):not([data-view="canoe"]):not([data-view="deepfish"]){display:none!important}
@media(max-width:760px){#cameraBar{left:50%!important;right:auto!important;transform:translateX(-50%)!important;max-width:calc(100vw - 24px)!important;bottom:78px!important}#cameraBar button{font-size:10px!important;padding:5px 10px!important}.brand small{font-size:10px!important}}
'''
s=s.replace('</style>',css+'\n</style>',1);p.write_text(s)
for i,js in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 q=OUT/f'.harden-check-{i}.mjs';q.write_text(js);subprocess.run(['node','--check',str(q)],check=True);q.unlink()
r=OUT/'BUILD_RECEIPT.json';receipt=json.loads(r.read_text());receipt.update(entrySha256=hashlib.sha256(s.encode()).hexdigest(),entryBytes=len(s.encode()),boundedGPUQueue=True,originalShaderChanges=0,originalDefaultValueChanges=0,cameraDockHeightPx=44,browserPassed=False,publicHttpsPassed=False,shareAllowed=False)
r.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');print('Bounded GPU submission, exact-view review and non-obstructing dock installed')
