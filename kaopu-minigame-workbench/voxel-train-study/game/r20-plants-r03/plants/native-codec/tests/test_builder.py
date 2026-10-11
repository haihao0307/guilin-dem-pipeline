#!/usr/bin/env python3
"""Musa builder negative tests. No original source or rule input is modified."""
from pathlib import Path
import copy, hashlib, importlib.util, json, shutil, sys, tempfile
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('plant_template_builder',ROOT/'build_template.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
original=json.loads((ROOT/'release-input.json').read_text())
for pin in [original['sourceClosure'],original['resourceProof'],*original['dependencies']]:
    pin['localPath']=str((ROOT/pin['localPath']).resolve())
for key,value in original['sourceRoots'].items(): original['sourceRoots'][key]=str(m.resolve_source_root(value,ROOT))
closure=json.loads(Path(original['sourceClosure']['localPath']).read_text())
results=[]

def expect_reject(name, fn, pattern=None):
    try: fn()
    except (ValueError,FileNotFoundError) as exc:
        if pattern: assert pattern in str(exc),(name,str(exc),pattern)
        results.append({'name':name,'pass':True,'reason':str(exc)})
    else: raise AssertionError(name+' accepted')

with tempfile.TemporaryDirectory(prefix='.builder-negative-',dir=ROOT/'tests') as temp:
    temp=Path(temp);fixture=temp/'release-input.json'
    def reject(name,mutate,pattern=None):
        data=copy.deepcopy(original);mutate(data);fixture.write_text(json.dumps(data))
        expect_reject(name,lambda:m.load_release(fixture),pattern)
    static=m.load_release(ROOT/'release-input.json')
    assert static['profile']==m.PROFILE and static['profile76']['species']=='musa-balbisiana'
    assert len(static['resources'])==6 and sum(r['bytes'] for r in static['resources'])==835584
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
    reject('seventh resource',lambda d:d['resources'].append(copy.deepcopy(d['resources'][0])))
    reject('reordered resources',lambda d:d['resources'].reverse())
    reject('unknown release key',lambda d:d.update(untrusted=True))
    reject('unknown release ID',lambda d:d.update(releaseId='native-tropical78-ficus-r04-worker'))
    reject('missing release ID',lambda d:d.pop('releaseId'))
    reject('duplicate dependency IDs',lambda d:d['dependencies'][1].update(id=d['dependencies'][0]['id']))
    reject('no concrete dependency list',lambda d:d.update(dependencies=[]))
    reject('missing dependency',lambda d:d['dependencies'].pop())
    reject('extra dependency',lambda d:d['dependencies'].append(copy.deepcopy(d['dependencies'][0])))
    reject('Ficus author version',lambda d:d['dependencies'][1].update(version='native78-ficus-only-v1'))
    reject('URL cannot substitute a local artifact',lambda d:d['dependencies'][0].update(localPath='https://example.invalid/code.js'))
    reject('source root unavailable',lambda d:d['sourceRoots'].update(canonical=str(temp/'missing-root')))
    reject('source root URL forbidden',lambda d:d['sourceRoots'].update(canonical='https://example.invalid'))
    reject('source root classifier missing',lambda d:d['sourceRoots'].pop('adapter'))
    reject('source root classifier unknown',lambda d:d['sourceRoots'].update(arbitrary=str(temp)))

    def reject_closure(name,mutate,pattern=None):
        c=copy.deepcopy(closure);mutate(c)
        expect_reject(name,lambda:m.verify_source_closure(c,original['sourceRoots'],ROOT),pattern)
    reject_closure('all 92 closure inputs are mandatory',lambda c:c['inputs'].pop(),'input count mismatch')
    reject_closure('closure count cannot be repinned to a subset',lambda c:(c['inputs'].pop(),c.update(inputCount=91)),'input count mismatch')
    reject_closure('duplicate closure path',lambda c:c['inputs'].__setitem__(1,copy.deepcopy(c['inputs'][0])),'Duplicate closure input')
    reject_closure('closure source classifier unknown',lambda c:c['inputs'][0].update(source='untrusted'),'Unknown closure source kind')
    reject_closure('closure relative traversal',lambda c:c['inputs'][0].update(path='../escape'),'escapes root')
    reject_closure('closure absolute path',lambda c:c['inputs'][0].update(path='/etc/passwd'),'escapes root')
    reject_closure('closure path Windows traversal',lambda c:c['inputs'][0].update(path='..\\escape'),'Relative closure input path required')
    reject_closure('closure file missing',lambda c:c['inputs'][0].update(path='missing-source.ts'),'Missing closure input')
    reject_closure('closure actual byte count checked',lambda c:c['inputs'][0].update(bytes=c['inputs'][0]['bytes']+1),'byte count mismatch')
    reject_closure('closure real shaped SHA checks actual file bytes',lambda c:c['inputs'][0].update(sha256='0123456789abcdef'*4),'Closure input SHA256 mismatch')
    reject_closure('closure zero hash forbidden',lambda c:c['inputs'][0].update(sha256='0'*64),'Real SHA256 pin required')
    reject_closure('closure unknown transform',lambda c:next(i for i in c['inputs'] if 'transform' in i).update(transform='arbitrary'),'Unknown source transform')
    reject_closure('closure transformed bytes hash checked',lambda c:next(i for i in c['inputs'] if 'transform' in i).update(transformedSha256='0123456789abcdef'*4),'Transformed source SHA256 mismatch')

    # Independent local source root: same-length real content tampering cannot pass.
    roots=copy.deepcopy(original['sourceRoots']);adapter=temp/'adapter';adapter.mkdir()
    for item in closure['inputs']:
        if item['source']=='adapter':
            dest=adapter/item['path'];dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(Path(roots['adapter'])/item['path'],dest)
    roots['adapter']=str(adapter)
    target=adapter/next(i['path'] for i in closure['inputs'] if i['source']=='adapter')
    pristine=target.read_bytes();target.write_bytes(bytes([pristine[0]^1])+pristine[1:])
    expect_reject('same-size local source tampering detected',lambda:m.verify_source_closure(closure,roots,ROOT),'Closure input SHA256 mismatch')
    target.unlink();target.symlink_to(Path(original['sourceRoots']['adapter'])/next(i['path'] for i in closure['inputs'] if i['source']=='adapter'))
    expect_reject('closure symlink cannot escape declared root',lambda:m.verify_source_closure(closure,roots,ROOT),'symlink escapes root')
    target.unlink();target.write_bytes(pristine)
    assert m.verify_source_closure(closure,roots,ROOT)==closure
    # A matching transformed hash is insufficient if it is not the deterministic source transform.
    transformed=temp/'transformed';transformed.mkdir();roots['transformed']=str(transformed)
    actual=Path(original['sourceRoots']['transformed'])/'BarkData76.musa.ts'
    bogus=actual.read_bytes()+b'// unauthorized transform\n';(transformed/actual.name).write_bytes(bogus)
    modified=copy.deepcopy(closure)
    next(i for i in modified['inputs'] if 'transform' in i)['transformedSha256']=hashlib.sha256(bogus).hexdigest()
    expect_reject('repinned arbitrary transform rejected against original source',lambda:m.verify_source_closure(modified,roots,ROOT),'differs from deterministic original source transform')
    # Even a rehashed altered proof cannot broaden resource or profile/metadata scope.
    for name,mutate in [
        ('repinned changed resource source',lambda p:p['surfaces']['resources'][0]['source'].update(generator='other')),
        ('repinned changed material hash',lambda p:p['surfaces']['resources'][0].update(sha256='0123456789abcdef'*4)),
        ('repinned changed profile',lambda p:p['profile'].update(species='ficus-microcarpa')),
        ('repinned false acceptance',lambda p:p['acceptance'].update(visual='passed')),
        ('repinned changed scale',lambda p:p.update(scale=.1))]:
        proof=json.loads(Path(original['resourceProof']['localPath']).read_text());mutate(proof)
        raw=json.dumps(proof).encode();path=temp/'proof.json';path.write_bytes(raw)
        reject(name,lambda d:d.update(resourceProof={'localPath':str(path),'sha256':hashlib.sha256(raw).hexdigest()}),'Unaudited native resource proof pin')
report={'status':'PASS','checks':len(results),'results':results,'inputFilesMutated':False,'originalClosureInputsVerified':len(closure['inputs']),'transformedSourceVerifiedAgainstOriginal':True,'nativeResourceCount':6,'nativeResourceBytes':835584}
(ROOT/'BUILDER_TEST_RESULTS.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
