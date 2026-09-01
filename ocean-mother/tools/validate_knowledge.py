#!/usr/bin/env python3
"""Static knowledge gate only. Does not run a renderer or a physics solver."""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

REQUIRED = (
    'AGENTS.md', 'README.md', 'skills/ocean-math-physics/SKILL.md',
    'contracts/OCEAN_KNOWLEDGE_CONTRACT.json',
    'research/R002_SOURCE_BOUNDARIES.json',
    'research/R001_WATER_SKY_DISTILLATION.md', 'tasks/CODEX_O1B_O2A.md',
    'bridge-v1/UPSTREAM_LOCK.json',
)
ZERO_RULES = ('importedImages','storedTextureImages','generatedTextureImages',
              'embeddedImages','bakedNormalMaps','bakedNoiseMaps',
              'bakedEnvironmentMaps','externalProductLabels')
FALSE_RULES = ('externalDemoCodeCopied','upstreamKernelMutable',
               'terrainTruthMutable','rewriteGitHistory')
TEXT_EXTENSIONS = {'.md','.json','.py','.js','.mjs','.cjs','.glsl','.html','.css','.txt','.yml','.yaml'}
REFERENCE = '2619725efe236d2df8f2a55031bdae9e60a51555'
EXPECTED_SKILLS = {'OM-M01','OM-M02','OM-M03','OM-P01','OM-P02','OM-P03','OM-P04','OM-R01'}

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def check(root: Path, upstream: Path | None = None) -> dict:
    root = root.resolve()
    failures: list[dict] = []
    files_checked = 0
    known_label_hits = 0
    def error(code: str, path: str = '') -> None:
        failures.append({'code': code, 'path': path})
    for name in REQUIRED:
        if not (root/name).is_file():
            error('MISSING_REQUIRED_FILE', name)
    try:
        c = json.loads((root/REQUIRED[3]).read_text('utf-8'))
        evidence = json.loads((root/REQUIRED[4]).read_text('utf-8'))
        lock = json.loads((root/'bridge-v1/UPSTREAM_LOCK.json').read_text('utf-8'))
    except (OSError, UnicodeError, ValueError) as exc:
        return {'passed':False,'failures':failures+[{'code':'UNREADABLE_CONTRACT','errorType':type(exc).__name__}], 'scope':'static_knowledge_only'}
    if c.get('format') != 'ocean-mother-knowledge-contract' or c.get('schemaVersion') != 1:
        error('UNSUPPORTED_CONTRACT')
    if c.get('scope') != 'knowledge_distillation_only':
        error('DISTILLATION_SCOPE_CHANGED')
    if c.get('upstreamPublicationRef') != REFERENCE or lock.get('publicationRef') != REFERENCE:
        error('UPSTREAM_REF_CHANGED')
    if c.get('axes') != {'east':'+X','up':'+Y','north':'-Z'}:
        error('AXES_CHANGED')
    p = c.get('policy', {})
    for key in ZERO_RULES:
        if type(p.get(key)) is not int or p[key] != 0:
            error('ZERO_POLICY_CHANGED', key)
    for key in FALSE_RULES:
        if p.get(key) is not False:
            error('PROTECTED_POLICY_CHANGED', key)
    expected_claims = ('newOceanRuntimeImplementedThisTurn','buoyancySolverImplemented',
                       'collisionSolverImplemented','publicDeploymentVerified','visualAcceptance','productionReady')
    for key in expected_claims:
        if c.get('claims',{}).get(key) is not False:
            error('UNSUPPORTED_COMPLETION_CLAIM', key)
    if c.get('enforcement',{}).get('ciWired') is not False:
        error('UNSUPPORTED_CI_CLAIM')
    expected_capabilities = {'aabbOverlapEvents':True,'buoyancy':False,
        'rigidBodyContactSolver':False,'ccd':False,'textureFreeWater':False}
    if c.get('sourceArticleCapabilities') != expected_capabilities:
        error('SOURCE_SCOPE_MISATTRIBUTED')
    sources = evidence.get('sources', [])
    ids = {s.get('id') for s in sources if isinstance(s,dict)}
    if len(ids) != len(sources) or not {'E01','E02','E03','E04','E05','E06','E07','P01','U01'}.issubset(ids):
        error('INVALID_EVIDENCE_IDS')
    for source in sources:
        if not all(source.get(k) for k in ('id','sourceClass','readStatus','supports','doesNotSupport')):
            error('INCOMPLETE_SOURCE_BOUNDARY',str(source.get('id')))
    items = c.get('skills', [])
    if len(items) != 8 or {s.get('id') for s in items} != EXPECTED_SKILLS:
        error('SKILL_REGISTRY_CHANGED')
    for s in items:
        name = str(s.get('id'))
        for field in ('name','evidence','knowledgeKinds','inputs','outputs','equations','limitations','acceptanceTests'):
            if not s.get(field):
                error('INCOMPLETE_SKILL',name+':'+field)
        if not set(s.get('evidence',[])).issubset(ids):
            error('MISSING_EVIDENCE_REFERENCE',name)
        for field in ('runtimeImplemented','physicsValidated','browserValidated'):
            if s.get(field) is not False:
                error('KNOWLEDGE_IS_NOT_RUNTIME_PROOF',name+':'+field)
    forbidden = set(p.get('brandTokenSha256',[]))
    if not forbidden or any(not re.fullmatch('[a-f0-9]{64}',x) for x in forbidden):
        error('INVALID_LABEL_FINGERPRINTS')
    max_words = p.get('brandTokenMaxWords',4)
    if type(max_words) is not int or not 1 <= max_words <= 8:
        error('INVALID_LABEL_WINDOW'); max_words = 4
    embedded_pattern = re.compile(r'data\s*:\s*' + r'image\s*/', re.I)
    loader_pattern = re.compile(r'new\s+(?:\w+\.)?(?:TextureLoader|ImageBitmapLoader|CubeTextureLoader|RGBELoader|EXRLoader|HDRLoader)\s*\(')
    frozen_local_checked = 0
    for name, expected in c.get('frozenLocalFilesSha256',{}).items():
        q=root/name
        if not q.is_file() or sha256(q.read_bytes()) != expected:
            error('FROZEN_LOCAL_FILE_CHANGED',name)
        else:
            frozen_local_checked += 1
    for f in sorted(root.rglob('*')):
        if '__pycache__' in f.parts or '.git' in f.parts:
            continue
        rel = f.relative_to(root).as_posix()
        if f.is_symlink():
            error('SYMLINK_NOT_AUDITED',rel);continue
        if not f.is_file():
            continue
        files_checked += 1
        if f.suffix.lower() not in TEXT_EXTENSIONS:
            error('NON_TEXT_ASSET_FORBIDDEN',rel);continue
        data=f.read_bytes()
        if data.startswith((b'\x89PNG',b'\xff\xd8\xff',b'GIF87a',b'GIF89a',b'RIFF',b'PK\x03\x04')):
            error('BINARY_IMAGE_OR_ARCHIVE_FORBIDDEN',rel);continue
        try:
            text=data.decode('utf-8')
        except UnicodeError:
            error('BINARY_PAYLOAD_FORBIDDEN',rel);continue
        if embedded_pattern.search(text):
            error('EMBEDDED_IMAGE_FORBIDDEN',rel)
        if f.suffix.lower() in {'.js','.mjs','.cjs','.html'} and loader_pattern.search(text):
            error('IMAGE_LOADER_FORBIDDEN',rel)
        words=re.findall('[a-z0-9]+',(rel+' '+text).lower())
        found=False
        for width in range(1,max_words+1):
            if found:break
            for i in range(len(words)-width+1):
                if sha256(' '.join(words[i:i+width]).encode()) in forbidden:
                    known_label_hits+=1;error('EXTERNAL_LABEL_FORBIDDEN',rel);found=True;break
    upstream_checked = 0
    if upstream is not None:
        expected=dict(lock.get('runtime',{}))
        expected['MANIFEST.json']=lock.get('manifest',{})
        expected['HANDOFF.json']=lock.get('handoff',{})
        if len(expected) != 8:
            error('INVALID_UPSTREAM_LOCK')
        for name,identity in expected.items():
            q=upstream/name
            if not q.is_file():error('UPSTREAM_MISSING',name);continue
            data=q.read_bytes()
            if len(data)!=identity.get('bytes') or sha256(data)!=identity.get('sha256'):
                error('UPSTREAM_IDENTITY_MISMATCH',name)
            else:upstream_checked+=1
    return {'passed':not failures,'scope':'static_knowledge_only','filesChecked':files_checked,
        'knownExternalLabelHits':known_label_hits,'frozenLocalFilesChecked':frozen_local_checked,
        'upstreamFilesChecked':upstream_checked,'upstreamCheckRequested':upstream is not None,
        'failures':failures,'runtimeOrPhysicsVerified':False,'browserVerified':False,'ciWired':False}

def main() -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
    parser.add_argument('--upstream-dir',type=Path)
    args=parser.parse_args()
    report=check(args.root,args.upstream_dir)
    print(json.dumps(report,ensure_ascii=False,indent=2))
    return 0 if report['passed'] else 1

if __name__=='__main__':
    raise SystemExit(main())
