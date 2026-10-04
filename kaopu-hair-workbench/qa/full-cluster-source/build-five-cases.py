"""Rebuild accepted four cases, then add the isolated frozen Feather host."""
from pathlib import Path
import runpy,shutil,json
HERE=Path(__file__).parent
ROOT=HERE.parent
runpy.run_path(str(HERE/'build.py'))
runpy.run_path(str(HERE/'build-feather.py'))
for source,target in [('feather-integrated-candidate.html','kuko-anemone-candidate.html'),('feather-integrated-standalone.html','kuko-anemone-standalone.html'),('feather-integrated-standalone.html','KAOPU-毛发工作台-五案例.html')]:
 shutil.copyfile(ROOT/'dist'/source,ROOT/'dist'/target)
receipt=json.loads((HERE/'qa/feather-integration-build.json').read_text())
receipt.update({'entry':'dist/kuko-anemone-candidate.html','offlineEntry':'dist/KAOPU-毛发工作台-五案例.html','objects':['rabbit','anemone','fiber','groom','feather'],'isolatedIntegrationCandidate':False})
(HERE/'qa/five-case-build.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(receipt))
