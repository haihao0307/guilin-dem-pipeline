from pathlib import Path
import shutil,json,hashlib
ROOT=Path(__file__).parent
source=ROOT/'upstream'; dest=ROOT/'runtime'
shutil.copytree(source,dest,dirs_exist_ok=True)
# Retain the original VisPattern class; defer only optional render-only imports.
p=dest/'pygarment/pattern/wrappers.py'
s=p.read_text()
lazy="""import importlib as _render_importlib
class _LazyRenderModule:
    def __init__(self, module_name): self.module_name = module_name
    def __getattr__(self, name):
        return getattr(_render_importlib.import_module(self.module_name), name)
cairosvg = _LazyRenderModule('cairosvg')"""
s=s.replace('import cairosvg',lazy).replace('import matplotlib.pyplot as plt',"plt = _LazyRenderModule('matplotlib.pyplot')")
s=s.replace("from pygarment import data_config", "data_config = _LazyRenderModule('pygarment.data_config')")
p.write_text(s)
for name in ['svgpathtools','svgwrite']:
 m=__import__(name)
 shutil.copytree(Path(m.__file__).parent,dest/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
 # Preserve installed package license / metadata.
 from importlib.metadata import distribution
 d=distribution(name)
 for f in d.files:
  if '.dist-info' in str(f) and any(x in str(f).lower() for x in ['license','metadata']):
   to=dest/str(f);to.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(d.locate_file(f),to)
 print(name,d.version)
# Verify exact downloaded bytes against Git blob SHA, allowing only the tool-added final newline.
manifest=json.loads((source/'MANIFEST.json').read_text())
for f in manifest['files']:
 p=source/f['path']; data=p.read_bytes()
 def sha(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
 if sha(data)!=f['sha']:
  assert data.endswith(b'\n') and sha(data[:-1])==f['sha'],f['path']
  p.write_bytes(data[:-1])
print('upstream git blob hashes verified')
