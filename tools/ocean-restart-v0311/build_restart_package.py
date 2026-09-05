#!/usr/bin/env python3
"""Archive the exact supplied R018.11 candidate, evidence and complete legacy handoff.
No deployment and no runtime changes. All repository reads use immutable commits.
"""
from pathlib import Path, PurePosixPath
import argparse, hashlib, io, json, re, shutil, subprocess, sys, tarfile, tempfile, zipfile

BASE = '00329cd78bfeb5bc8b5a1061a1ad6f5154dcdab5'
PAGES = '5cbef6aa5469de6dd729cae3b89a4694c5a39d62'
BRANCH = 'handoff/ocean-mother-full-20260905-v0.3.11'
NAME = 'Ocean_Mother_Full_Restart_Handoff_2026-09-05_V0.3.11'
OLDNAME = 'Ocean_Mother_Full_Restart_Handoff_2026-09-03_V0.3.0'
INPUT_SHA = '60d85ccf34f8dcf9843782060d21654ecb7dce60907047c86a858cb9b3e5ed44'
LEGACY_SHA = '3db114c056f5aa232cbe99151f9385e7b3a4483a6a14a9ad620de8b827ab24fe'
QA_SHA = '7c0bce53c467ba8a87a869ff19c9c6b883c55a10e4565b09aee2930a189079d5'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def write(root, name, data):
    rel = PurePosixPath(name)
    check(not rel.is_absolute() and '..' not in rel.parts, 'Unsafe archive path')
    p = root / name
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(data.encode('utf-8') if isinstance(data, str) else data)


