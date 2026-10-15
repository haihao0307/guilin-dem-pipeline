"""Publish identical verified files with compressed Git transport on a new branch."""
from pathlib import Path
import subprocess,json,os,hashlib
P=Path(__file__).resolve().parents[1];REPO='haihao0307/guilin-dem-pipeline';PARENT='2a1ef685175c2fba60e31d969867eef7f66cef69';BRANCH='feature/hair-character-r04-20261015';PREFIX='kaopu-hair-workbench/research/hair-character-r04'
env=dict(os.environ,GCM_INTERACTIVE='Never',GIT_TERMINAL_PROMPT='0',HAIR_PUBLISH_LIST_ONLY='1')
subprocess.run(['python',str(P/'tools/publish.py')],cwd=P,env=env,check=True,timeout=90)
paths=json.loads((P/'qa/publish-files.json').read_text());repo=P/'.publish.git';gitEnv=dict(env,GIT_INDEX_FILE=str(P/'qa/publish-index'))
def git(*args,input=None):
 r=subprocess.run(['git','--git-dir='+str(repo),*args],input=input,capture_output=True,env=gitEnv,timeout=240)
 if r.returncode:raise RuntimeError(r.stderr.decode('utf-8','replace')[-2500:])
 return r.stdout.decode().strip()
if not repo.exists():
 subprocess.run(['git','init','--bare',str(repo)],check=True,capture_output=True)
 git('remote','add','origin','https://github.com/'+REPO+'.git')
print('Fetching the fixed parent without historical file contents',flush=True)
git('-c','protocol.version=2','fetch','--filter=blob:none','--depth=1','origin',PARENT)
git('read-tree','--reset',PARENT)
for relative in paths:
 data=(P/relative).read_bytes();sha=git('hash-object','-w','--stdin',input=data);git('update-index','--add','--cacheinfo','100644',sha,PREFIX+'/'+relative)
print('Preparing additive commit',flush=True)
tree=git('write-tree');commit=git('-c','user.name=Codex','-c','user.email=codex@local','commit-tree',tree,'-p',PARENT,'-m','Add two procedural full hairstyles bound to the existing character platform')
print('Pushing the isolated review branch with compressed Git objects',flush=True)
print(git('push','origin',commit+':refs/heads/'+BRANCH),flush=True)
manifest=json.loads((P/'BUILD_MANIFEST.json').read_text());urls={s:f'https://htmlpreview.github.io/?https://raw.githubusercontent.com/{REPO}/{commit}/{PREFIX}/public-{s}.html' for s in ['medium','long']}
publication={'repository':REPO,'branch':BRANCH,'commit':commit,'parent':PARENT,'prefix':PREFIX,'previewURLs':urls,'sourceURL':f'https://github.com/{REPO}/tree/{commit}/{PREFIX}','mainUpdated':False,'originalCharacterBranchUpdated':False,'fileCount':len(paths),'transport':'compressed Git pack','htmlHashes':{s:json.loads((P/'PUBLIC_BUILD.json').read_text())['wrappers'][s]['sha256'] for s in ['medium','long']}}
(P/'PUBLICATION.json').write_text(json.dumps(publication,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(publication),flush=True)
