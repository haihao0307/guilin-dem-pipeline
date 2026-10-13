"""Read frozen native L03 assets; emit a new, isolated foundation site."""
from pathlib import Path
import json, gzip, hashlib, struct, shutil, os
p=Path(__file__).resolve().parent
old=Path(os.environ.get('HAIR_L03',p.parent.parent/'fusion/r14-l03'))
site=p/'site';site.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
m=json.loads((old/'ASSET_MANIFEST.json').read_text())
a=m['assets']['core'];parts=[]
for chunk in a['chunks']:
 b=(old/'site'/chunk['path']).read_bytes();assert sha(b)==chunk['sha256'];parts.append(b)
b=gzip.decompress(b''.join(parts));assert sha(b)==a['sha256']
hl=struct.unpack_from('<I',b,8)[0];header=json.loads(b[12:12+hl]);sec={}
for s in header['sections']:
 code={'float32':'f','uint16':'H','uint8':'B','int32':'i'}[s['dtype']]
 sec[s['name']]=list(struct.unpack('<'+code*(s['byteLength']//struct.calcsize(code)),b[12+hl+s['offset']:12+hl+s['offset']+s['byteLength']]))
head={'positions':sec['template'],'triangles':sec['triangles'],'components':sec['component_id'],'units':'metre','axes':'Y-up/Z-front',
 'topology':'d79ab67c6e6f5e361a4adbaf484190a00ccce33b77ca82f780de4e2816d27685','source':'8b7d8453055b9c8a0f146d175370bc7e14ecc4ac'}
raw=json.dumps(head,separators=(',',':')).encode();(p/'head.json').write_bytes(raw);(site/'head.json.gz').write_bytes(gzip.compress(raw,mtime=0))
for f in (p/'src').glob('*.mjs'):shutil.copy2(f,site/f.name)
shutil.copy2(old/'vendor/three.module.js',site/'three.module.js')
shutil.copytree(old/'licenses',site/'licenses',dirs_exist_ok=True)
shutil.copy2(p/'index.html',site/'index.html')
manifest={'version':'F01','source':os.environ.get('GITHUB_SHA','local-candidate'),'nativeL03':'c89ebc4da8d24ef3decfad85336c5dffb2c471c8','nativeCoreSHA256':a['sha256'],'headSHA256':sha(raw),'nativeVertices':len(sec['template'])//3,'nativeTriangles':len(sec['triangles'])//3,'oldPathsModified':False,'files':{}}
for f in sorted(site.rglob('*')):
 if f.is_file() and f.name!='BUILD_MANIFEST.json':manifest['files'][str(f.relative_to(site))]={'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())}
(p/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2));(site/'BUILD_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
print('native head prepared:',len(sec['template'])//3,'vertices;',len(raw),'JSON bytes')
