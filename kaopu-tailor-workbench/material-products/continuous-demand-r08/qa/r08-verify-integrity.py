from pathlib import Path
import hashlib, json, re

root=Path(__file__).parent.parent
q=root/'qa'
manifest=json.loads((q/'r08-runtime-bytes.json').read_text(encoding='utf-8'))
folder=root/'releases/r08-ccccfd5ca9c1'
for item in manifest['files']:
    b=(folder/item['path']).read_bytes()
    assert len(b)==item['size']
    assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==item['gitSHA'],item['path']
collection=root.parent/'Human-Clothing-Workbench'
pointer=json.loads((q/'r08-aggregate-pointer.json').read_text(encoding='utf-8'))
before=(collection/pointer['backup']).read_bytes()
after=(collection/'服装鞋帽工作台.html').read_bytes()
oldLocal=b'../MP05-Continuous-Demand-R01/candidate-r07/?look=K03'
oldPublic=b'https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-temporal-r07-527117f28a68/?look=K03'
newLocal=pointer['localTarget'].encode()
prefix=after.find(b'const latestClothingURL=')
actualPublic=re.search(rb"\.href:([\"'])([^\"']+)\1;",after[prefix:prefix+1500])
assert actualPublic
newPublic=actualPublic[2]
assert before.count(oldLocal)==before.count(oldPublic)==after.count(newLocal)==after.count(newPublic)==1
normalizedBefore=before.replace(oldLocal,b'<ACTIVE_LOCAL_RUNTIME>').replace(b"'"+oldPublic+b"'",b'<ACTIVE_PUBLIC_RUNTIME>')
normalizedAfter=after.replace(newLocal,b'<ACTIVE_LOCAL_RUNTIME>').replace(actualPublic[1]+newPublic+actualPublic[1],b'<ACTIVE_PUBLIC_RUNTIME>')
assert normalizedBefore==normalizedAfter
pointer.update(afterSHA256=hashlib.sha256(after).hexdigest(),legacyPayloadUnchanged=True,
    fixedDenimPublicTarget='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp05-denim-r08-ccccfd5ca9c1/?look=D01',
    publicTarget=newPublic.decode(),publicFallbackMaintainedByConcurrentCharacterTask=True,
    normalizedPayloadSHA256=hashlib.sha256(normalizedAfter).hexdigest(),
    verification='Complete HTML byte comparison after normalizing only two active runtime URL strings and their quote delimiters; concurrent public character route retained')
(q/'r08-aggregate-pointer.json').write_text(json.dumps(pointer,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'runtimeTree':'ccccfd5ca9c16b7ac8b1650ec2e59889f9d6391c','filesVerified':len(manifest['files']),
    'localRuntime':str(folder),'collectionBytes':len(after),'legacyPayloadUnchanged':True,
    'collectionSHA256':pointer['afterSHA256'],'normalizedPayloadSHA256':pointer['normalizedPayloadSHA256']}
(q/'r08-final-integrity.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report))
