"""UI transport handshake only; no native numerical or acceptance changes."""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'app.mjs';s=f.read_text()
old="$('pause').onclick=()=>worker?.postMessage({type:'pause',requestId:serial});$('resume').onclick=()=>worker?.postMessage({type:'resume',requestId:serial});"
new="$('pause').onclick=()=>{if(phase!=='solving'||!worker)return;phase='pausing';controls();worker.postMessage({type:'pause',requestId:serial});};$('resume').onclick=()=>{if(phase!=='paused'||!worker)return;phase='resuming';controls();worker.postMessage({type:'resume',requestId:serial});};"
if old in s:s=s.replace(old,new)
else:assert new in s
s=s.replace("['meshing','solving','auditing','paused'].includes(phase)","['meshing','solving','auditing','paused','pausing','resuming'].includes(phase)")
s=s.replace("['meshing','solving','auditing'].includes(phase)","['meshing','solving','auditing','pausing','resuming'].includes(phase)")
s=s.replace("paused:'计算状态已保存',blocked:","paused:'计算状态已保存',pausing:'等待求解器暂停确认',resuming:'等待求解器继续确认',blocked:")
f.write_text(s)
print('PAUSE_RESUME_REQUESTS_SERIALIZED')
