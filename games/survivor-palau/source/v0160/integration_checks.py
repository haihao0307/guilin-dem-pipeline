"""Source-authored integration hardening. Keeps the frozen renderer unchanged."""
from pathlib import Path
import hashlib,json,re,subprocess
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'releases/v0.1.6.0'
p=OUT/'Stone_Money_Island_V0.1.6.0_Direct_Open.html'
s=p.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a[:90],s.count(a))
 s=s.replace(a,b)
rep('function frame(now){\n requestAnimationFrame(frame);', '''let smiGpuFence=null,smiReviewHold=false,smiReviewRequest=null,smiCompletedAt=0;
function frame(now){
 requestAnimationFrame(frame);
 if(smiGpuFence){
  const status=gl.clientWaitSync(smiGpuFence,0,0);
  if(status===gl.TIMEOUT_EXPIRED)return;
  if(status===gl.WAIT_FAILED){qa.errors.push('GPU completion wait failed');return;}
  gl.deleteSync(smiGpuFence);smiGpuFence=null;qa.completedFrames=(qa.completedFrames||0)+1;
  if(smiCompletedAt)qa.completedFrameMs=now-smiCompletedAt;smiCompletedAt=now;
  if(smiReviewRequest){smiReviewHold=true;const done=smiReviewRequest;smiReviewRequest=null;done(true);}
 }
 if(smiReviewHold||qa.errors.length)return;''')
rep('frameCount++;qa.frames++;qa.physicalTime=physicalTime;', 'smiGpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();\n frameCount++;qa.frames++;qa.physicalTime=physicalTime;')
rep('const api={qa,getState:', '''const api={qa,holdForReview:()=>new Promise(resolve=>{if(smiReviewHold){resolve(true);return;}smiReviewRequest=resolve;opaqueDirty=true;}),resumeFromReview:()=>{smiReviewHold=false;lastFrame=performance.now();},getState:''')
# Correct obsolete interface strings without pretending that fishing is implemented.
s=s.replace(' · 钓点 ${CANOE_STATE.targetDistance.toFixed(0)} m',' · 外海 ${CANOE_STATE.targetDistance.toFixed(0)} m')
p.write_text(s)
for i,js in enumerate(re.findall(r'<script[^>]*>([\s\S]*?)</script>',s)):
 q=OUT/f'.harden-check-{i}.mjs';q.write_text(js);subprocess.run(['node','--check',str(q)],check=True);q.unlink()
r=OUT/'BUILD_RECEIPT.json';receipt=json.loads(r.read_text());receipt.update(entrySha256=hashlib.sha256(s.encode()).hexdigest(),entryBytes=len(s.encode()),boundedGPUQueue=True,originalShaderChanges=0,originalDefaultValueChanges=0,browserPassed=False,publicHttpsPassed=False,shareAllowed=False)
r.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print('Bounded GPU submission and completion-based review hook installed')
