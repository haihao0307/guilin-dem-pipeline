#!/usr/bin/env python3
"""Build the existing game's strict SQLite prototype profile and pin its actual rules.
Run after final runtime edits. No mesh/image data is copied into saves or template.
"""
from pathlib import Path
import sqlite3,hashlib,json,struct,base64,re,tempfile
HERE=Path(__file__).resolve().parent
GAME=HERE.parent
CAPACITY=4*1024*1024
PROFILE='kaopu.fh88-game-session/1-experimental'
APP=0x4b505531
sha=lambda b:hashlib.sha256(b).hexdigest()

def main():
    paths={}
    def visit(path):
        path=path.resolve()
        if path in paths:return
        raw=path.read_bytes();rel=str(path.relative_to(GAME)) if path.is_relative_to(GAME) else __import__('os').path.relpath(path,GAME)
        paths[path]={'id':rel,'path':rel,'sha256':sha(raw)}
        for m in re.finditer(r'''\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]''',raw.decode()):
            visit(path.parent/(m.group(1) or m.group(2)))
    for rel in ['session.mjs','train-model.mjs','native-a4/branding/install.mjs','native-a4/recipe.mjs','native-a4/design.mjs','native-a4/dimensions.mjs']:
        visit(GAME/rel)
    deps=sorted(paths.values(),key=lambda d:d['id'])
    (HERE/'dependency-manifest.mjs').write_text('// Regenerate with codec/build-template.py after final runtime changes.\nexport const DEPENDENCIES = '+json.dumps(deps,indent=2)+';\n')
    marker=b''.join(hashlib.sha256(b'FH88_GAME_REPLAY_SQLITE_V1'+struct.pack('<I',i)).digest() for i in range(CAPACITY//32))
    with tempfile.TemporaryDirectory() as tmp:
        path=Path(tmp)/'template.sqlite';db=sqlite3.connect(path)
        db.executescript(f'''PRAGMA page_size=4096;PRAGMA application_id={APP};PRAGMA user_version=1;
          CREATE TABLE header(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,name TEXT,revision INTEGER);
          CREATE TABLE links(id INTEGER PRIMARY KEY,subject TEXT,predicate TEXT,object TEXT);
          CREATE TABLE fields(id INTEGER PRIMARY KEY,record_id TEXT,section TEXT,key TEXT,value_type TEXT,value BLOB);
          CREATE TABLE assets(role TEXT PRIMARY KEY,mime TEXT,sha256 TEXT,data BLOB);''')
        db.executemany('INSERT INTO records VALUES(?,?,?,?)',[
          ('game','deterministic_session','Flying Hongkonger 88 actual game replay',1),
          ('rules','pinned_function_dependencies','Existing game, A4 shell, mechanics, branding and SI rules',1),
          ('train','function_assembly','A4 reference envelope, tender and two passenger coaches',1)])
        db.executemany('INSERT INTO links VALUES(?,?,?,?)',[(1,'game','generated_by','rules'),(2,'game','contains','train')])
        profile={'schema':PROFILE,'restoreMode':'verified-session-replay','sourcePayloads':False,'generalKAOPUSupport':False}
        db.executemany('INSERT INTO fields VALUES(?,?,?,?,?,?)',[(1,'game','profile','definition','json',json.dumps(profile,separators=(',',':')).encode()),(2,'rules','dependencies','sha256','json',json.dumps(deps,separators=(',',':')).encode())])
        db.executemany('INSERT INTO header VALUES(?,?)',[('format','KAOPU SQLite prototype envelope; explicit game-session profile'),('profile',PROFILE),('restore_policy','Validate pinned rules, replay actual Session inputs, compare signature and complete physical snapshot; never execute file content'),('old_reader_supported','false'),('authentication','false; SHA256 integrity only'),('layout_id','FH88_GAME_SESSION_FIXED_SQLITE_V1')])
        db.execute('INSERT INTO assets VALUES(?,?,?,?)',('game_session_manifest','application/json','d'*64,marker));db.commit()
        assert db.execute('pragma integrity_check').fetchone()[0]=='ok';db.close();raw=bytearray(path.read_bytes())
    digest_offset=raw.index(b'd'*64);segments=[];offset=0
    while offset<CAPACITY:
        needle=marker[offset:offset+min(16,CAPACITY-offset)];at=raw.index(needle)
        # Leaf-local payload ends before its 4-byte overflow pointer. Overflow
        # pages start after their own 4-byte next-page pointer. Random marker
        # matching alone can accidentally absorb a pointer byte; bound by page.
        size=min(CAPACITY-offset,4096-(at%4096)-(4 if offset==0 else 0))
        assert raw[at:at+size]==marker[offset:offset+size], (offset,at,size)
        segments.append([offset,at,size]);raw[at:at+size]=b'\0'*size;offset+=size
    raw[digest_offset:digest_offset+64]=b'0'*64
    chunks=[];i=0
    while i<len(raw):
        if raw[i]==0:i+=1;continue
        start=i;last=i;i+=1
        while i<len(raw) and i-last<16:
            if raw[i]!=0:last=i
            i+=1
        end=last+1;chunks.append([start,base64.b64encode(raw[start:end]).decode()]);i=end
    layout={'profile':PROFILE,'applicationId':APP,'capacityBytes':CAPACITY,'fileBytes':len(raw),'digestOffset':digest_offset,'segments':segments,'baseSha256':sha(raw)}
    (HERE/'template-data.mjs').write_text('// Generated SQLite bytes, stored as sparse immutable chunks. No meshes or image assets.\nexport const LAYOUT='+json.dumps(layout,separators=(',',':'))+';\nexport const BASE_CHUNKS='+json.dumps(chunks,separators=(',',':'))+';\n')
    print(json.dumps({'sqliteIntegrity':'ok','fileBytes':len(raw),'sourceModuleBytes':(HERE/'template-data.mjs').stat().st_size,'payloadCapacity':CAPACITY,'dependencies':len(deps)}))
if __name__=='__main__':main()
