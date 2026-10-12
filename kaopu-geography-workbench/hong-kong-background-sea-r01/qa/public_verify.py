"""Read-only, fixed-target HTTPS verification. Intended for the independent QA branch."""
from pathlib import Path
import urllib.request,hashlib,json,subprocess,sys,datetime
R=Path(__file__).resolve().parents[1]
url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/hong-kong-background-sea-r01/'
manifest=json.loads((R/'SOURCE_MANIFEST.json').read_text())
with urllib.request.urlopen(url,timeout=45) as response:
 data=response.read();status=response.status;final_url=response.url
assert status==200 and final_url==url
actual=hashlib.sha256(data).hexdigest()
assert actual==manifest['candidateSha256'],(actual,manifest['candidateSha256'])
with urllib.request.urlopen(url+'SOURCE_MANIFEST.json',timeout=45) as response:
 deployed_manifest=json.load(response)
assert deployed_manifest['candidateSha256']==actual
subprocess.run([sys.executable,str(R/'qa/browser_check.py'),url],check=True)
browser=json.loads((R/'qa/BROWSER_QA.json').read_text());assert browser['passed']
for c in browser['cases']:
 assert c['externalHttpRequests']==[url],c['externalHttpRequests']
result={'checkedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'status':status,'build':manifest['build'],'sha256':actual,'bytes':len(data),'browserPassed':browser['passed'],'externalRuntimeResources':0,'viewportLabels':['1280x800 software desktop','390x844 software mobile viewport; not a physical phone'],'physicalGpuVerified':False,'mapAssembled':False,'visualAcceptance':False,'productionReady':False,'passed':True}
(R/'qa/PUBLIC_QA.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
