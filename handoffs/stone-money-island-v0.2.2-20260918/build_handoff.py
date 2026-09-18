"""Export the fixed scoped project, validate a clean unzip, and preserve an auditable handoff."""
from pathlib import Path
import os, json, hashlib, subprocess, tempfile, zipfile, datetime
SOURCE='bff5069a9ede793b8714fd9f327903872021a3b8'
ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
NAME='Stone_Money_Island_Survivor_Palau_V0.2.2_FULL_HANDOFF_2026-09-18'
EXPECTED='d37d6fcbbb89184f3a4db40bff3a3a06fb3fb45d15c0c738b4bec8a47e099505'
def git(*args):
    return subprocess.check_output(['git','-C',str(ROOT),*args])
def sha(data):return hashlib.sha256(data).hexdigest()
paths=git('ls-tree','-r','--name-only',SOURCE).decode().splitlines()
fixed={'AGENTS.md','knowledge/REAL_3D_WORKBENCH_ONLY_GATE.md','knowledge/PUBLIC_WEB_DELIVERY_GATE.md','contracts/PRODUCTION_CONTRACT.json','LICENSE','LICENSE.md'}
chosen=[p for p in paths if p.startswith('games/survivor-palau/') or p in fixed or p.startswith('.github/scripts/stone-money-') or p.startswith('.github/workflows/stone-money-')]
assert chosen
files={p:git('show',SOURCE+':'+p) for p in chosen}
files['START_HERE.md']=(HERE/'START_HERE.md').read_bytes()
files['HANDOFF_STATE.json']=(HERE/'HANDOFF_STATE.json').read_bytes()
files['REFERENCE/GAME_LIVING_ISLAND_G05.md']=(HERE/'REFERENCE_G05.md').read_bytes()
entry='games/survivor-palau/releases/v0.2.2/index.html'
assert sha(files[entry])==EXPECTED
proof=json.loads(files['games/survivor-palau/releases/v0.2.2/PUBLICATION_PROOF.json'])
assert proof['shareAllowed'] and proof['entrySha256']==EXPECTED
manifest={'schema':'stone-money-full-handoff-v1','sourceCommit':SOURCE,'packagingCommit':git('rev-parse','HEAD').decode().strip(),'entrySha256':EXPECTED,
          'scope':'games/survivor-palau plus required policy and deployment sources; no unrelated DEM data or private original photos',
          'manifestSelfExcluded':True,'files':[{'path':p,'bytes':len(b),'sha256':sha(b)} for p,b in sorted(files.items())]}
files['MANIFEST.json']=(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n').encode()
archive=HERE/(NAME+'.zip')
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p,b in sorted(files.items()):
        info=zipfile.ZipInfo(NAME+'/'+p,date_time=(2026,9,18,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
        z.writestr(info,b)
commands=[
 ['node','games/survivor-palau/source/v0200/fish_wet_navigation.test.cjs'],
 ['python','games/survivor-palau/source/v0200/build.py'],
 ['python','games/survivor-palau/source/v0200/verify_reef_reference.py']]
checks=[]
with tempfile.TemporaryDirectory() as temp:
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        z.extractall(temp)
    unpack=Path(temp)/NAME
    for item in manifest['files']:
        b=(unpack/item['path']).read_bytes();assert len(b)==item['bytes'] and sha(b)==item['sha256'],item['path']
    for command in commands:
        run=subprocess.run(command,cwd=unpack,capture_output=True,text=True,timeout=120)
        print(run.stdout,flush=True)
        if run.returncode:print(run.stderr,flush=True)
        assert run.returncode==0,command
        checks.append({'command':command,'exitCode':run.returncode})
    assert sha((unpack/entry).read_bytes())==EXPECTED
    rebuilt=json.loads((unpack/'games/survivor-palau/releases/v0.2.2/BUILD_RECEIPT.json').read_text())
    assert rebuilt['frozenShaderAndWorkerStringsUnchanged']
result={'archive':archive.name,'archiveBytes':archive.stat().st_size,'archiveSha256':sha(archive.read_bytes()),
        'fileCount':len(files),'sourceCommit':SOURCE,'packagingCommit':manifest['packagingCommit'],
        'crcPassed':True,'allManifestFilesMatched':True,'cleanUnzipBuildMatched':True,
        'entrySha256':EXPECTED,'frozenSourceUnchanged':True,'commands':checks,
        'browserEvidenceInheritedFromFixedSource':True,'newBrowserRunDuringPackaging':False,
        'physicalDeviceTest':False,'visualAcceptance':False,'productionReady':False,
        'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(HERE/'PACKAGE_VERIFY.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(HERE/(NAME+'.zip.sha256')).write_text(result['archiveSha256']+'  '+archive.name+'\n')
print(json.dumps(result,ensure_ascii=False,indent=2))