def jsvalue(page, name):
    m = re.search(r'const ' + re.escape(name) + r'=("(?:[^"\\]|\\.)*");', page)
    check(m is not None, 'Missing ' + name)
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--repo', type=Path, default=Path('.'))
    ap.add_argument('--output', type=Path, default=Path('dist'))
    ap.add_argument('--local-inputs', type=Path)
    args = ap.parse_args()
    repo = args.repo.resolve()
    out = args.output.resolve()
    root = out / NAME
    check(not root.exists(), 'Output already exists; choose a fresh output directory')
    root.mkdir(parents=True)
    here = Path(__file__).resolve().parent
    payload = (here / 'r01811_inputs.tar.xz').read_bytes()
    check(sha(payload) == INPUT_SHA, 'Input archive hash mismatch')
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:xz') as t:
        for member in t.getmembers():
            check(member.isfile(), 'Only regular seed files allowed')
            name = member.name[5:] if member.name.startswith('docs/') else member.name
            write(root, name, t.extractfile(member).read())

    def get(ref, path):
        if args.local_inputs:
            return (args.local_inputs / ref / path).read_bytes()
        return subprocess.check_output(['git','show',ref + ':' + path], cwd=repo)

    prior = get(PAGES, 'ocean-mother/island-r018-r01810/index.html')
    patch = json.loads((root / 'tools/r01811.delta.json').read_text(encoding='utf-8'))
    check(sha(prior) == patch['sourceSha256'], 'R018.10 base hash mismatch')
    position = 0
    chunks = []
    for start, end, text in patch['edits']:
        check(position <= start <= end <= len(prior), 'Invalid delta ordering')
        chunks.extend([prior[position:start], text.encode('utf-8')])
        position = end
    candidate = b''.join(chunks) + prior[position:]
    check(sha(candidate) == patch['outputSha256'], 'R018.11 result hash mismatch')
    check(len(candidate) == patch['outputBytes'] == 138544, 'R018.11 size mismatch')
    write(root, 'index.html', candidate)
    write(root, 'history/R018.10_Direct_Open.html', prior)
    text = candidate.decode('utf-8')
    deep = jsvalue(text, 'ORIGINAL_DEEP_HTML').encode('utf-8')
    check(deep == jsvalue(prior.decode(), 'ORIGINAL_DEEP_HTML').encode(), 'Deep source changed')
    write(root, 'frozen-deep/Original_Deep_V001.html', deep)
    frozen = {}
    for name, ext in [('VERT','vert'),('FRAG','frag')]:
        expr = r'const ' + name + r'=`(.*?)`;'
        current = re.search(expr, text, re.S).group(1).encode()
        check(current == re.search(expr, prior.decode(), re.S).group(1).encode(), name + ' changed')
        frozen[name] = sha(current)
        write(root, 'shaders/nearshore.' + ext, current)

    source = text
    blocks = list(re.finditer(r'<script(?:\s[^>]*)?>(.*?)</script>', text, re.S | re.I))
    check(len(blocks) == 2, 'Unexpected inline script count')
    source_map = []
    for i, block in reversed(list(enumerate(blocks))):
        marker = '{{OCEAN_INLINE_BLOCK_' + str(i) + '}}'
        fn = 'inline-' + str(i) + '.js'
        write(root, 'source/' + fn, block.group(1))
        source = source[:block.start(1)] + marker + source[block.end(1):]
        source_map.append({'marker':marker,'file':fn})
    write(root, 'source/page.template.html', source)
    write(root, 'source/source-map.json', json.dumps({'blocks':list(reversed(source_map))}, indent=2)+'\n')

    legacy = get(BASE, 'ocean-mother/handoffs/' + OLDNAME + '.zip')
    check(sha(legacy) == LEGACY_SHA, 'Legacy archive hash mismatch')
    write(root, 'history/V030_ORIGINAL.zip', legacy)
    with zipfile.ZipFile(io.BytesIO(legacy)) as z:
        check(z.testzip() is None, 'Legacy ZIP CRC failure')
        prefix = OLDNAME + '/'
        oldfiles = {}
        for entry in z.infolist():
            check(entry.filename.startswith(prefix), 'Unexpected legacy root')
            if entry.is_dir():
                continue
            rel = entry.filename[len(prefix):]
            check(rel not in oldfiles, 'Duplicate archive entry')
            oldfiles[rel] = z.read(entry.filename)
            write(root, 'history/v030/' + rel, oldfiles[rel])
            if rel.startswith('ocean-mother/v001/'):
                write(root, 'frozen-deep/modular/' + rel[len('ocean-mother/v001/'):], oldfiles[rel])
        oldmanifest = json.loads(oldfiles['MANIFEST.json'])['files']
        for rel, spec in oldmanifest.items():
            check(rel in oldfiles and sha(oldfiles[rel]) == spec['sha256'] and len(oldfiles[rel]) == spec['bytes'], 'Legacy manifest mismatch: ' + rel)
        audit = {'originalZipSha256':LEGACY_SHA,'actualFileCount':len(oldfiles),
                 'manifestListedFiles':len(oldmanifest),'listedFileHashesMatched':True,
                 'unlistedFiles':sorted(set(oldfiles)-set(oldmanifest)), 'originalBytesUnmodified':True}
        write(root, 'evidence/LEGACY_ARCHIVE_AUDIT.json', json.dumps(audit, indent=2)+'\n')

    for rel in ['AGENTS.md','OCEAN_OUTPUT_POLICY.json','WORKING_STATE.md','RESTART_START_HERE.md','R01810_RUNTIME_RECEIPT.json']:
        data = get(BASE, 'ocean-mother/' + rel)
        write(root, 'history/repository/' + rel, data)
    # Preserve current policy and add only this handoff's scope, not a new visual policy.
    policy = json.loads((root/'history/repository/OCEAN_OUTPUT_POLICY.json').read_text())
    policy['handoffScope'] = {'packageVersion':'0.3.11','runtimeModifiedDuringPackaging':False,
                              'packageExplicitlyRequested':True,'deployWebsite':False}
    write(root, 'OCEAN_OUTPUT_POLICY.json', json.dumps(policy, ensure_ascii=False, indent=2)+'\n')
    original_qa = (root/'evidence/R01811_RECOVERY_QA_INHERITED.json').read_bytes()
    check(sha(original_qa) == QA_SHA, 'Inherited recovery QA original bytes changed')
    qa = json.loads(original_qa)
    check(qa['htmlSha256'] == sha(candidate), 'Inherited QA build mismatch')
    for case in qa['cases'].values():
        check(case['navigation'].startswith('in-memory HTML'), 'Recheck inherited QA qualification')
    check(not re.search(r'https?://|data:image/|\.png\b|\.jpe?g\b|\.webp\b|\.glb\b|\.gltf\b', text, re.I), 'External visual/runtime asset reference')
    check('fieldSupported=false' in text, 'Recheck dormant field path')
    write(root, 'tools/build_restart_package.py', Path(__file__).read_bytes())
    write(root, 'tools/r01811_inputs.tar.xz', payload)

    for block in source_map:
        subprocess.run(['node','--check',str(root/'source'/block['file'])], check=True, capture_output=True)
    deepblocks = re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>', deep.decode(), re.S | re.I)
    with tempfile.TemporaryDirectory() as td:
        for i, code in enumerate(deepblocks):
            fn = Path(td)/('deep-' + str(i) + '.js');fn.write_text(code)
            subprocess.run(['node','--check',str(fn)], check=True, capture_output=True)
    sys.path.insert(0, str(root/'tools'))
    from build_single_html import build
    from verify_package import verify, repack
    with tempfile.TemporaryDirectory() as td:
        check(build(root, Path(td)/'index.html') == sha(candidate), 'Rebuild failed')
    check(all(p.suffix.lower() not in {'.png','.jpg','.jpeg','.webp','.gif','.glb','.gltf','.fbx','.exr','.hdr'} for p in root.rglob('*') if p.is_file()), 'Visual asset in archive')
    for cache in root.rglob('__pycache__'):
        shutil.rmtree(cache)

    lock = {'repository':'haihao0307/guilin-dem-pipeline','sourceCommit':BASE,'historicalPagesCommit':PAGES,
            'archiveBranch':BRANCH,'runtimeVersion':'0.3.11-island-r018-gpu-recovery',
            'runtimeSha256':sha(candidate),'runtimeBytes':len(candidate),'baseRuntimeSha256':sha(prior),
            'originalDeepHtmlSha256':sha(deep),'nearshoreShaderSha256':frozen,
            'legacyZipSha256':LEGACY_SHA,'inheritedRecoveryQaSha256':QA_SHA,'seedSha256':INPUT_SHA}
    write(root, 'SOURCE_LOCK.json', json.dumps(lock, ensure_ascii=False, indent=2)+'\n')
    handoff = {'format':'ocean-mother-full-restart','packageVersion':'0.3.11','runtimeVersion':lock['runtimeVersion'],
               'buildId':'r01811-bounded-gpu-context-recovery','runtimeEntry':'index.html','runtimeSha256':sha(candidate),
               'state':'recovery-candidate-not-final','readingOrder':['START_HERE.md','AGENTS.md','WORKING_STATE.md','OCEAN_HANDOFF.md','SOURCE_LOCK.json','NEXT_ROUND_START_HERE.md'],
               'frozenScope':['original deep V001','island','sand','rocks','fire','smoke','camera presets','rotation controls'],
               'nextWork':['hardware stability and performance','real URL/file opening','foam appearance','visible curling waves','deep roundtrip regression'],
               'inheritedQa':{'file':'evidence/R01811_RECOVERY_QA_INHERITED.json','hashMatched':True,'loadMode':'in-memory HTML','freshBrowserRerun':False},
               'websiteDeployedInThisHandoff':False,'visualApproved':False,'productionApproved':False,'hardwareGPUVerified':False}
    write(root, 'HANDOFF.json', json.dumps(handoff, ensure_ascii=False, indent=2)+'\n')
    checks = {'format':'ocean-handoff-static-qa','passed':True,'runtimeBytesUnchanged':True,'htmlSha256':sha(candidate),
              'sourceRoundtrip':True,'outerScriptsSyntaxChecked':len(blocks),'deepScriptsSyntaxChecked':len(deepblocks),
              'originalDeepUnchanged':True,'nearshoreShadersUnchanged':True,'inheritedQABytesUnchanged':True,
              'legacyFileHashesMatched':True,'legacyActualFiles':len(oldfiles),'runtimeImageAssets':0,
              'browserRerunPerformed':False,'hardwareGPUVerified':False,'visualApproved':False,'productionApproved':False}
    write(root, 'evidence/PACKAGE_STATIC_QA.json', json.dumps(checks, indent=2)+'\n')
    files = {p.relative_to(root).as_posix():{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
             for p in sorted(root.rglob('*')) if p.is_file()}
    manifest = {'format':'ocean-mother-full-restart-manifest','packageName':NAME,'packageVersion':'0.3.11',
                'runtimeSha256':sha(candidate),'fileCountExcludingManifest':len(files),'files':files}
    write(root, 'MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    validation = verify(root)
    archive = out/(NAME+'.zip')
    repack(root, archive)
    check(zipfile.ZipFile(archive).testzip() is None, 'Final ZIP CRC failure')
    receipt = {'packageName':NAME,'packageVersion':'0.3.11','zipBytes':archive.stat().st_size,'zipSha256':sha(archive.read_bytes()),
               'fileCountIncludingManifest':len(files)+1,'manifestSha256':sha((root/'MANIFEST.json').read_bytes()),
               'runtimeSha256':sha(candidate),'runtimeBytes':len(candidate),'archiveBranch':BRANCH,
               'packageValidation':validation,'websiteDeployed':False,'visualApproved':False,'productionApproved':False}
    (out/(NAME+'.sha256')).write_text(receipt['zipSha256']+'  '+NAME+'.zip\n')
    (out/(NAME+'.manifest.json')).write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(receipt, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
