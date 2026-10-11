#!/usr/bin/env python3
"""Build the fixed, experimental plant SQLite envelope from verified local pins.
No dependency hash is fabricated or silently updated. No mesh/pixels enter recipe.
The physical BLOB-fragment approach is adapted from FH88 native codec R04.
"""
from pathlib import Path
import argparse, base64, hashlib, json, re, sqlite3, struct

HERE = Path(__file__).resolve().parent
PROFILE = 'kaopu.functional-plant/0.1-experimental'
SOURCE_HEAD = 'd5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122'
APP = 0x4B505531
CAPACITY = 32768
PLANT_PROFILE = {'profileVersion':8,'tropicalLibraryVersion':76,'productionSystemVersion':78,
    'leafNaturalismVersion':73,'treeLeafVersion':75,'condition76':'normal','reproductive76':False,
    'species':'ficus-microcarpa','seed':761014,'stage':'juvenile','habitatForm':'sheltered','material':'wild-reference'}
RESOURCE_IDS = ['wood/albedo','wood/packed-normal-roughness-height','support/albedo',
    'support/normal','support/roughness','foliage/albedo','foliage/normal','foliage/roughness']
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

def load_release(path):
    data=read_json(path.read_bytes())
    if 'releaseId' not in data: data['releaseId']='native-tropical78-ficus-r01'
    keys(data,['releaseId','sourceHead','sourceClosure','dependencies','resourceProof','resources'],'release-input')
    require(isinstance(data['releaseId'],str) and re.fullmatch('[-a-zA-Z0-9_.]{1,96}',data['releaseId']), 'Invalid release ID')
    require(data['sourceHead']==SOURCE_HEAD, 'Unknown native source revision')
    for label in ['sourceClosure','resourceProof']:
        keys(data[label],['sha256','localPath'],label)
    closure=read_json(pinned_file(data['sourceClosure'],path.parent,4*1024*1024))
    require(closure.get('sourceHead')==SOURCE_HEAD, 'Source closure revision mismatch')
    require(isinstance(closure.get('inputs'),list) and closure['inputs'], 'Source closure inputs required')
    for item in closure['inputs']:
        require(isinstance(item,dict) and isinstance(item.get('path'),str) and item['path'], 'Bad closure input')
        hash_format(item.get('sha256'))
    proof=read_json(pinned_file(data['resourceProof'],path.parent,4*1024*1024))
    require(proof.get('sourceHead')==SOURCE_HEAD and proof.get('profile')==PLANT_PROFILE, 'Resource proof is for another profile')
    deps=data['dependencies']
    require(isinstance(deps,list) and 2 <= len(deps) <=32, 'Pinned dependency list required')
    dependencies=[]
    ids=set()
    for dep in deps:
        keys(dep,['id','version','sha256','localPath'],'dependency')
        require(isinstance(dep['id'],str) and re.fullmatch('[-a-zA-Z0-9_.]{1,96}',dep['id']) and dep['id'] not in ids, 'Duplicate/invalid dependency ID')
        require(isinstance(dep['version'],str) and re.fullmatch('[-a-zA-Z0-9_./]{1,96}',dep['version']), 'Invalid dependency version')
        ids.add(dep['id'])
        raw=pinned_file(dep,path.parent)
        dependencies.append({k:dep[k] for k in ['id','version','sha256']} | {'bytes':len(raw)})
    resources=data['resources']
    require(resources==proof.get('surfaces',{}).get('resources'), 'Resources do not match pinned native generation proof')
    require([r.get('id') for r in resources]==RESOURCE_IDS, 'Exact eight native material resources required')
    for r in resources:
        keys(r,['id','width','height','colorSpace','bytes','sha256','source'],'resource')
        hash_format(r['sha256'])
        require(type(r['width']) is int and type(r['height']) is int and 0<r['width']<=512 and 0<r['height']<=512, 'Resource dimensions out of range')
        require(type(r['bytes']) is int and r['bytes']==r['width']*r['height']*4, 'Resource byte count mismatch')
        require(r['colorSpace'] in ['linear','srgb'], 'Unknown colour space')
        source=r['source']
        require(source.get('license')=='CC0-1.0', 'Explicit original CC0 declaration required')
        if r['id'].startswith('wood/'):
            keys(source,['kind','license','generator','uri','asset','botanicalReference'],'wood provenance')
            require(source['kind']=='derived-cc0' and source['asset']=='japanese_camphor_bark' and source['uri']=='https://polyhaven.com/a/japanese_camphor_bark', 'Original proxy bark provenance required')
        else:
            keys(source,['kind','license','generator'],'procedural provenance')
            require(source['kind']=='procedural', 'Original procedural resource required')
    return {'profile':PROFILE,'profileVersion':1,'operator':'PLANT_FUNCTION_R01','ruleSet':'native-tropical78-ficus',
        'dependencies':dependencies,'source':{'head':SOURCE_HEAD,'closureSha256':data['sourceClosure']['sha256']},
        'profile76':PLANT_PROFILE,'units':{'length':'metre','up':'Y_UP','rootScale':[1,1,1]},
        'resources':resources,'metadata':{'releaseId':data['releaseId'],
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
    marker=b''.join(hashlib.sha256(b'PLANT_FUNCTION_R01_FIXED_SQLITE_BLOB'+struct.pack('<I',i)).digest() for i in range(CAPACITY//32))
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
        ('instance','functional_plant_recipe','Young ficus; recipe regeneration only',1),
        ('rules','pinned_plant_function','native-tropical78-ficus / PLANT_FUNCTION_R01',1),
        ('materials','pinned_native_resources','Original native resources; CC0-declared proxy bark and procedural leaves',1)])
    db.executemany('INSERT INTO links VALUES(?,?,?,?)',[(1,'instance','generated_by','rules'),(2,'rules','uses_pinned_resources','materials')])
    sections=[('profile',{'schema':PROFILE,'profileVersion':1,'operator':static['operator'],'ruleSet':static['ruleSet']}),
        ('dependencies',static['dependencies']),('source',static['source']),('profile76',static['profile76']),
        ('units',static['units']),('resources',static['resources']),('metadata',static['metadata'])]
    for n,(section,value) in enumerate(sections,1):
        db.execute('INSERT INTO fields VALUES(?,?,?,?,?,?)',(n,'materials' if section=='resources' else 'rules',section,'definition','json',canonical(value).encode()))
    headers=[('format','KAOPU prototype envelope / independent experimental plant profile'),('profile',PROFILE),
        ('graph_sha256',graph_digest(db)),('asset_policy','One padded inert JSON BLOB; no mesh, pixels, samples or executable incoming code'),
        ('restore_policy','Validate; verify loaded rule bytes and generated material bytes; regenerate; caller atomically swaps only after success'),
        ('old_reader_supported','false'),('layout_id','PLANT_FUNCTION_R01_FIXED_SQLITE_V1'),
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
