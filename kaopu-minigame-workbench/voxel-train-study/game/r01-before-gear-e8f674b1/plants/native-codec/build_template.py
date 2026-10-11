#!/usr/bin/env python3
"""Build the fixed, experimental plant SQLite envelope from verified local pins.
No dependency hash is fabricated or silently updated. No mesh/pixels enter recipe.
The physical BLOB-fragment approach is adapted from FH88 native codec R04.
"""
from pathlib import Path
import argparse, base64, hashlib, json, os, re, sqlite3, struct

HERE = Path(__file__).resolve().parent
PROFILE = 'kaopu.functional-plant-musa/0.1-experimental'
OPERATOR = 'PLANT_FUNCTION_MUSA_R04'
RULE_SET = 'native-tropical78-musa'
RELEASE_ID = 'native-tropical78-musa-r04-worker'
AUDITED_CLOSURE_SHA256 = '50e4e4c3393417704f95be660c20e6bf15f7efe715ea8b8074a090e7003cd706'
AUDITED_PROOF_SHA256 = 'ee491375feb401a3ee70193a0152ec40af0a119c750a7292f1a3976358dc0516'
SOURCE_HEAD = 'd5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122'
APP = 0x4B505531
CAPACITY = 32768
PLANT_PROFILE = {'profileVersion':8,'tropicalLibraryVersion':76,'productionSystemVersion':78,
    'leafNaturalismVersion':73,'treeLeafVersion':75,'condition76':'normal','reproductive76':False,
    'species':'musa-balbisiana','seed':761014,'stage':'establishing','habitatForm':'sheltered','material':'wild-reference'}
