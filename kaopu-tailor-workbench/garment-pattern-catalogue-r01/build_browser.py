from pathlib import Path
import zipfile,json,hashlib,gzip
from pattern_catalogue import parameterSchema,listStyles
ROOT=Path(__file__).parent
out=ROOT/'browser'
(out/'parameter-schema.json').write_text(json.dumps(parameterSchema(),ensure_ascii=False,separators=(',',':')))
(out/'styles.json').write_text(json.dumps(listStyles(),ensure_ascii=False,separators=(',',':')))
# Archive only generation code and pure-Python dependencies, no examples, body geometry, native renderer, or fixtures.
with zipfile.ZipFile(out/'pattern-runtime.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in (ROOT/'runtime').rglob('*'):
  if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc' and p.name!='MANIFEST.json':z.write(p,'runtime/'+str(p.relative_to(ROOT/'runtime')))
 z.write(ROOT/'pattern_catalogue.py','pattern_catalogue.py')
manifest={}
for p in (out/'vendor/pyodide').iterdir():
 if p.name.endswith('.gz'):
  orig=p.with_suffix('');manifest[orig.name]={'compressed':p.name,'bytes':p.stat().st_size,'decodedBytes':orig.stat().st_size,'sha256':hashlib.sha256(orig.read_bytes()).hexdigest()}
  if p.stat().st_size>11*1024*1024:
   data=p.read_bytes();parts=[]
   for i,start in enumerate(range(0,len(data),8*1024*1024)):
    piece=data[start:start+8*1024*1024];part=p.with_name(p.name+f'.part{i:03d}');part.write_bytes(piece);parts.append({'file':part.name,'bytes':len(piece),'sha256':hashlib.sha256(piece).hexdigest()})
   del manifest[orig.name]['compressed'];manifest[orig.name]['compressedParts']=parts
(out/'runtime-manifest.json').write_text(json.dumps({'pyodideVersion':'0.26.4','files':manifest,'patternArchive':{'file':'pattern-runtime.zip','bytes':(out/'pattern-runtime.zip').stat().st_size,'sha256':hashlib.sha256((out/'pattern-runtime.zip').read_bytes()).hexdigest()}},indent=2))
print('archive', (out/'pattern-runtime.zip').stat().st_size)
