"""Extract exact functions from the already Naga-compiled, verified heritage B material.
No source function is rewritten. Re-running requires the local source snapshot.
"""
from pathlib import Path
import re,hashlib,json
root=Path(__file__).resolve().parent
source=Path('hong-kong-map-sea-r04/station-integration/qa/reference/probe.frag')
s=source.read_text()
func={}
for m in re.finditer(r'^([\w]+)\s+(\w+)\([^\n]*\)\s*\{',s,re.M):
    start=m.start(); j=m.end(); level=1
    while level:
        level += (s[j]=='{')-(s[j]=='}'); j+=1
    func[m[2]]=(start,s[start:j])
roots=['kpBrickOriginalSurface','kpBrickBaseDistance','kpPlasterOriginalField','kpConcreteStation']
keep=set()
def walk(n):
    if n in keep:return
    keep.add(n)
    for dep in re.findall(r'\b(\w+)\s*\(',func[n][1]):
        if dep in func and dep!=n:walk(dep)
for n in roots:walk(n)
structs=[]
for n in ['KpSurface','KpPlasterParams','KpPlasterField']:
    structs.append(re.search(r'struct '+n+r' \{.*?\};',s,re.S)[0])
constants=re.findall(r'^const .*?;',s,re.M)
body='\n\n'.join(structs+constants+[func[n][1] for n in sorted(keep,key=lambda n:func[n][0])])
(root/'mothers/kaopu-original.glsl').write_text('// Exact function closure, heritage B / Naga 27.0.3. See provenance/material-sources.json\n'+body+'\n')
sha=lambda x:hashlib.sha256(x).hexdigest()
receipt={'schema':'kaopu.hk-three-buildings.material-source/1','sourceCommit':'1f46ba78170752a07086caa3e66c87f2fa4c7fcf','sourceLocalPath':str(source),'sourceSha256':sha(s.encode()),'sourceNagaVersion':'27.0.3','functionCount':len(keep),'roots':roots,'functions':{n:sha(func[n][1].encode()) for n in sorted(keep)},'extractedSha256':sha((root/'mothers/kaopu-original.glsl').read_bytes()),'unchangedFunctionBodies':True,'priorVerification':{'gpuSamples':93,'brickIdentitySamples':66,'scope':'Prior finite heritage B sampling, not this receiver or visual acceptance'},'receiverChanges':['New measured-mesh metric tangent bridge','Shared staggered row/column for brick identity and coordinates; no depth in seed','Approximate footprint filtering and far-field mean, not an exact area integral','Height affects shading normals only; measured geometry is never displaced','New gravity-oriented drainage mask is a creative receiver, not measured dampness','Optional facade windows are authored color/roughness only, not measured openings']}
(root/'provenance/material-sources.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'functions':len(keep),'bytes':len(body),'sha256':receipt['extractedSha256']}))
