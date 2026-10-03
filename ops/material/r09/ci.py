import os,sys,json,base64,hashlib,time,subprocess,urllib.request,urllib.error
from pathlib import Path
REPO='haihao0307/guilin-dem-pipeline';API='https://api.github.com/repos/'+REPO
TOKEN=os.environ['GH_TOKEN'];ROOT=Path('build_material_r09');SRC=ROOT/'src';BASE=ROOT/'baseline';HERE=Path('ops/material/r09')
def api(method,path,data=None):
 req=urllib.request.Request(API+path,data=None if data is None else json.dumps(data).encode(),headers={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},method=method)
 for i in range(4):
  try:
   with urllib.request.urlopen(req,timeout=60) as r:return json.load(r)
  except urllib.error.HTTPError as e:
   if e.code>=500 and i<3:time.sleep(3);continue
   raise

def blob(sha):
 d=api('GET','/git/blobs/'+sha);b=base64.b64decode(d['content']);assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==sha;return b

def publish(branch,items,message,guard_root=False):
 entries=[]
 for name,data in items.items():
  assert name.startswith('kaopu-material-workbench/') and '..' not in name.split('/'),name
  h=api('POST','/git/blobs',{'content':data.decode('utf-8'),'encoding':'utf-8'})['sha'];entries.append({'path':name,'mode':'100644','type':'blob','sha':h})
 for attempt in range(4):
  head=api('GET','/git/ref/heads/'+branch)['object']['sha'];tree=api('GET','/git/commits/'+head)['tree']['sha']
  if guard_root:
   current=api('GET','/contents/kaopu-material-workbench/index.html?ref='+head)['sha']
   expected='df66cd0ec4918cfd07f74c530a2747334412738e'
   future=hashlib.sha1(('blob '+str(len(items['kaopu-material-workbench/index.html']))+'\0').encode()+items['kaopu-material-workbench/index.html']).hexdigest()
   if current not in [expected,future]:raise RuntimeError('Current material root changed independently; refusing to overwrite '+current)
  new_tree=api('POST','/git/trees',{'base_tree':tree,'tree':entries})['sha']
  commit=api('POST','/git/commits',{'message':message,'tree':new_tree,'parents':[head]})['sha']
  try:
   api('PATCH','/git/refs/heads/'+branch,{'sha':commit,'force':False});return commit
  except urllib.error.HTTPError as e:
   if e.code not in [409,422] or attempt==3:raise
   time.sleep(2)

def build():
 SRC.mkdir(parents=True,exist_ok=True);BASE.mkdir(parents=True,exist_ok=True)
 originals={'app.js':'01149944a2032ff5352f8c524b358307956051e3','teacher.frag':'fa564ebdf4a5642289e6123c54ae6c58d9bc6201','material.glsl':'9d2a6e0b4f5a3a1f3d83c79a3756e5b7dd75c18f','iq-teacher.txt':'1f133e39ae5509205df51f7ed17def79c549e2d0'}
 for n,h in originals.items():(BASE/n).write_bytes(blob(h))
 for n in ['index.html','app.js','ui.css','NOTES.md']:(SRC/n).write_bytes((HERE/n).read_bytes())
 subprocess.run(['node',str(HERE/'prepare_frozen.js'),str(BASE)],check=True)
 subprocess.run(['python3',str(HERE/'build_shaders.py')],check=True)
 expected={'app.js':'b67c666a8fb2651b303a457ab48a3d89eacea213efba1cf74005b11b1ab2551e','ui.css':'4ef66e74ac1a77195d7658aff892dd2693438124e6448f397c081df92c92f6a0','index.html':'ff434393a2ad68c87fa96266079cbdf8b55e6edaadc5e7905c55125cff95305d'}
 for n,h in expected.items():assert hashlib.sha256((SRC/n).read_bytes()).hexdigest()==h,n
 manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in SRC.iterdir() if p.is_file()}
 (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2));(SRC/'SOURCE_MANIFEST.json').write_text(json.dumps(manifest,indent=2))
 # Companion standalone remains the same tested source, not another renderer.
 html=(SRC/'index.html').read_text().replace('<link rel="stylesheet" href="ui.css">','<style>'+(SRC/'ui.css').read_text()+'</style>')
 bundle={p.name:p.read_text() for p in SRC.glob('*.frag')}
 html=html.replace('<script src="app.js"></script>','<script>window.KAOPU_BUNDLE='+json.dumps(bundle,ensure_ascii=False).replace('</','<\\/')+';</script><script>'+(SRC/'app.js').read_text().replace('</script','<\\/script')+'</script>')
 (ROOT/'R09_STANDALONE.html').write_text(html)
 stage=publish('gh-pages',{'kaopu-material-workbench/lab-r09/'+p.name:p.read_bytes() for p in SRC.iterdir() if p.is_file()},'stage(material): R09 original 01 plus merged IQ; original source hashes reproduced, no R08 geometry')
 (ROOT/'stage_commit.txt').write_text(stage);print('STAGED_COMMIT='+stage)

def promote():
 proof=json.loads(Path('evidence/STAGE_PROOF.json').read_text());assert proof['shareAllowed'],proof
 html=(SRC/'index.html').read_text().replace('href="ui.css"','href="lab-r09/ui.css"').replace('src="app.js"','src="lab-r09/app.js"').encode()
 assert hashlib.sha256(html).hexdigest()=='581ba66fffb396d1ea158e13de4a0013174c9607a91d923985349d2fad37bb5e'
 (ROOT/'root-index.html').write_bytes(html)
 items={'kaopu-material-workbench/index.html':html,'kaopu-material-workbench/history/hub-rejected-r08.1.html':blob('df66cd0ec4918cfd07f74c530a2747334412738e')}
 head=publish('gh-pages',items,'promote(material): restore accepted Wet Stone and IQ originals; R09 stage visual regression and browser checks passed',guard_root=True)
 (ROOT/'promote_commit.txt').write_text(head);print('PROMOTED_COMMIT='+head)

def archive():
 proof=json.loads(Path('evidence/PUBLICATION_PROOF.json').read_text());assert proof['shareAllowed'],proof
 proof['stage_commit']=(ROOT/'stage_commit.txt').read_text();proof['promote_commit']=(ROOT/'promote_commit.txt').read_text()
 proof['stage_proof']=json.loads(Path('evidence/STAGE_PROOF.json').read_text());Path('evidence/PUBLICATION_PROOF.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2))
 items={'kaopu-material-workbench/lab-r09/'+p.name:p.read_bytes() for p in SRC.iterdir() if p.is_file()}
 items['kaopu-material-workbench/lab-r09/PUBLICATION_PROOF.json']=Path('evidence/PUBLICATION_PROOF.json').read_bytes()
 items['kaopu-material-workbench/lab-r09/R09_STANDALONE.html']=(ROOT/'R09_STANDALONE.html').read_bytes()
 items['kaopu-material-workbench/index.html']=(ROOT/'root-index.html').read_bytes()
 head=publish('main',items,'archive(material): exact tested R09 source and public browser proof; rejected R08 is not the baseline')
 print('ARCHIVE_COMMIT='+head);print(json.dumps(proof,ensure_ascii=False,indent=2))
if __name__=='__main__':{'build':build,'promote':promote,'archive':archive}[sys.argv[1]]()
