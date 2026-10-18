from pathlib import Path
import hashlib,json
p=Path(__file__).resolve().parent
old=(p/'original-recovery-reference.mjs').read_text();new=(p/'original-recovery-loading.mjs').read_text()
assert hashlib.sha256(old.encode()).hexdigest()=='a91009bd383e2e1b0babcaf233c00aa7c42b436ab91f0e28fe59ed11d8c31d16'
assert old[old.index(' const nodes='):]==new[new.index(' const nodes='):], 'Source node, primitive, materials, hierarchy, animation or transforms changed'
for x in ["g=structuredClone(c.displaySkeleton)","g.bufferViews=c.fields.map(f=>({buffer:0,byteOffset:f.byteOffset,byteLength:f.byteLength}))","g.accessors=c.fields.map((f,i)=>({...f.definition,bufferView:i,byteOffset:0}))","SOURCE_PAYLOAD_HASH_MISMATCH","SOURCE_FIELD_HASH_MISMATCH","SOURCE_IMAGE_HASH_MISMATCH","SOURCE_OBJECT_HASH_MISMATCH"]:assert x in new,x
assert 'imageURLs.push(URL.createObjectURL(new Blob([b])))'in new
assert "g.images=(c.images||[]).map((img,i)=>({...img.definition,uri:imageURLs[i]}))"in new
r={'status':'PASS','originalRestorerSHA256':hashlib.sha256(old.encode()).hexdigest(),'sourceNodePrimitiveMaterialHierarchyAnimationTransformCodeByteIdentical':True,'allOriginalHashesStillRequired':True,'images':'same verified bytes used through temporary Blob URLs; redundant second network fetch removed','changed':'transport progress/timeouts/serial retry, gzip detection, verified image byte reuse, stage reporting/deadline','modelGeometryOrMaterialGenerated':False};(p/'SOURCE_SEMANTICS_REPORT.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
