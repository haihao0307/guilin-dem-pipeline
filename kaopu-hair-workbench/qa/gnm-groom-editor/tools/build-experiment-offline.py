#!/usr/bin/env python3
"""Temporary offline teacher experiment. Uses exact pinned official GNM weights."""
import argparse,base64,hashlib,json,re,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/'
EXPECTED={'head':('gnm_head_web.bin',34937952,'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'),'samplers':('gnm_samplers_web.bin',2731824,'827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b')}
def data(text):return 'data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()
def build(output,cache,download):
 assets={}
 for kind,(name,size,digest) in EXPECTED.items():
  p=cache/name
  if not p.exists():
   if not download:raise RuntimeError('Pinned asset unavailable: '+str(p))
   with urllib.request.urlopen(BASE+name,timeout=90) as r:b=r.read()
   if len(b)!=size or hashlib.sha256(b).hexdigest()!=digest:raise RuntimeError('Pinned asset hash mismatch')
   p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
  b=p.read_bytes()
  if len(b)!=size or hashlib.sha256(b).hexdigest()!=digest:raise RuntimeError('Pinned asset hash mismatch')
  assets[kind]=base64.b64encode(b).decode()
 html=(ROOT/'experiment.html').read_text();imap=json.loads(re.search(r'<script type="importmap">(.*?)</script>',html,re.S).group(1))['imports'];paths={key:(ROOT/path.split('?',1)[0]).resolve() for key,path in imap.items()};by_path={path:key for key,path in paths.items()}
 # Resolve the complete local ES-module graph to bare names before data-URL embedding.
 pending=list(paths);source={}
 while pending:
  key=pending.pop();p=paths[key];code=p.read_text()
  def rewrite(m):
   prefix,quote,target=m.group(1),m.group(2),m.group(3)
   if not target.startswith('.'):return m.group(0)
   dep=(p.parent/target).resolve()
   if dep not in by_path:
    name='local-'+hashlib.sha256(str(dep.relative_to(ROOT)).encode()).hexdigest()[:16];by_path[dep]=name;paths[name]=dep;pending.append(name)
   return prefix+quote+by_path[dep]+quote
  code=re.sub(r'''((?:from\s*|import\s*\(\s*))(["'])([^"']+)\2''',rewrite,code)
  if re.search(r'''(?:from\s*|import\s*\(\s*)["']\.{1,2}/''',code):raise RuntimeError('Unresolved module '+key)
  source[key]=data(code)
 app=(ROOT/'src/experiment.js').read_text()
 if re.search(r'''(?:from\s*|import\s*\(\s*)["']\.{1,2}/''',app):raise RuntimeError('Use importmap names in app')
 html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':source})+'</script>',html,flags=re.S)
 html=html.replace('<link rel="stylesheet" href="experiment.css">','<style>'+(ROOT/'experiment.css').read_text()+'</style>')
 html=html.replace('<script type="module" src="src/experiment.js?graphics-recovery=3"></script>','<script>window.__GNM_ASSETS__='+json.dumps(assets)+'</script><script type="module" src="'+data(app)+'"></script>')
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(html)
 print(json.dumps({'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'moduleCount':len(source),'weights':EXPECTED}))
if __name__=='__main__':
 a=argparse.ArgumentParser();a.add_argument('--output',type=Path,required=True);a.add_argument('--assets-dir',type=Path,default=ROOT/'assets');a.add_argument('--download',action='store_true');o=a.parse_args();build(o.output,o.assets_dir,o.download)
