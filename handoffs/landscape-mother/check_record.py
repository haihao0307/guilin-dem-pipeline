"""Record checks only. No terrain solver, asset mutation or network access."""
from pathlib import Path
import copy
import json
import math
import re


def validate(record):
    if record.get('schema') != 'landscape-facts-logic-claims/1':
        raise ValueError('Unknown record schema')
    if record.get('mode') != 'study_only':
        raise ValueError('This record has no production adoption')
    if any(value is not False for value in record['rules'].values()):
        raise ValueError('Protected rule changed')
    expected_rules = {'canonicalWritable', 'textureSampling', 'lod',
                      'cameraDependentGeometry', 'queryMutatesState'}
    if set(record['rules']) != expected_rules:
        raise ValueError('Missing rule')
    for key in ('visualApproved', 'productionReady', 'reconstructionComplete'):
        if record.get(key) is not False:
            raise ValueError('No approval or reconstruction evidence in this record')
    for key in ('html', 'code'):
        if not re.fullmatch(r'[a-f0-9]{64}', record['source'][key]['sha256']):
            raise ValueError('Invalid source digest')
    elapsed = record['time']['elapsedSeconds']
    if elapsed is not None:
        if type(elapsed) not in (float, int) or not math.isfinite(elapsed) or elapsed < 0:
            raise ValueError('Invalid elapsed time')
        if not record['time']['simulationEpoch'] or not record['history']['solver']:
            raise ValueError('Time requires explicit epoch and solver identity')
    if record['history']['events'] is not None and not record['history']['solver']:
        raise ValueError('History may not be invented without a declared model')
    seen = set()
    for claim in record['claims']:
        if claim['id'] in seen:
            raise ValueError('Duplicate claim identity')
        seen.add(claim['id'])
        if claim['epistemic'] not in ('reported', 'proposal', 'inferred', 'unknown'):
            raise ValueError('No promotion to observed or measured without new evidence')
        if not claim['basis'] or not claim['statement'] or not isinstance(claim['scope'], dict):
            raise ValueError('Claim requires basis, statement and scope')
        if claim['verification'] != 'not_run' or claim['acceptance'] != 'not_approved':
            raise ValueError('This study record has no new result or acceptance')
    if record['recipe06']['id'] != 6 or record['recipe06']['seed'] != 83:
        raise ValueError('Original candidate identity changed')
    return True


def main():
    record = json.loads(Path(__file__).with_name('TERRAIN_RECORD.json').read_text())
    before = json.dumps(record, ensure_ascii=False, sort_keys=True, allow_nan=False)
    assert validate(record)
    assert json.dumps(record, ensure_ascii=False, sort_keys=True) == before
    assert json.loads(before) == record
    cases = [
        (('schema',), 'other'),
        (('mode',), 'production'),
        (('rules', 'canonicalWritable'), True),
        (('rules', 'cameraDependentGeometry'), True),
        (('visualApproved',), True),
        (('productionReady',), True),
        (('reconstructionComplete',), True),
        (('time', 'elapsedSeconds'), -1),
        (('time', 'elapsedSeconds'), 100),
        (('history', 'events'), []),
        (('source', 'html', 'sha256'), 'missing'),
        (('claims', 0, 'epistemic'), 'measured'),
        (('claims', 0, 'basis'), []),
        (('claims', 0, 'acceptance'), 'approved'),
        (('recipe06', 'seed'), 84),
    ]
    for path, value in cases:
        candidate = copy.deepcopy(record)
        target = candidate
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
        try:
            validate(candidate)
        except ValueError:
            continue
        raise AssertionError(f'Invalid record accepted: {path}')
    print(json.dumps({'scope': 'study_record_only', 'validRecord': True,
                      'readOnlyCheck': True, 'jsonRoundtrip': True,
                      'invalidCasesRejected': len(cases),
                      'terrainSolverRun': False, 'browserRun': False}))


if __name__ == '__main__':
    main()
