from pathlib import Path
import json,hashlib,urllib.request
P=Path(__file__).resolve().parents[1];pub=json.loads((P/'PUBLICATION.json').read_text(encoding='utf-8'));results=[]
for style in ['medium','long']:
 url=pub['previewURLs'][style].split('?',1)[1];request=urllib.request.Request(url,headers={'User-Agent':'Codex-Hair-Public-Verification'});data=urllib.request.urlopen(request,timeout=50).read();digest=hashlib.sha256(data).hexdigest();assert digest==pub['htmlHashes'][style];results.append({'style':style,'rawURL':url,'sha256':digest,'bytes':len(data)})
(P/'qa/public-hash.json').write_text(json.dumps({'passed':True,'commit':pub['commit'],'results':results},indent=2),encoding='utf-8');print('Both published HTML hashes match the tested files')
