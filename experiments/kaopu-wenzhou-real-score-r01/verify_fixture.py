import json, math, pathlib
p = pathlib.Path(__file__).with_name('FIXTURE_R01.json')
d = json.loads(p.read_text(encoding='utf-8'))
checks=[]
def check(name, cond):
    checks.append((name, bool(cond)))

check('official name', d['semanticIdentity']['officialName'] == '靠谱')
check('machine id', d['semanticIdentity']['machineId'] == 'KAOPU')
check('R1 freeze', d['semanticIdentity']['semanticFreezeR1'] == 'cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330')
check('append only', d['semanticIdentity']['appendOnly'] is True)
check('rollback', d['rollback']['commit'] == 'f254721b7e3e23cb35b7b660fa9441dc6cef9796')
check('discrete object', d['discreteObject']['objectGraphEligible'] is True)
check('continuous field typed', d['continuousField']['quantityKind'] == 'relative-mean-sea-level' and d['continuousField']['unit'] == 'cm')
roots=d['observationRoots']
check('two roots', len(roots)==2)
check('root ids distinct', len({r['rootId'] for r in roots})==2)
check('root modalities distinct', len({r['modality'] for r in roots})==2)
check('root physical families distinct', len({r['physicalObservationFamily'] for r in roots})==2)
t=d['timeChange']
check('time ordered', t['t0']['year'] < t['t1']['year'])
check('time delta', math.isclose(t['t1']['value']-t['t0']['value'], t['delta'], abs_tol=1e-9) and math.isclose(t['delta'],19.4,abs_tol=1e-9))
c=d['conflictOrUnknown']
check('cross root discrepancy preserved', not math.isclose(c['tideGaugeTrendMmPerYr']['value'], c['satelliteAltimetryTrendMmPerYr']['value']))
check('unknown present', c['exactStationCoordinates']=='Unknown')
w=d['typedWave']
check('typed wave quantity/unit', w['quantityKind']=='relative-mean-sea-level' and w['unit']=='cm')
check('typed wave has components', len(w['components'])>=1)
check('typed wave phase unknown honest', all(x['phase']=='Unknown' for x in w['components']) and w['reconstructibleFromPublishedNumbersAlone'] is False)
check('residual required', w['residualRequired'] is True)
check('public CBV', d['currentBestView']['policyVisibility']=='public')
b=d['boundaries']
check('no prohibited external agents', b['anthropicCalled'] is False and b['claudeCodeCalled'] is False and b['makeUsedAsLongTermLearningBase'] is False)
check('no production mother modification', b['productionMotherModified'] is False)
check('candidate flags', b['formalKaopuR2Frozen'] is False and b['productionReady'] is False and b['visualAcceptance'] is False and b['candidate'] is True)
failed=[n for n,ok in checks if not ok]
for n,ok in checks:
    print(('PASS' if ok else 'FAIL'), n)
print(f'RESULT {sum(ok for _,ok in checks)}/{len(checks)} checks passed')
if failed:
    raise SystemExit(1)
