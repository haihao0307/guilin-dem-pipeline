#!/usr/bin/env python3
"""Build the original-material dwelling SQLite.KaoPu fixed envelope using Python's SQLite.

No downloaded dependencies, geometry, textures, executable payloads, or plant
resources. Optional release pins are verified against local files before output.
The browser codec edits only reserved BLOB bytes and their checksums; it never
executes SQL or loads incoming code. This is an independent experimental profile.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import re
import sqlite3
import struct

HERE = Path(__file__).resolve().parent
PROFILE = 'kaopu.dwelling-unit/0.2-experimental'
SCORE_SCHEMA = 'kaopu.dwelling-unit/2'
OPERATOR = 'kaopu.dwelling-unit'
APP = 0x4B505732
CAPACITY = 16384
TABLES = ('header', 'records', 'links', 'fields', 'assets')
REQUIRED_DEPENDENCY_IDS = {
    'room-recipe.mjs', 'room-unit.mjs', 'room-native.mjs',
    'native__timber__original-core.mjs', 'native__timber__three-adapter.mjs',
    'r312-wall__original-shaders.mjs', 'r312-wall__adapter-shaders.mjs',
    'r312-wall__r312-wall.mjs',
}
sha = lambda value: hashlib.sha256(value).hexdigest()
canonical = lambda value: json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def unique_pairs(items):
    result = {}
    for key, value in items:
        require(key not in result and key not in ('__proto__', 'constructor', 'prototype'), 'Duplicate or unsafe JSON key')
        result[key] = value
    return result


def read_json(raw):
    return json.loads(raw, object_pairs_hook=unique_pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Nonfinite JSON')))


def graph_digest(db):
    """SHA256(table name + typed, length-prefixed cells), stable row id order."""
    digest = hashlib.sha256()
    for table in ('records', 'links', 'fields'):
        digest.update(table.encode('ascii'))
        for row in db.execute(f'SELECT * FROM {table} ORDER BY 1'):
            for item in row:
                if item is None:
                    tag, raw = b'n', b''
                elif isinstance(item, bytes):
                    tag, raw = b'b', item
                elif isinstance(item, int):
                    tag, raw = b'i', struct.pack('<q', item)
                else:
                    tag, raw = b's', str(item).encode('utf-8')
                digest.update(tag + struct.pack('<Q', len(raw)) + raw)
    return digest.hexdigest()


def load_dependencies(path):
    if path is None:
        return []
    data = read_json(path.read_bytes())
    require(isinstance(data, list) and 1 <= len(data) <= 16, 'Nonempty bounded dependency array required')
    result, ids = [], set()
    for pin in data:
        require(isinstance(pin, dict) and set(pin) == {'id', 'version', 'sha256', 'localPath'}, 'Unexpected dependency fields')
        require(isinstance(pin['id'], str) and re.fullmatch(r'[-a-zA-Z0-9_.]{1,96}', pin['id']) and pin['id'] not in ids, 'Duplicate or invalid dependency id')
        require(isinstance(pin['version'], str) and re.fullmatch(r'[-a-zA-Z0-9_./]{1,96}', pin['version']), 'Invalid version')
        require(isinstance(pin['sha256'], str) and re.fullmatch(r'[0-9a-f]{64}', pin['sha256']), 'SHA256 required')
        require(isinstance(pin['localPath'], str) and pin['localPath'] and '://' not in pin['localPath'], 'Local dependency file required')
        target = Path(pin['localPath'])
        if not target.is_absolute():
            target = path.parent / target
        require(target.is_file() and 0 < target.stat().st_size <= 8 * 1024 * 1024, 'Missing or oversized dependency')
        raw = target.read_bytes()
        require(sha(raw) == pin['sha256'], 'Dependency hash mismatch: ' + pin['id'])
        ids.add(pin['id'])
        result.append({key: pin[key] for key in ('id', 'version', 'sha256')} | {'bytes': len(raw)})
    require(ids == REQUIRED_DEPENDENCY_IDS, 'Complete dwelling V2 generator dependency closure required')
    return result


def build(dependency_input=None):
    dependencies = load_dependencies(dependency_input)  # Verify all inputs first.
    static = {
        'profile': PROFILE, 'profileVersion': 2, 'operator': OPERATOR,
        'ruleSet': 'walled-city-room-r02', 'scoreSchema': SCORE_SCHEMA,
        'kinds': ['dwelling'],
        'units': {'length': 'metre', 'up': 'Y_UP', 'yaw': 'radian'},
        'dependencies': dependencies, 'dependencyStatus': 'pinned' if dependencies else 'unbound-development',
        'resources': [],
        'hostRequirements': {'operator': 'kaopu.dwelling-unit', 'materialSourceRevision': 'OriginalTimber-v3+BrickR3.12',
                             'materialGenerators': ['OriginalTimber-v3', 'BrickR3.12'],
                             'wallBindingModes': ['declared', 'legacy'], 'defaultWallBindingMode': 'declared',
                             'three': 'trusted-existing-host-injection', 'renderer': 'existing-host-only'},
        'restoreMode': 'trusted-host-regenerate-from-score',
        'payloadPolicy': 'plain-dwelling-recipe-only;no-mesh;no-texture;no-code;no-external-source',
        'authentication': False,
    }
    marker = b''.join(hashlib.sha256(b'DWELLING_UNIT_FUNCTION_R02_SQLITE_BLOB' + struct.pack('<I', index)).digest()
                      for index in range(CAPACITY // 32))
    hash_marker, crc_marker = 'd' * 64, 'c' * 8
    # Build in memory so bad inputs cannot replace a valid release on disk.
    db = sqlite3.connect(':memory:')
    db.executescript(f'''PRAGMA page_size=4096; PRAGMA application_id={APP}; PRAGMA user_version=2;
      CREATE TABLE header(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE records(id TEXT PRIMARY KEY,kind TEXT,name TEXT,revision INTEGER);
      CREATE TABLE links(id INTEGER PRIMARY KEY,subject TEXT,predicate TEXT,object TEXT);
      CREATE TABLE fields(id INTEGER PRIMARY KEY,record_id TEXT,section TEXT,key TEXT,value_type TEXT,value BLOB);
      CREATE TABLE assets(role TEXT PRIMARY KEY,mime TEXT,sha256 TEXT,crc32 TEXT,data BLOB);''')
    db.executemany('INSERT INTO records VALUES(?,?,?,?)', [
        ('instance', 'functional_room_score', 'Data-only original-material dwelling recipe; host regeneration', 2),
        ('rules', 'trusted_room_function', OPERATOR, 2)])
    db.execute('INSERT INTO links VALUES(?,?,?,?)', (1, 'instance', 'generated_by', 'rules'))
    for index, (section, value) in enumerate(static.items(), 1):
        db.execute('INSERT INTO fields VALUES(?,?,?,?,?,?)',
                   (index, 'rules', section, 'definition', 'json', canonical(value).encode('utf-8')))
    headers = [
        ('format', 'SQLite.KaoPu independent experimental dwelling recipe envelope'),
        ('profile', PROFILE), ('graph_sha256', graph_digest(db)),
        ('asset_policy', 'One padded inert JSON score BLOB; no geometry, textures or executable payload'),
        ('restore_policy', 'Validate container and score; verify trusted local dependency bytes; regenerate in host'),
        ('layout_id', 'DWELLING_UNIT_FUNCTION_R02_FIXED_SQLITE_V2'),
        ('authentication', 'false: CRC32 and SHA256 provide corruption detection, not author identity'),
        ('compatibility', 'Only dwelling profile 0.2-experimental; not a universal KaoPu reader')]
    db.executemany('INSERT INTO header VALUES(?,?)', headers)
    db.execute('INSERT INTO assets VALUES(?,?,?,?,?)',
               ('functional_room_score', 'application/json', hash_marker, crc_marker, marker))
    db.commit()
    require(db.execute('PRAGMA integrity_check').fetchall() == [('ok',)], 'SQLite template integrity failure')
    raw = db.serialize()
    db.close()
    require(raw.count(hash_marker.encode()) == 1 and raw.count(crc_marker.encode()) == 1, 'Ambiguous checksum marker')
    segments, offset = [], 0
    while offset < CAPACITY:
        needle = marker[offset:offset + min(16, CAPACITY - offset)]
        require(raw.count(needle) == 1, 'Ambiguous physical BLOB marker')
        position, size = raw.index(needle), 0
        while offset + size < CAPACITY and position + size < len(raw) and raw[position + size] == marker[offset + size]:
            size += 1
        require(size > 0, 'Invalid BLOB segment')
        segments.append({'logicalOffset': offset, 'fileOffset': position, 'length': size})
        offset += size
    layout = {'profile': PROFILE, 'applicationId': APP, 'userVersion': 2,
              'capacityBytes': CAPACITY, 'fileBytes': len(raw),
              'digestOffset': raw.index(hash_marker.encode()), 'crcOffset': raw.index(crc_marker.encode()),
              'segments': segments, 'templateSha256': sha(raw),
              'graphSha256': dict(headers)['graph_sha256'], 'static': static}
    (HERE / 'template.sqlite').write_bytes(raw)
    (HERE / 'dependency-manifest.json').write_text(json.dumps(static, indent=2, ensure_ascii=False) + '\n')
    (HERE / 'layout.json').write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n')
    (HERE / 'template-data.mjs').write_text(
        '// Generated by build_template.py. Fixed inert original-material dwelling SQLite envelope.\n'
        + 'export const LAYOUT = ' + canonical(layout) + ';\n'
        + 'export const TEMPLATE_BASE64 = "' + base64.b64encode(raw).decode() + '";\n')
    return {'templateBytes': len(raw), 'capacityBytes': CAPACITY, 'blobFragments': len(segments),
            'templateSha256': sha(raw), 'graphSha256': layout['graphSha256'],
            'sqliteIntegrity': 'ok', 'dependencyStatus': static['dependencyStatus']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--dependencies', type=Path, default=(HERE / 'release-input.json') if (HERE / 'release-input.json').is_file() else None,
                        help='Verified local release pin input; defaults to release-input.json when present')
    args = parser.parse_args()
    print(json.dumps(build(args.dependencies.resolve() if args.dependencies else None)))


if __name__ == '__main__':
    main()
