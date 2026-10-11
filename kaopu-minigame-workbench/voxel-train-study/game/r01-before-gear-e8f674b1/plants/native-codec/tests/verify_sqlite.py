#!/usr/bin/env python3
"""Independent Python sqlite3 read of JS-generated .KaoPu; no physical slice decoder.
Typed graph digest matches the preexisting envelope convention. No external deps.
"""
from pathlib import Path
import hashlib, importlib.util, json, math, os, sqlite3, struct, sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
PROFILE='kaopu.functional-plant-musa/0.1-experimental'
APP=0x4B505531

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

def unique_pairs(items):
    out={}
    for k,v in items:
        assert k not in out and k not in ('__proto__','constructor','prototype')
        out[k]=v
    return out

def finite(value):
    if isinstance(value,float): assert math.isfinite(value)
    elif isinstance(value,dict):
        for v in value.values(): finite(v)
    elif isinstance(value,list):
        for v in value: finite(v)

def verify(path):
    expected=path.with_suffix('.expected.json')
    blob=path.read_bytes();assert blob[:16]==b'SQLite format 3\0'
    db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro&immutable=1',uri=True)
    try:
        db.execute('PRAGMA trusted_schema=OFF');db.execute('PRAGMA query_only=ON')
        assert db.execute('PRAGMA integrity_check').fetchall()==[('ok',)]
        assert db.execute('PRAGMA application_id').fetchone()[0]==APP
        assert db.execute('PRAGMA user_version').fetchone()[0]==1
        schema=db.execute("SELECT type,name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()
        assert schema==[('table',n) for n in ['assets','fields','header','links','records']]
        header=dict(db.execute('SELECT key,value FROM header'))
        assert header['profile']==PROFILE
        assert header['graph_sha256']==graph_digest(db)
        assert db.execute('SELECT * FROM links ORDER BY id').fetchall()==[(1,'instance','generated_by','rules'),(2,'rules','uses_pinned_resources','materials')]
        rows=db.execute('SELECT role,mime,sha256,data,typeof(data) FROM assets').fetchall();assert len(rows)==1
        role,mime,digest,data,typ=rows[0]
        assert (role,mime,typ)==('functional_plant_recipe','application/json','blob')
        assert len(data)==32768 and hashlib.sha256(data).hexdigest()==digest
        recipe=json.loads(data,object_pairs_hook=unique_pairs);finite(recipe)
        assert recipe==json.loads(expected.read_text())
        fields={section:json.loads(value,object_pairs_hook=unique_pairs) for section,value in db.execute('SELECT section,value FROM fields')}
        for key in ['dependencies','source','units','resources','metadata']: assert fields[key]==recipe[key]
        assert fields['profile76']==recipe['profile']
        assert fields['profile']=={k:recipe[k] for k in ['schema','profileVersion','operator','ruleSet']}
        assert recipe['profile']['seed']==761014 and recipe['profile']['stage']=='establishing' and recipe['profile']['habitatForm']=='sheltered'
        assert recipe['motion']['timeSource']=='host.elapsed' and recipe['motion']['model']=='native76'
        assert len(recipe['resources'])==6
        assert sum(r['bytes'] for r in recipe['resources'])==835584
        assert 'images' not in recipe and recipe['metadata']['resourcePolicy']=='pinned-rule-resources-not-embedded-in-recipe'
        assert recipe['operator']=='PLANT_FUNCTION_MUSA_R04' and recipe['ruleSet']=='native-tropical78-musa'
        assert recipe['profile']['species']=='musa-balbisiana'
        assert all(r['source']=={'kind':'procedural','license':'CC0-1.0','generator':'tropical-library-76/musa-balbisiana/'+r['id']} for r in recipe['resources'])
        assert recipe['metadata']['geometryPolicy']=='not-stored'
        assert recipe['units']=={'length':'metre','up':'Y_UP','rootScale':[1,1,1]}
        return {'file':path.name,'sqliteIntegrity':'ok','fileBytes':len(blob),'sqliteVersion':sqlite3.sqlite_version,
            'applicationId':APP,'userVersion':1,'tables':[x[1] for x in schema],
            'assetSHA256':digest,'graphSHA256':header['graph_sha256'],'fileSHA256':hashlib.sha256(blob).hexdigest(),
            'typedGraphVerified':True,'completeJSONMatchesJSExpected':True,'nativeMaterialResourceCount':6,
            'nativeResourcePixelBytesOutsideRecipe':835584,'storedGeometryOrPixels':False}
    finally: db.close()

fixtures=[verify(ROOT/'objects/establishing-musa.KaoPu'),verify(ROOT/'objects/placement-roundtrip.KaoPu')]
old=Path(os.environ['KAOPU_RAIL_CODEC']) if os.environ.get('KAOPU_RAIL_CODEC') else None
old_reader={'supported':False,'executed':False,'reason':'Historical reader source not present in this environment'}
if old is not None and old.is_file():
    spec=importlib.util.spec_from_file_location('old_native_rail_reader',old)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    try: mod.decode(ROOT/'objects/establishing-musa.KaoPu')
    except ValueError as exc: old_reader={'supported':False,'executed':True,'rejectsAsExpected':True,'reason':str(exc)}
    else: raise AssertionError('Legacy rail reader must not accept the plant profile')
report={'status':'PASS','verification':'Independent native SQLite query of JavaScript-produced binary fixtures',
    'fixtures':fixtures,'oldFunctionalRailReader':old_reader,
    'oldFH88DrivingReaderSupported':False,'oldDesktopImageReaderSupported':False,'generalKAOPUStandardClaimed':False}
(ROOT/'SQLITE_TEST_RESULTS.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
