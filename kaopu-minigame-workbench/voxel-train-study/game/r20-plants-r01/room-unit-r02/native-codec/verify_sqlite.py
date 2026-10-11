#!/usr/bin/env python3
"""Inspect the generated sample using actual SQLite, read-only, outside the codec."""
from pathlib import Path
import hashlib
import json
import sqlite3
import zlib
from build_template import APP, PROFILE, SCORE_SCHEMA, TABLES, REQUIRED_DEPENDENCY_IDS, canonical, graph_digest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
path = HERE / 'samples/original-material-dwelling.KaoPu'
raw = path.read_bytes()
assert raw[:16] == b'SQLite format 3\0'
db = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
assert db.execute('PRAGMA integrity_check').fetchall() == [('ok',)]
assert db.execute('PRAGMA application_id').fetchone()[0] == APP
assert db.execute('PRAGMA user_version').fetchone()[0] == 2
objects = db.execute('SELECT type,name FROM sqlite_master WHERE name NOT LIKE "sqlite_%" ORDER BY name').fetchall()
assert objects == [('table', name) for name in sorted(TABLES)], objects
headers = dict(db.execute('SELECT key,value FROM header'))
assert headers['profile'] == PROFILE
assert headers['graph_sha256'] == graph_digest(db)
static = {section: json.loads(value) for section, value in db.execute('SELECT section,value FROM fields')}
assert static['scoreSchema'] == SCORE_SCHEMA
assert static['dependencyStatus'] == 'pinned'
assert static['resources'] == []
assert {pin['id'] for pin in static['dependencies']} == REQUIRED_DEPENDENCY_IDS
assert static['hostRequirements']['materialSourceRevision'] == 'OriginalTimber-v3+BrickR3.12'
assert static['hostRequirements']['wallBindingModes'] == ['declared', 'legacy']
assert static['hostRequirements']['defaultWallBindingMode'] == 'declared'
for pin in static['dependencies']:
    dependency = (ROOT / pin['id'].replace('__', '/')).read_bytes()
    assert len(dependency) == pin['bytes']
    assert hashlib.sha256(dependency).hexdigest() == pin['sha256']
assets = db.execute('SELECT role,mime,sha256,crc32,data FROM assets').fetchall()
assert len(assets) == 1
role, mime, digest, checksum, payload = assets[0]
assert role == 'functional_room_score' and mime == 'application/json'
assert isinstance(payload, bytes) and len(payload) == 16384
assert hashlib.sha256(payload).hexdigest() == digest
assert f'{zlib.crc32(payload):08x}' == checksum
recipe = json.loads(payload)
assert set(recipe) == {'schema', 'kind', 'id', 'seed', 'width', 'depth', 'height', 'doorOpen', 'presetId', 'wallBindingMode'}
assert recipe['schema'] == SCORE_SCHEMA and recipe['kind'] == 'dwelling'
assert (recipe['width'], recipe['depth'], recipe['height']) == (4, 4, 3)
assert recipe['presetId'] == 'yunnan_light_weathered_v2'
assert recipe['wallBindingMode'] == 'declared'
encoded = canonical(recipe).encode('utf-8')
assert payload == encoded + b' ' * (len(payload) - len(encoded))
receipt = {
    'file': path.name, 'fileBytes': len(raw), 'fileSha256': hashlib.sha256(raw).hexdigest(),
    'sqliteIntegrity': 'ok', 'tables': sorted(TABLES),
    'tableRows': {table: db.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] for table in TABLES},
    'profile': PROFILE, 'userVersion': 2, 'graphSha256': headers['graph_sha256'],
    'dependencyPinsVerified': len(static['dependencies']), 'oneRecipeAssetOnly': True,
    'wallBindingMode': recipe['wallBindingMode'],
    'unpaddedRecipeBytes': len(encoded), 'paddedRecipeBytes': len(payload),
    'noEmbeddedGeometryTextureCode': True, 'authentication': False, 'generalKaoPuReader': False,
}
db.close()
(HERE / 'sqlite-verification.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
