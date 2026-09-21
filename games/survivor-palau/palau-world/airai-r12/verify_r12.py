#!/usr/bin/env python3
from __future__ import annotations
import argparse, base64, hashlib, json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
RESULTS = HERE.parent / 'airai-r04' / 'results-r01'
RUNTIME = HERE / 'runtime'

def sha(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1<<20),b''):h.update(b)
    return h.hexdigest()

def load_part(path: Path, dtype):
    text=path.read_text(encoding='utf-8')
    m=re.search(r'=(["].*[\"]);\s*$',text,re.S)
    if not m: raise AssertionError(f'cannot parse {path}')
    payload=json.loads(m.group(1))
    return np.frombuffer(base64.b64decode(payload),dtype=dtype)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--skip-rebuild',action='store_true');args=ap.parse_args()
    m=json.loads((RUNTIME/'manifest.json').read_text(encoding='utf-8'))
    assert m['status']=='CANDIDATE_NOT_SURVEY_TRUTH'
    assert m['visualAcceptance'] is False and m['productionReady'] is False
    assert m['traditionalLOD'] is False and m['worldConductor']=='PalauWorld.sample()'
    assert m['grid']['shape']==[310,310] and m['grid']['resolutionM']==25.0
    assert m['verticalDatum']['soundingDatumName']=='local datum'
    assert m['verticalDatum']['numericTransform']=='NONE'
    assert m['verticalDatum']['mslEquivalence']=='NOT_ASSERTED'
    assert m['counts']['candidateValidCells']==56874
    assert m['counts']['candidateNoDataCells']==39226
    assert m['counts']['depareSupportedCells']==50334
    assert m['counts']['soundingsCore']==392
    assert m['counts']['contourConstraintPointsCore']==663
    assert m['historicalReceiptComparison']['numericReproductionMatch'] is False
    assert 'LINEAGE_DRIFT' in m['historicalReceiptComparison']['interpretation']

    for src in m['sourceIdentity']:
        p=RESULTS/src['path']
        assert p.is_file(),f'missing source {p}'
        assert p.stat().st_size==src['bytes'],f'size drift {p}'
        assert sha(p)==src['sha256'],f'hash drift {p}'
    for part in m['parts']:
        p=RUNTIME/part['path']
        assert p.is_file(),f'missing runtime part {p}'
        assert p.stat().st_size==part['fileBytes']
        assert sha(p)==part['fileSha256']

    depth=load_part(RUNTIME/'grid-depthDm.js','<i2')
    unc=load_part(RUNTIME/'grid-uncertaintyDm.js','<u2')
    support=load_part(RUNTIME/'grid-supportU8.js','u1')
    land=load_part(RUNTIME/'grid-landU8.js','u1')
    assert depth.size==310*310 and unc.size==depth.size
    valid=depth!=-32768
    assert int(valid.sum())==56874
    assert int((~valid).sum())==39226
    assert int(((support>=2)&valid).sum())==50334
    assert int((((support==3)|(support==4))&valid).sum())==m['counts']['depareContradictionCells']
    assert int(((land==1)&valid).sum())==5225
    assert np.all(unc[~valid]==65535)

    node=subprocess.run(['node',str(HERE/'verify_sampler_r12.mjs')],text=True,capture_output=True,check=True)
    sampler=json.loads(node.stdout)
    assert sampler['status']=='PASS'

    deterministic=True; mismatches=[]
    if not args.skip_rebuild:
        with tempfile.TemporaryDirectory(prefix='airai-r12-verify-') as td:
            out=Path(td)/'runtime';out.mkdir()
            subprocess.run([sys.executable,str(HERE/'build_runtime_evidence_r12.py'),'--results',str(RESULTS),'--out',str(out)],check=True,stdout=subprocess.DEVNULL)
            current={p.name:sha(p) for p in RUNTIME.iterdir() if p.is_file()}
            rebuilt={p.name:sha(p) for p in out.iterdir() if p.is_file()}
            mismatches=sorted(k for k in set(current)|set(rebuilt) if current.get(k)!=rebuilt.get(k))
            deterministic=not mismatches
            assert deterministic,f'nondeterministic outputs: {mismatches}'

    result={
        'schema':'kaopu.palau.airai-r12-verification/1.0',
        'status':'PASS',
        'assertions':31,
        'deterministicRebuild':deterministic,
        'mismatches':mismatches,
        'counts':m['counts'],
        'sampler':sampler,
        'historicalReceiptComparison':m['historicalReceiptComparison'],
    }
    print(json.dumps(result,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
