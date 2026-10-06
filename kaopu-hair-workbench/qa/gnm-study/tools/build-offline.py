#!/usr/bin/env python3
"""Build a temporary self-contained QA file, preserving every official model byte.

No npm or installed packages. Existing assets are reused; --download authorizes
fetching only the two pinned official assets when the local files are absent.
"""
import argparse, base64, hashlib, json, re, urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/'
EXPECTED={
 'head':('gnm_head_web.bin',34937952,'fd19f46eef6f8bfb725fceab581e1bc8837209997ca3fd43f3c1735003c86961'),
 'samplers':('gnm_samplers_web.bin',2731824,'827fc7850022cbc62d4401c6f6782b876c4dfa48f2a6f446d9644b0ba2b8122b')}

def data_url(text):
 return 'data:text/javascript;base64,'+base64.b64encode(text.encode()).decode()

def build(output,assets_dir,download):
 assets={}
 for kind,(name,size,digest) in EXPECTED.items():
  p=assets_dir/name
  if not p.exists():
   if not download: raise RuntimeError(f'{p} missing; reuse local weights or pass --download')
   p.parent.mkdir(parents=True,exist_ok=True)
   with urllib.request.urlopen(BASE+name,timeout=90) as response: contents=response.read()
  else: contents=p.read_bytes()
  if len(contents)!=size or hashlib.sha256(contents).hexdigest()!=digest: raise RuntimeError(f'{name}: size/hash mismatch')
  if not p.exists(): p.write_bytes(contents)
  assets[kind]=base64.b64encode(contents).decode()
 modules={
  'graphics-lifecycle':data_url((ROOT/'src/GraphicsLifecycle.js').read_text()),
  'three':data_url((ROOT/'vendor/three.module.js').read_text()),
  'orbit-controls':data_url((ROOT/'vendor/OrbitControls.js').read_text()),
  'gnm-model':data_url((ROOT/'src/GNMModel.js').read_text()),
  'gnm-samplers':data_url((ROOT/'src/SemanticSampler.js').read_text().replace("'./GNMModel.js'","'gnm-model'")),
  'gnm-scalp':data_url((ROOT/'src/ScalpBinding.js').read_text().replace("'./SemanticSampler.js'","'gnm-samplers'")),
  'gnm-hair':data_url((ROOT/'src/HairLayer.js').read_text().replace("'./ScalpBinding.js'","'gnm-scalp'").replace("'./SemanticSampler.js'","'gnm-samplers'")),
  'gnm-facial-hair':data_url((ROOT/'src/FacialHairLayer.js').read_text().replace("'./HairLayer.js'","'gnm-hair'").replace("'./ScalpBinding.js'","'gnm-scalp'").replace("'./SemanticSampler.js'","'gnm-samplers'")),
  'gnm-expression-data':data_url((ROOT/'src/ExpressionSourceData.js').read_text()),
  'gnm-expression-sources':data_url((ROOT/'src/ExpressionSources.js').read_text().replace("'./ExpressionSourceData.js'","'gnm-expression-data'"))}
 for name,url in modules.items():
  code=base64.b64decode(url.split(',',1)[1]).decode()
  unresolved=re.findall(r'''(?:from\s*|import\s*\()(["'])(\.{1,2}/[^"']+)\1''',code)
  if unresolved: raise RuntimeError(f'{name}: unresolved relative imports in offline module: {unresolved}')
 html=(ROOT/'index.html').read_text()
 html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+(ROOT/'style.css').read_text()+'</style>')
 html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':modules})+'</script>',html,flags=re.S)
 payload='<script>window.__GNM_ASSETS__='+json.dumps(assets)+';</script>'
 app='<script type="module" src="'+data_url((ROOT/'src/app.js').read_text())+'"></script>'
 html=html.replace('<script type="module" src="src/app.js?graphics-recovery=3"></script>',payload+app)
 output.parent.mkdir(parents=True,exist_ok=True)
 output.write_text(html)
 print(json.dumps({'output':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'weights':{k:{'bytes':v[1],'sha256':v[2]}for k,v in EXPECTED.items()}}))

if __name__=='__main__':
 parser=argparse.ArgumentParser()
 parser.add_argument('--output',type=Path,required=True)
 parser.add_argument('--assets-dir',type=Path,default=ROOT/'assets')
 parser.add_argument('--download',action='store_true')
 args=parser.parse_args()
 build(args.output.resolve(),args.assets_dir.resolve(),args.download)
