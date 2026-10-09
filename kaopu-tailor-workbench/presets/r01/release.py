"""Release only the isolated P01 directory. Never merge, force-push or rewrite shared refs."""
from pathlib import Path
import concurrent.futures,hashlib,json,os,shutil,subprocess,sys,tempfile,time,urllib.request
P=Path(__file__).resolve().parent
PREFIX='kaopu-tailor-workbench/presets/r01'
BRANCH='feature/tailor-preset-library-20261009'
REPO=P.parents[2]
BASE='https://haihao0307.github.io/guilin-dem-pipeline/'+PREFIX+'/'
SOURCE=os.environ.get('GITHUB_SHA','local')
def run(args,cwd=REPO):return subprocess.check_output(args,cwd=cwd,text=True).strip()
def git(*args,cwd=REPO):return run(['git',*args],cwd)
def save(name,x): (P/name).write_text(json.dumps(x,ensure_ascii=False,indent=2))
def manifest():
    required=['index.html','style.css','app.mjs','worker.mjs','bridge.mjs','library.json','parameter-schema.json','parameter-atlas.json','reference-body.json','SOURCE_LOCK.json']
    required += [str(q.relative_to(P)) for folder in ['vendor','thumbs','data'] for q in sorted((P/folder).rglob('*')) if q.is_file()]
    assert len(json.loads((P/'library.json').read_text())['presets'])==60
    assert json.loads((P/'BUILD_REPORT.json').read_text())['passed']==60
    assert json.loads((P/'BROWSER_REPORT.json').read_text())['passed'] is True
    files={n:hashlib.sha256((P/n).read_bytes()).hexdigest() for n in required}
    save('BUILD_MANIFEST.json',{'version':'P01','sourceCommit':SOURCE,'sourceBaseline':'77992c94278a1e9865e3856c3b7651fe2c3ddbca',
      'publicationOwner':BRANCH,'files':files,'presetCount':60,'physicalFitAccepted':False,'dynamicWearCertified':False})
    print('P01_MANIFEST',len(files),'runtime files',flush=True)
def guard_paths(base,head):
    changes=git('diff','--name-only',base,head).splitlines()
    assert all(p.startswith(PREFIX+'/') for p in changes),changes
    return changes
def retain():
    git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com')
    git('fetch','origin',BRANCH,'--depth=1')
    assert git('rev-parse','origin/'+BRANCH)==SOURCE,'The author branch advanced; do not overwrite another change'
    git('add','--',PREFIX)
    git('commit','-m','build(tailor-presets): retain fully checked P01 paper presets and parameter evidence')
    artifact=git('rev-parse','HEAD');guard_paths(SOURCE,artifact)
    git('push','origin','HEAD:refs/heads/'+BRANCH)
    save('RELEASE_STATE.json',{'sourceCommit':SOURCE,'artifactCommit':artifact,'publicURL':BASE,'publicVerified':False})
    print('P01_ARTIFACT_COMMIT',artifact,flush=True)
def publish():
    state=json.loads((P/'RELEASE_STATE.json').read_text());snapshot=Path(tempfile.mkdtemp(prefix='p01-checked-'))/'r01'
    shutil.copytree(P,snapshot,ignore=shutil.ignore_patterns('__pycache__','*.pyc'))
    work=Path(tempfile.mkdtemp(prefix='p01-pages-'))/'checkout'
    git('fetch','origin','gh-pages','--depth=1');git('worktree','add','--detach',str(work),'origin/gh-pages')
    success=None
    try:
        for attempt in range(4):
            git('fetch','origin','gh-pages','--depth=1');git('checkout','--detach','origin/gh-pages',cwd=work)
            before=git('rev-parse','HEAD',cwd=work);target=work/PREFIX
            if target.exists() and (target/'BUILD_MANIFEST.json').exists():
                old=json.loads((target/'BUILD_MANIFEST.json').read_text());assert old.get('publicationOwner')==BRANCH,'P01 path is owned by another line'
            shutil.copytree(snapshot,target,dirs_exist_ok=True)
            git('add','--',PREFIX,cwd=work)
            changed=git('diff','--cached','--name-only',cwd=work).splitlines();assert changed and all(p.startswith(PREFIX+'/') for p in changed)
            git('commit','-m','publish(tailor-presets): add independently tested P01 without changing R073 or old workbenches',cwd=work)
            after=git('rev-parse','HEAD',cwd=work)
            try:git('push','origin','HEAD:refs/heads/gh-pages',cwd=work);success=after;break
            except subprocess.CalledProcessError:
                if attempt==3:raise
                time.sleep(2)
        assert success
        state.update({'publicationCommit':success,'publicVerified':False});save('RELEASE_STATE.json',state)
        print('P01_PUBLICATION_COMMIT',success,flush=True)
        print('P01_WAITING_FOR_PAGES_DEPLOYMENT',BASE,flush=True)
    finally:
        git('worktree','remove',str(work));shutil.rmtree(snapshot.parent,ignore_errors=True)
def verify_public():
    expected=json.loads((P/'BUILD_MANIFEST.json').read_text())
    def fetch(name):
        req=urllib.request.Request(BASE+name,headers={'Cache-Control':'no-cache','User-Agent':'KAOPU-P01-DeliveryCheck'})
        with urllib.request.urlopen(req,timeout=60) as r:return r.read()
    found=False
    for _ in range(72):
        try:
            live=json.loads(fetch('BUILD_MANIFEST.json?check='+str(time.time())))
            if live.get('sourceCommit')==SOURCE:found=True;break
        except Exception:pass
        time.sleep(10)
    assert found,'Checked P01 source did not reach GitHub Pages; delivery incomplete'
    def checked(item):
        name,digest=item;actual=hashlib.sha256(fetch(name)).hexdigest();assert actual==digest,(name,actual,digest);return name
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:paths=list(pool.map(checked,expected['files'].items()))
    save('PUBLIC_BYTES.json',{'sourceCommit':SOURCE,'verifiedFiles':len(paths),'paths':paths,'allSHA256Match':True})
    print('P01_PUBLIC_BYTES',len(paths),'all SHA256 match',flush=True)
def retain_public():
    report=json.loads((P/'PUBLIC_REPORT.json').read_text());assert report['passed'] is True
    state=json.loads((P/'RELEASE_STATE.json').read_text());state['publicVerified']=True;save('RELEASE_STATE.json',state)
    git('fetch','origin',BRANCH,'--depth=1');assert git('rev-parse','origin/'+BRANCH)==git('rev-parse','HEAD'),'Author branch advanced; keep evidence without overwriting'
    git('add','--',PREFIX+'/PUBLIC_REPORT.json',PREFIX+'/PUBLIC_BYTES.json',PREFIX+'/RELEASE_STATE.json',PREFIX+'/qa/public')
    git('commit','-m','docs(tailor-presets): retain actual public browser checks and explicit non-clothing limits')
    git('push','origin','HEAD:refs/heads/'+BRANCH)
    print('P01_FINAL_EVIDENCE_COMMIT',git('rev-parse','HEAD'),flush=True)
if __name__=='__main__':
    {'manifest':manifest,'retain':retain,'publish':publish,'verify':verify_public,'retain-public':retain_public}[sys.argv[1]]()
