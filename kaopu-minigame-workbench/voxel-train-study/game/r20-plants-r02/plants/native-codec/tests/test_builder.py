#!/usr/bin/env python3
"""Builder negative tests. Temp inputs remain inside this codec directory."""
from pathlib import Path
import copy, importlib.util, json, sys
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('plant_template_builder',ROOT/'build_template.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=json.loads((ROOT/'release-input.json').read_text())
# Resolve build-only paths so test fixture placement cannot change their meaning.
for pin in [original['sourceClosure'],original['resourceProof'],*original['dependencies']]:
    pin['localPath']=str((ROOT/pin['localPath']).resolve())
fixture=ROOT/'tests/.negative-release-input.json'
results=[]

def reject(name,mutate):
    data=copy.deepcopy(original);mutate(data)
    try:
        fixture.write_text(json.dumps(data))
        try: m.load_release(fixture)
        except (ValueError,FileNotFoundError) as exc: results.append({'name':name,'pass':True,'reason':str(exc)})
        else: raise AssertionError(name+' accepted')
    finally: fixture.unlink(missing_ok=True)

assert m.load_release(ROOT/'release-input.json')['profile']==m.PROFILE
reject('missing deployment dependency file',lambda d:d['dependencies'][0].update(localPath='missing-final-bundle.mjs'))
reject('placeholder dependency hash',lambda d:d['dependencies'][0].update(sha256='TODO'))
reject('all-zero placeholder dependency hash',lambda d:d['dependencies'][0].update(sha256='0'*64))
reject('mismatching real-shaped dependency hash',lambda d:d['dependencies'][0].update(sha256='0123456789abcdef'*4))
reject('unknown source head',lambda d:d.update(sourceHead='0'*40))
reject('mismatching source closure pin',lambda d:d['sourceClosure'].update(sha256='0123456789abcdef'*4))
reject('mismatching resource proof pin',lambda d:d['resourceProof'].update(sha256='0123456789abcdef'*4))
reject('resource fingerprint differs from native proof',lambda d:d['resources'][0].update(sha256='0123456789abcdef'*4))
reject('resource source differs from native proof',lambda d:d['resources'][0]['source'].update(uri='https://example.invalid'))
reject('missing resource',lambda d:d['resources'].pop())
reject('unknown release key',lambda d:d.update(untrusted=True))
reject('duplicate dependency IDs',lambda d:d['dependencies'][1].update(id=d['dependencies'][0]['id']))
reject('no concrete dependency list',lambda d:d.update(dependencies=[]))
reject('URL cannot substitute a local artifact',lambda d:d['dependencies'][0].update(localPath='https://example.invalid/code.js'))
report={'status':'PASS','checks':len(results),'results':results,'inputFilesMutated':False}
(ROOT/'BUILDER_TEST_RESULTS.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
