import pathlib, json, gzip, struct, io, hashlib
import numpy as np
from PIL import Image

root=pathlib.Path(__file__).resolve().parents[1]
registry_bytes=(root/'data/r10/registry.json').read_bytes()
registry=json.loads(registry_bytes)
oldreg={i['id']:i for i in json.loads((root/'data/r07/registry.json').read_text(encoding='utf-8'))['items']}

def packet(filename):
    packed=(root/'data'/filename).read_bytes()
    raw=gzip.decompress(packed)
    n=struct.unpack_from('<I',raw,8)[0]
    start=((16+n+7)//8)*8
    return json.loads(raw[16:16+n]),raw[start:]

rows=[]
for item in registry['items']:
    if hashlib.sha256((root/'data'/item['file']).read_bytes()).hexdigest()!=item['sha256']:
        raise RuntimeError('Candidate changed after registry freeze: '+item['id'])
    product,blob=packet(item['file'])
    if item['id']=='barracuda':
        raw=gzip.decompress((root/'data/r07/barracuda.fbr7.gz').read_bytes())
        n=struct.unpack_from('<I',raw,8)[0]
        source=raw[((16+n+7)//8)*8:]
        s=struct.unpack_from('<I',source,8)[0]
        meta=json.loads(source[16:16+s])
        chunks={c['name']:source[16+s+c['offset']:16+s+c['offset']+c['bytes']] for c in meta['package']['chunks']}
        pairs=[(im,chunks[{'base':'baseColorJpeg','normal':'normalWebp','rm':'roughMetalJpeg'}[im['field']]]) for im in product['images']]
    else:
        original,original_blob=packet(oldreg[item['id']]['file'])
        old={im['texture']:original_blob[im['offset']:im['offset']+im['length']] for im in original['images']}
        pairs=[(im,old[im['texture']]) for im in product['images']]
    for im,original_bytes in pairs:
        encoded=blob[im['offset']:im['offset']+im['length']]
        before=np.asarray(Image.open(io.BytesIO(original_bytes)).convert('RGBA'),dtype=np.uint8)
        after=np.asarray(Image.open(io.BytesIO(encoded)).convert('RGBA'),dtype=np.uint8)
        if before.shape!=after.shape:raise RuntimeError('Image dimension mismatch')
        delta=np.abs(before.astype(np.int16)-after.astype(np.int16))
        visible=before[:,:,3]>0
        rgb=delta[:,:,:3][visible]
        mse=float(np.mean(rgb.astype(np.float64)**2))
        q=dict(id=item['id'],image=im.get('field',im.get('texture')),role=im['proof']['role'],shape=list(before.shape),psnr=float(10*np.log10(255**2/mse)) if mse else 999,maxChannelError=int(rgb.max()),alphaMaxError=int(delta[:,:,3].max()),visiblePixels=int(visible.sum()),over8Fraction=float(np.mean(np.max(rgb,axis=1)>8)),over32Fraction=float(np.mean(np.max(rgb,axis=1)>32)),over64Fraction=float(np.mean(np.max(rgb,axis=1)>64)),originalEncodedSha256=hashlib.sha256(original_bytes).hexdigest(),productEncodedSha256=hashlib.sha256(encoded).hexdigest())
        if q['role']=='normal':
            a=before[:,:,:3][visible].astype(np.float32)/127.5-1
            b=after[:,:,:3][visible].astype(np.float32)/127.5-1
            dot=np.sum(a*b,axis=1)/(np.linalg.norm(a,axis=1)*np.linalg.norm(b,axis=1))
            angles=np.rad2deg(np.arccos(np.clip(dot,-1,1)))
            q.update(normalAngleDegreesP99=float(np.percentile(angles,99)),normalAngleDegreesP999=float(np.percentile(angles,99.9)),normalAngleDegreesMax=float(angles.max()),normalOver10DegreesFraction=float(np.mean(angles>10)))
        q['alphaAndDimensionsPreserved']=q['alphaMaxError']==0
        rows.append(q)
        print(json.dumps({k:v for k,v in q.items() if 'Sha256' not in k}),flush=True)

fresh=registry_bytes==(root/'data/r10/registry.json').read_bytes() and all(hashlib.sha256((root/'data'/i['file']).read_bytes()).hexdigest()==i['sha256'] for i in registry['items'])
report=dict(schema='FISH_R10_INDEPENDENT_TEXTURE_ERROR_1',registrySha256=hashlib.sha256(registry_bytes).hexdigest(),fresh=fresh,method='Pillow independently decodes original and emitted product bytes; no resizing, editing or render substitution. Visible source alpha >0 mask excludes irrelevant transparent RGB. Normal angle compares decoded RGB vectors.',rows=rows,alphaAndDimensionsPreserved=all(r['alphaAndDimensionsPreserved'] for r in rows),limitations=['Metrics cover texture texels, not mapped fish-region UV pixel footprints; global PSNR does not prove visual fidelity.','Browser and Pillow JPEG/ICC decoder differences can cause small baseline-dependent errors.','No user visualAcceptance or productionReady is inferred.'],visualAcceptance=False,productionReady=False)
(root/'evidence/INDEPENDENT_R10_TEXTURE_ERRORS.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
if not fresh:raise RuntimeError('Texture verification frozen bytes changed during run')
