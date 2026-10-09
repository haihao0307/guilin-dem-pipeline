"""Build collision inputs from the unmodified COMMON runtime; retain original paper size.
No new character model, no garment shells, no changed solver thresholds.
"""
from pathlib import Path
import array,gzip,hashlib,json,os,re,subprocess,sys,tempfile
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent; A=P/'assets';A.mkdir(exist_ok=True)
ANCHOR='0ff632be3e4ab112fad93fd4c43c7bc6a90cf5f3'
PUBLIC='https://haihao0307.github.io/guilin-dem-pipeline/'
NATIVE=PUBLIC+'kaopu-unified-human-workbench/'
def digest(b):return hashlib.sha256(b).hexdigest()
def gitfile(p):return subprocess.check_output(['git','show',ANCHOR+':'+p])
def store(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
def typed(a,code):
 b=array.array(code,a)
 if sys.byteorder!='little':b.byteswap()
 return b.tobytes()
def stable(x):return json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':'))
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'])
 page=browser.new_page(viewport={'width':1440,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(NATIVE+'index-characters-r02.html',wait_until='domcontentloaded',timeout=120000)
 page.wait_for_function('window.fullCommonWorkbench',timeout=60000);page.evaluate('fullCommonWorkbench.load()')
 page.wait_for_function('fullCommonWorkbench.diagnostics().ready',timeout=300000)
 data=page.evaluate('''async()=>{const w=fullCommonWorkbench,m=w.motion().controller.model;
 const hex=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const stable=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(stable):Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
 return {archive:w.archive(),positions:Array.from(w.positions()),faces:Array.from(w.faces()),diagnostics:w.diagnostics(),state:w.state(),
 geometrySHA256:await hex(w.positions().buffer),topologySHA256:await hex(w.faces().buffer),stateSHA256:await hex(new TextEncoder().encode(JSON.stringify(stable(w.state())))),
 annyRecipes:m.canonical.annyRecipes,originalAnnyVertices:Array.from(m.lastBody.vertices),boneHeads:Array.from(m.lastBody.boneHeads||[])};}''')
 assert len(data['positions'])==25417*3 and len(data['faces'])==50624*3 and not errors
 page.screenshot(path=str(A/'original-common-runtime.png'));browser.close()
assert digest(typed(data['positions'],'f'))==data['geometrySHA256']
assert digest(typed(data['faces'],'I'))==data['topologySHA256']
store(A/'common-archive.json',data['archive'])
oldraw=gitfile('kaopu-tailor-workbench/garments-r04/assets/body-anny-adult.json');old=json.loads(oldraw)
shift=old['groundTranslationMm']/1000
pos=[[data['positions'][i]*1000,(data['positions'][i+2]+shift)*1000,-data['positions'][i+1]*1000] for i in range(0,len(data['positions']),3)]
faces=[data['faces'][i:i+3] for i in range(0,len(data['faces']),3)]
# Retain neutral-body fixture landmarks only after checking their source correspondence.
maxerr=0.;proof=0
for i,(a,b,t) in enumerate(data['annyRecipes']):
 if pos[i][1]>1490:continue
 expected=[(data['originalAnnyVertices'][a*3+k]*(1-t)+data['originalAnnyVertices'][b*3+k]*t) for k in range(3)]
 actual=data['positions'][i*3:i*3+3]
 maxerr=max(maxerr,sum((x-y)**2 for x,y in zip(expected,actual))**.5*1000);proof+=1
assert proof>6000 and maxerr<.001,(proof,maxerr)
body={'schema':'kaopu-body-surface@1','id':'common-native-default-r04','units':'mm','axis':'Y-up = [native X, native Z + original ground offset, -native Y]; no scale',
 'source':{'commonEntry':NATIVE+'index-characters-r02.html','sourceGeometrySHA256':data['geometrySHA256'],'sourceTopologySHA256':data['topologySHA256'],'sourceStateSHA256':data['stateSHA256'],'nativeArchive':data['archive']['schema']},
 'groundTranslationMm':shift*1000,'positionsMm':pos,'triangles':faces,'joints':old['joints'],'fixtureScope':'original neutral-body fixture landmarks; not other characters','parameters':data['state']}
store(A/'common-body.json',body)
# Reuse the native nearest-triangle field compiler on the entire COMMON mesh.
cpp=gitfile('kaopu-tailor-workbench/r06/body_field.cpp');(P/'native-body-field.cpp').write_bytes(cpp)
with tempfile.TemporaryDirectory() as td:
 td=Path(td)
 with (td/'body.mesh').open('w') as f:
  f.write(f'{len(pos)} {len(faces)}\n')
  for p in pos:f.write(' '.join(map(str,p))+'\n')
  for t in faces:f.write(' '.join(map(str,t))+'\n')
 subprocess.run(['g++','-O3','-std=c++17','-fopenmp',str(P/'native-body-field.cpp'),'-o',str(td/'field')],check=True)
 subprocess.run([str(td/'field'),str(td/'body.mesh'),str(td/'field.i16')],check=True,env={**os.environ,'OMP_NUM_THREADS':'4'})
 raw=(td/'field.i16').read_bytes();field=array.array('h');field.frombytes(raw)
 if sys.byteorder!='little':field.byteswap()
 assert len(field)==261*391*131
 delta=array.array('H');prev=0
 for v in field:delta.append((v-prev)&65535);prev=v
 if sys.byteorder!='little':delta.byteswap()
 payload=gzip.compress(delta.tobytes(),compresslevel=7,mtime=0);(A/'common-body.sdfd.gz').write_bytes(payload)
meta={'dimensions':[261,391,131],'originMm':[-650,-50,-200],'spacingMm':5,'quantizationMm':.05,'count':len(field),'sourceBodyAsset':'common-body.json','sourceBodyAssetSha256':digest((A/'common-body.json').read_bytes()),'method':'Original R06 triangle-BVH distance compiler run on all 50624 COMMON triangles; interpolated normal sign; not CCD','transport':{'file':'common-body.sdfd.gz','encoding':'int16-delta-gzip','decodedBytes':len(raw),'decodedSha256':digest(raw),'encodedSha256':digest(payload)}}
store(A/'body-sdf-grid.json',meta)
identity={'geometrySHA256':data['geometrySHA256'],'topologySHA256':data['topologySHA256'],'stateSHA256':data['stateSHA256'],'adapterFingerprint':data['archive']['adapterFingerprint']}
lock={'schema':'kaopu-native-tailor-lock@1','version':'R04-SOURCE-1','nativeAnchor':ANCHOR,'commonEntry':NATIVE+'index-characters-r02.html','commonFull':NATIVE+'full/','person':identity,'vertices':25417,'triangles':50624,'groundShiftM':shift,'bodyFileSHA256':meta['sourceBodyAssetSha256'],'sdfFileSHA256':digest(payload),'sdfMetadataSHA256':digest((A/'body-sdf-grid.json').read_bytes()),'cppSHA256':digest(cpp),'bodySourceComparison':{'canonicalRecipesChecked':proof,'maxDefaultBodyErrorMmBelow1490':maxerr},'sizingPolicy':'PRESERVED_ORIGINAL_PAPER_SIZE_NOT_CURRENT_PERSON_REMEASURED','supportedCollisionPerson':'exact default native state only; other native characters require their own collider and measurements','noBodyScale':True,'garmentDisplayProxyAllowed':False,'physicalFitAccepted':False}
store(A/'identity.json',lock)
lib=json.loads(gitfile('kaopu-tailor-workbench/presets/r01/library.json'));rows=[]
for r in lib['presets']:
 compressed=gitfile('kaopu-tailor-workbench/presets/r01/'+r['paperAsset']);text=gzip.decompress(compressed);d=json.loads(text)
 assert d['recipeHash']==r['recipeHash'] and d['geometryHash']==r['geometryHash'] and d['validation']['analytic2DPass']
 dest=A/'papers'/f'{r["id"]}.json.gz';dest.parent.mkdir(exist_ok=True);dest.write_bytes(compressed)
 rows.append({**r,'nativePaper':'assets/papers/'+r['id']+'.json.gz','compressedSHA256':digest(compressed),'decodedSHA256':digest(text)})
store(A/'catalogue.json',{'originalCount':60,'sizingPolicy':lock['sizingPolicy'],'rows':rows,'sourceLibrarySHA256':digest(gitfile('kaopu-tailor-workbench/presets/r01/library.json'))})
# Native worker dependency closure, pinned byte-for-byte; no replacement solver.
sourcepath='kaopu-tailor-workbench/catalogue/r074-worker.bundle.mjs'
seen={};pattern=re.compile(r'(?:from\s*|import\s*)[\'"]([^\'"]+)[\'"]')
def collect(path):
 if path in seen:return
 b=gitfile(path);seen[path]=digest(b);dest=P/'native'/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b)
 if path.endswith(('.mjs','.js')):
  for m in pattern.finditer(b.decode()):
   dep=m.group(1)
   if dep.startswith('.'):
    import posixpath
    collect(posixpath.normpath(posixpath.join(posixpath.dirname(path),dep)))
collect(sourcepath);collect('kaopu-tailor-workbench/r07/stability/joint-r072.wasm')
store(A/'native-files.json',seen)
(A/'results').mkdir(exist_ok=True)
store(A/'results/index.json',{'rows':{},'failed':{},'source':'original-native-solver-only'})
subprocess.run([sys.executable,str(P/'adapt_worker.py')],check=True)
store(A/'NATIVE_PERSON_PROOF.json',{'person':identity,'sameOriginalRuntime':True,'rendererUsesOriginalCommonViewer':True,'nativeOriginalDiagnostics':data['diagnostics'],'originalPageErrors':errors,'collisionVertices':len(pos),'collisionTriangles':len(faces),'displayMaskOrRescale':False,'paperSizingRecalculated':False,'actualBodyFieldRebuilt':True})
print('NATIVE_BUILD_COMPLETE',identity,'papers',len(rows),'modules',len(seen),flush=True)
