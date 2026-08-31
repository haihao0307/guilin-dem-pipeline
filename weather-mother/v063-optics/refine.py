"""Post-build synchronization fixes. No QA tolerance changes, no baseline writes."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parent
files={n:(R/n).read_text() for n in ['engine.js','field-worker.js']}
def rep(n,a,b):
 assert files[n].count(a)==1,(n,a[:90],files[n].count(a))
 files[n]=files[n].replace(a,b)
rep('field-worker.js','revision:c.revision,tau,shadowSize},','revision:c.revision,tau,shadowSize,sun:c.sun},')
rep('field-worker.js','self.postMessage({id:c.id,kind:c.kind,data:out,','self.postMessage({id:c.id,kind:c.kind,sun:c.sun,data:out,')
rep('field-worker.js',"if(c.case==='iridescent'){","if(c.case==='iridescent'&&c.kind==='Ac'){")
rep('field-worker.js',"}else if(c.case==='lenticular'){","}else if(c.case==='lenticular'&&c.kind==='Ac'){")
rep('field-worker.js',"}else if(c.case==='mackerel'){","}else if(c.case==='mackerel'&&c.kind==='Cc'){")
rep('engine.js','lightBusy=false,shadowSun=null;','lightBusy=false,shadowSun=null,uploadedShadowSun=null,shadowDataEpoch=0;')
rep('engine.js','lastShadowData=d.tau;lastData=d.data;', 'lastShadowData=d.tau;uploadedShadowSun=d.sun;shadowSun=d.sun;shadowDataEpoch++;qa.activeVolumeJob=d.id;lastData=d.data;')
rep('engine.js','if(pendingLight){const d=pendingLight;pendingLight=null;setShadow(shadowTex,d.tau,d.shadowSize);lastShadowData=d.tau;invalidate();}', 'if(pendingLight){const d=pendingLight;pendingLight=null;setShadow(shadowTex,d.tau,d.shadowSize);lastShadowData=d.tau;uploadedShadowSun=d.sun;shadowDataEpoch++;qa.shadowUploadedRevision=d.revision;invalidate();}')
rep('engine.js','qa.currentHour=state.hour;', 'qa.currentHour=state.hour;qa.renderedShadowEpoch=shadowDataEpoch;qa.shadowPending=lightBusy||!!pendingLight;qa.shadowDirectionError=uploadedShadowSun?Math.hypot(...solar(state.hour).map((v,k)=>v-uploadedShadowSun[k])):null;')
rep('engine.js','window.WeatherMother={qa,setWeather,setKind,', '''window.WeatherMother={qa,getReadiness:()=>({pendingVolume:!!pending||qa.activeVolumeJob!==job,pendingLight:lightBusy||!!pendingLight,shadowEpoch:shadowDataEpoch,renderedShadowEpoch:qa.renderedShadowEpoch,shadowDirectionError:uploadedShadowSun?Math.hypot(...solar(state.hour).map((v,k)=>v-uploadedShadowSun[k])):null,hour:state.hour,targetHour:target.hour,blend}),setWeather,setKind,''')
for n,s in files.items():(R/n).write_text(s)
m=json.loads((R/'MANIFEST.json').read_text())
for n in m['files']:
 b=(R/n).read_bytes();m['files'][n]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
m['totalRuntimeBytes']=sum(v['bytes'] for v in m['files'].values());m['revision']=2;m['lightCacheReadiness']='request direction, uploaded direction and rendered cache epoch explicitly observable'
(R/'MANIFEST.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
print('Refined runtime',m['totalRuntimeBytes'],'bytes')
