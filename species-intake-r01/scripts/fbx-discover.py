import hashlib, io, json, pathlib, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMP = ROOT / 'temporary' / 'fbx-intake'
TEMP.mkdir(parents=True, exist_ok=True)
records = []
seen = set()
def walk(data, chain, depth=0):
    if depth > 4: return
    digest = hashlib.sha256(data).hexdigest()
    if digest in seen: return
    seen.add(digest)
    try: z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile: return
    names = z.namelist()
    models = [n for n in names if n.lower().endswith('.fbx')]
    if models:
        target = TEMP / digest[:16]
        target.mkdir(exist_ok=True)
        # Preserve companion images and relative directory relationships; validate path containment.
        for info in z.infolist():
            if info.is_dir(): continue
            dest = (target / info.filename).resolve()
            if not dest.is_relative_to(target.resolve()): raise ValueError('Unsafe zip path')
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(z.read(info))
        for model in models:
            b = z.read(model)
            records.append({'archiveChain':chain, 'archiveSha256':digest, 'modelEntry':model,
                'modelSha256':hashlib.sha256(b).hexdigest(), 'modelBytes':len(b),
                'localAuditPath':str(target / model), 'companionEntries':names,
                'hasGltfAlternative':any(n.lower().endswith(('.gltf','.glb')) for n in names)})
    for n in names:
        if n.lower().endswith('.zip'): walk(z.read(n),chain+[n],depth+1)
for path in pathlib.Path('G:/Three.js/sea/FISH2').rglob('*.zip'):
    walk(path.read_bytes(),[str(path)])
# Outer bluefin textures must remain available for correspondence even when its nested FBX package differs.
bluefin = pathlib.Path('G:/Three.js/sea/FISH2/bluefin-tuna.zip')
with zipfile.ZipFile(bluefin) as z:
    for info in z.infolist():
        if info.filename.lower().endswith(('.png','.jpg','.jpeg')):
            p = TEMP / 'bluefin-outer' / info.filename
            p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(z.read(info))
(TEMP/'discovered.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps([{'model':r['modelEntry'],'bytes':r['modelBytes'],'sha':r['modelSha256'],'gltf':r['hasGltfAlternative'],'chain':r['archiveChain']} for r in records],ensure_ascii=True))