# Reviewed native proof values: repinning an edited proof cannot broaden this scope.
EXPECTED_RESOURCES = [{'id': 'support/albedo',
  'width': 64,
  'height': 64,
  'colorSpace': 'srgb',
  'bytes': 16384,
  'sha256': 'c2a94fb7e50f0fcb938af0b301d9f2eccb66ceecd79bab2ab1ef2aae1af17704',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/support/albedo'}},
 {'id': 'support/normal',
  'width': 64,
  'height': 64,
  'colorSpace': 'linear',
  'bytes': 16384,
  'sha256': 'a4a324dee1841fbbf58d6d5011467846ebb2bd965b58a08d17b6562425372236',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/support/normal'}},
 {'id': 'support/roughness',
  'width': 64,
  'height': 64,
  'colorSpace': 'linear',
  'bytes': 16384,
  'sha256': '827b7e2bc48aa0eca653745d83823da9a9416c12b980d7c5c899c424018e9877',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/support/roughness'}},
 {'id': 'foliage/albedo',
  'width': 256,
  'height': 256,
  'colorSpace': 'srgb',
  'bytes': 262144,
  'sha256': '0eba27253572a703667b6ea49746c06fc6ac4ca982e155c78e998756938b7fb2',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/foliage/albedo'}},
 {'id': 'foliage/normal',
  'width': 256,
  'height': 256,
  'colorSpace': 'linear',
  'bytes': 262144,
  'sha256': '2cfa3141b99f85323a480aa548c4256b904a2326883fcfe190c4e3d913e8ac80',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/foliage/normal'}},
 {'id': 'foliage/roughness',
  'width': 256,
  'height': 256,
  'colorSpace': 'linear',
  'bytes': 262144,
  'sha256': '03e0c73c1c219c1b1b4ca980c8cff25a4eff514be4a21141143380d63cedd813',
  'source': {'kind': 'procedural',
             'license': 'CC0-1.0',
             'generator': 'tropical-library-76/musa-balbisiana/foliage/roughness'}}]
RESOURCE_IDS = [r['id'] for r in EXPECTED_RESOURCES]
sha = lambda b: hashlib.sha256(b).hexdigest()
canonical = lambda x: json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False,allow_nan=False)

def require(condition, message):
    if not condition: raise ValueError(message)

def unique_pairs(items):
    out = {}
    for k,v in items:
        require(k not in out and k not in ('__proto__','prototype','constructor'), 'duplicate/prototype JSON key')
        out[k] = v
    return out

def read_json(raw):
    return json.loads(raw,object_pairs_hook=unique_pairs,parse_constant=lambda x: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))

def keys(obj, expected, label):
    require(isinstance(obj,dict) and set(obj) == set(expected), 'Unexpected keys: '+label)

def hash_format(value):
    require(isinstance(value,str) and re.fullmatch('[0-9a-f]{64}',value) and len(set(value))>1, 'Real SHA256 pin required')

def pinned_file(pin, base, limit=32*1024*1024):
    hash_format(pin['sha256'])
    path = pin['localPath']
    require(isinstance(path,str) and path and '://' not in path and not path.startswith('data:'), 'Local artifact path required')
    path = Path(path)
    if not path.is_absolute(): path = base/path
    require(path.is_file(), 'Missing pinned artifact: '+str(path))
    require(0 < path.stat().st_size <= limit, 'Artifact size limit: '+str(path))
    raw = path.read_bytes()
    require(sha(raw)==pin['sha256'], 'Artifact SHA256 mismatch: '+str(path))
    return raw

def graph_digest(db):
    digest=hashlib.sha256()
    for table in ('records','links','fields'):
        digest.update(table.encode('ascii'))
        for row in db.execute(f'SELECT * FROM {table} ORDER BY 1'):
            for item in row:
                if item is None: tag,raw=b'n',b''
                elif isinstance(item,bytes): tag,raw=b'b',item
                elif isinstance(item,int): tag,raw=b'i',struct.pack('<q',item)
                else: tag,raw=b's',str(item).encode('utf-8')
                digest.update(tag+struct.pack('<Q',len(raw))+raw)
    return digest.hexdigest()

def safe_source_path(root, relative):
    require(isinstance(relative,str) and relative and '\\' not in relative and ':' not in relative, 'Relative closure input path required')
    path=Path(relative)
    require(not path.is_absolute() and '..' not in path.parts and '.' not in path.parts, 'Closure input path escapes root')
    full=(root/path).resolve()
    require(full.is_relative_to(root), 'Closure input symlink escapes root')
    require(full.is_file(), 'Missing closure input: '+str(full))
    return full

def resolve_source_root(value, base):
    require(isinstance(value,str) and value and '://' not in value, 'Local source root required')
    if value.startswith('@env:'):
        name=value[5:]
        require(bool(re.fullmatch('KAOPU_NATIVE_[A-Z_]+',name)), 'Invalid source root environment variable')
        value=os.environ.get(name)
        require(isinstance(value,str) and bool(value), 'Missing source root environment variable: '+name)
        require('://' not in value, 'Local source root required')
    root=Path(value)
    if not root.is_absolute(): root=base/root
    return root.resolve()

def verify_source_closure(closure, roots, base):
    keys(closure,['sourceHead','esbuildVersion','threePeer','bundle','inputCount','inputs'],'source closure')
    require(closure['sourceHead']==SOURCE_HEAD, 'Source closure revision mismatch')
    require(closure['esbuildVersion']=='0.25.10' and closure['threePeer']=='0.179.1', 'Unknown source build tools')
    require(isinstance(closure['inputs'],list) and closure['inputs'] and len(closure['inputs'])==closure['inputCount']==92, 'Source closure input count mismatch')
    keys(roots,['canonical','adapter','npm-three-0.179.1','transformed'],'source roots')
    resolved={}
    for name,value in roots.items():
        root=resolve_source_root(value,base)
        require(root.is_dir(), 'Missing source root: '+name)
        resolved[name]=root
    seen=set()
    for item in closure['inputs']:
        expected=['path','source','bytes','sha256']
        if 'transform' in item: expected+=['transform','transformedSha256']
        keys(item,expected,'closure input')
        require(item['source'] in ['canonical','adapter','npm-three-0.179.1'], 'Unknown closure source kind')
        require((item['source'],item['path']) not in seen, 'Duplicate closure input')
        seen.add((item['source'],item['path']))
        require(type(item['bytes']) is int and 0<item['bytes']<=32*1024*1024, 'Closure input byte count required')
        hash_format(item['sha256'])
        actual=safe_source_path(resolved[item['source']],item['path'])
        require(actual.stat().st_size==item['bytes'], 'Closure input byte count mismatch: '+item['path'])
        require(sha(actual.read_bytes())==item['sha256'], 'Closure input SHA256 mismatch: '+item['path'])
        if 'transform' in item:
            require(item['source']=='canonical' and item['path']=='src/TropicalLibrary/BarkData76.ts' and item['transform']=='remove-unused-bark-table-for-guarded-musa-only-profile', 'Unknown source transform')
            hash_format(item['transformedSha256'])
            transformed=safe_source_path(resolved['transformed'],'BarkData76.musa.ts')
            require(0<transformed.stat().st_size<=32*1024*1024, 'Transformed source size limit')
            transformed_bytes=transformed.read_bytes()
            require(sha(transformed_bytes)==item['transformedSha256'], 'Transformed source SHA256 mismatch')
            source_text=actual.read_bytes().decode('utf-8')
            pattern=r'(export const BARK_DATA76:readonly BarkRow76\[\]=)\[.*\]( as const;)'
            rebuilt,count=re.subn(pattern,r'\1[]\2',source_text,flags=re.DOTALL)
            require(count==1 and rebuilt.encode('utf-8')==transformed_bytes, 'Transformed source differs from deterministic original source transform')
    return closure

def load_release(path):
    data=read_json(path.read_bytes())
    keys(data,['releaseId','sourceHead','sourceClosure','sourceRoots','dependencies','resourceProof','resources'],'release-input')
    require(data['releaseId']==RELEASE_ID, 'Unknown Musa release ID')
    require(data['sourceHead']==SOURCE_HEAD, 'Unknown native source revision')
    for label in ['sourceClosure','resourceProof']:
        keys(data[label],['sha256','localPath'],label)
    require(data['sourceClosure']['sha256']==AUDITED_CLOSURE_SHA256, 'Unaudited source closure pin')
    require(data['resourceProof']['sha256']==AUDITED_PROOF_SHA256, 'Unaudited native resource proof pin')
    closure=verify_source_closure(read_json(pinned_file(data['sourceClosure'],path.parent,4*1024*1024)),data['sourceRoots'],path.parent)
    proof=read_json(pinned_file(data['resourceProof'],path.parent,4*1024*1024))
    require(proof.get('id')=='musa-balbisiana-native78-establishing-sheltered-761014' and proof.get('sourceHead')==SOURCE_HEAD and proof.get('profile')==PLANT_PROFILE, 'Resource proof is for another profile')
    require(proof.get('scale')==1 and proof.get('soilDatumY')==0 and proof.get('originalAPI')=='profile78 + generateTropical78({compactBlades76:true})', 'Unknown native proof generation scope')
    require(proof.get('leafCount')==28 and proof.get('axisCount')==64 and proof.get('geometry',{}).get('vertices')==20632 and proof.get('geometry',{}).get('triangles')==36330, 'Native Musa morphology proof mismatch')
    require(proof.get('surfaces',{}).get('totalPixelBytes')==835584, 'Native Musa resource total mismatch')
    require(proof.get('acceptance')=={'structure':'passed','surface':'pending-review','visual':'pending-user-review','hardware':'unmeasured'}, 'Acceptance metadata cannot be broadened')
    deps=data['dependencies']
    expected_ids=['plant-operator','mother-author','mother-runtime','three-module','three-core','native-equivalence','generation-worker']
    require(isinstance(deps,list) and [d.get('id') for d in deps]==expected_ids, 'Exact seven Musa dependency IDs required')
    expected_versions=[OPERATOR,'native78-musa-only-v1','native76-fixed-renderer','three0.179.1-min','three0.179.1-min','native78-musa-runtime-hash-pairs/2','native78-musa-generation-worker/R04']
    dependencies=[]
    for dep,version in zip(deps,expected_versions):
        keys(dep,['id','version','sha256','localPath'],'dependency')
        require(dep['version']==version, 'Unknown Musa dependency version: '+dep['id'])
        raw=pinned_file(dep,path.parent)
        dependencies.append({k:dep[k] for k in ['id','version','sha256']} | {'bytes':len(raw)})
    keys(closure['bundle'],['file','bytes','sha256'],'source bundle')
    author=dependencies[1]
    require(closure['bundle']=={'file':'native78-musa-author.mjs','bytes':author['bytes'],'sha256':author['sha256']}, 'Source closure bundle differs from author dependency')
    resources=data['resources']
    require(resources==proof.get('surfaces',{}).get('resources'), 'Resources do not match pinned native generation proof')
    require(resources==EXPECTED_RESOURCES, 'Exact six audited procedural Musa resources required')
    return {'profile':PROFILE,'profileVersion':1,'operator':OPERATOR,'ruleSet':RULE_SET,
        'dependencies':dependencies,'source':{'head':SOURCE_HEAD,'closureSha256':data['sourceClosure']['sha256']},
        'profile76':PLANT_PROFILE,'units':{'length':'metre','up':'Y_UP','rootScale':[1,1,1]},
        'resources':resources,'metadata':{'releaseId':RELEASE_ID,
            'generationAPI':'generateTropical78','compactBlades76':True,
            'restoreMode':'regenerate-from-profile','geometryPolicy':'not-stored',
            'animationPolicy':'host-clock-no-samples','resourcePolicy':'pinned-rule-resources-not-embedded-in-recipe',
            'resourceProofSha256':data['resourceProof']['sha256'],
            'sourceClosureDigestDefinition':'SHA256 of pinned source closure manifest file bytes',
            'surfaceAcceptance':'pending-review','visualAcceptance':'pending-user-review'}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',type=Path,default=HERE/'release-input.json')
    args=parser.parse_args()
    static=load_release(args.input.resolve())  # All pins checked before changing outputs.
    marker=b''.join(hashlib.sha256(b'PLANT_FUNCTION_MUSA_R04_FIXED_SQLITE_BLOB'+struct.pack('<I',i)).digest() for i in range(CAPACITY//32))
    digest_marker='d'*64
    path=HERE/'template.sqlite'
    if path.exists(): path.unlink()
    db=sqlite3.connect(path)
    db.executescript(f'''PRAGMA page_size=4096; PRAGMA application_id={APP}; PRAGMA user_version=1;
      CREATE TABLE header(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,name TEXT,revision INTEGER);
      CREATE TABLE links(id INTEGER PRIMARY KEY,subject TEXT,predicate TEXT,object TEXT);
      CREATE TABLE fields(id INTEGER PRIMARY KEY,record_id TEXT,section TEXT,key TEXT,value_type TEXT,value BLOB);
      CREATE TABLE assets(role TEXT PRIMARY KEY,mime TEXT,sha256 TEXT,data BLOB);''')
    db.executemany('INSERT INTO records VALUES(?,?,?,?)',[
        ('instance','functional_plant_recipe','Establishing Musa balbisiana; recipe regeneration only',1),
        ('rules','pinned_plant_function','native-tropical78-musa / PLANT_FUNCTION_MUSA_R04',1),
        ('materials','pinned_native_resources','Six original procedural CC0 support and foliage resources',1)])
    db.executemany('INSERT INTO links VALUES(?,?,?,?)',[(1,'instance','generated_by','rules'),(2,'rules','uses_pinned_resources','materials')])
    sections=[('profile',{'schema':PROFILE,'profileVersion':1,'operator':static['operator'],'ruleSet':static['ruleSet']}),
        ('dependencies',static['dependencies']),('source',static['source']),('profile76',static['profile76']),
        ('units',static['units']),('resources',static['resources']),('metadata',static['metadata'])]
    for n,(section,value) in enumerate(sections,1):
        db.execute('INSERT INTO fields VALUES(?,?,?,?,?,?)',(n,'materials' if section=='resources' else 'rules',section,'definition','json',canonical(value).encode()))
    headers=[('format','KAOPU prototype envelope / independent experimental plant profile'),('profile',PROFILE),
        ('graph_sha256',graph_digest(db)),('asset_policy','One padded inert JSON BLOB; no mesh, pixels, samples or executable incoming code'),
        ('restore_policy','Validate; verify loaded rule bytes and generated material bytes; regenerate; caller atomically swaps only after success'),
        ('old_reader_supported','false'),('layout_id','PLANT_FUNCTION_MUSA_R04_FIXED_SQLITE_V1'),
        ('authentication','false: SHA256 verifies integrity, not author identity')]
    db.executemany('INSERT INTO header VALUES(?,?)',headers)
    db.execute('INSERT INTO assets VALUES(?,?,?,?)',('functional_plant_recipe','application/json',digest_marker,marker))
    db.commit()
    require(db.execute('pragma integrity_check').fetchall()==[('ok',)], 'Template SQLite integrity failure')
    db.close()
    raw=path.read_bytes()
    require(raw.count(digest_marker.encode())==1,'Ambiguous digest marker')
    digest_offset=raw.index(digest_marker.encode())
    segments=[];offset=0
    while offset<CAPACITY:
        needle=marker[offset:offset+min(16,CAPACITY-offset)]
        require(raw.count(needle)==1,'Ambiguous physical payload marker')
        at=raw.index(needle);size=0
        while offset+size<CAPACITY and at+size<len(raw) and raw[at+size]==marker[offset+size]:size+=1
        require(size>0,'Invalid physical segment')
        segments.append({'logicalOffset':offset,'fileOffset':at,'length':size})
        offset+=size
    config={'profile':PROFILE,'applicationId':APP,'userVersion':1,'capacityBytes':CAPACITY,'fileBytes':len(raw),
        'digestOffset':digest_offset,'segments':segments,'templateSha256':sha(raw),
        'graphSha256':dict(headers)['graph_sha256'],'static':static}
    (HERE/'dependency-manifest.json').write_text(json.dumps(static,indent=2,ensure_ascii=False)+'\n')
    (HERE/'layout.json').write_text(json.dumps(config,indent=2,ensure_ascii=False)+'\n')
    (HERE/'template-data.mjs').write_text('// Generated by build_template.py from verified pins. No pixel/geometry payload.\nexport const LAYOUT = '+canonical(config)+';\nexport const TEMPLATE_BASE64 = "'+base64.b64encode(raw).decode()+'";\n')
    print(json.dumps({'templateBytes':len(raw),'capacityBytes':CAPACITY,'blobFragments':len(segments),
        'templateSha256':sha(raw),'sqliteIntegrity':'ok','releaseId':static['metadata']['releaseId']}))

if __name__=='__main__':main()
