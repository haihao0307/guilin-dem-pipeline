from pathlib import Path
import re
P=Path(__file__).parent
parts=[]
for name in ['curve-math.mjs','frame-core.mjs','geometry.mjs']:
 s=(P/name).read_text();s=re.sub(r'^import .*?;\s*','',s,flags=re.M);s=re.sub(r'\bexport\s+','',s)
 # each file remains in its own scope; pass only the public functions onward
 names={'curve-math.mjs':['rotate'],'frame-core.mjs':['axis','transportedFrames','add','sub','mul','dot','cross'],'geometry.mjs':['evaluate','inspect','project']}[name]
 parts.append('const {'+','.join(names)+'}=(()=>{\n'+s+'\nreturn {'+','.join(names)+'};})();')
parts.append('const SAMPLE='+ (P/'data/sample.json').read_text()+';');parts.append((P/'app.js').read_text())
(P/'preview.html').write_text((P/'template.html').read_text().replace('__BUNDLE__','\n'.join(parts)))
print('Built',P/'preview.html',(P/'preview.html').stat().st_size,'bytes')
