from pathlib import Path
import shutil,json,hashlib
BASE=Path('G:/DEM');OUT=BASE/'Wenzhou_R3_1_FULL_RESTART_20260909'
OUT.mkdir(exist_ok=True)
R3=BASE/'Wenzhou_3D_Lab_R3_20260909';R31=BASE/'Wenzhou_3D_Lab_R3_1_20260909'
def copy(a,b):
 b=OUT/b;b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b)
shutil.copytree(R3/'site',OUT/'site',ignore=shutil.ignore_patterns('.git','node_modules'),dirs_exist_ok=True)
for root,name in [(R3,'R3'),(R31,'R3_1')]:
 for p in root.glob('*'):
  if p.is_file() and p.suffix in ('.json','.md'):copy(p,Path('records')/name/p.name)
 for p in (root/'tools').glob('*.py'):copy(p,Path('source-tools')/name/p.name)
for p in (R31/'evidence').glob('*.json'):copy(p,Path('records/R3_1/evidence')/p.name)
for p in (BASE/'Wenzhou_Knowledge_Lab_R1_20260909/evidence/recovery/01_CANONICAL_COLD').glob('WENZHOU_FINAL_CANONICAL_R2_2_1.lorenzo.*'):copy(p,Path('inputs/canonical-dem')/p.name)
for p in (BASE/'Wenzhou_Knowledge_Lab_R2_20260909/site/public/data-r2-2').glob('*'):
 if p.is_file():copy(p,Path('inputs/knowledge-r2-2')/p.name)
copy(R31/'evidence/land-polygons-split-4326.zip',Path('inputs/hydro/land-polygons-split-4326.zip'))
copy(BASE/'project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/OSM_WATERWAYS_SOURCE_WGS84.geojson',Path('inputs/hydro/OSM_WATERWAYS_SOURCE_WGS84.geojson'))
copy(R31/'site-source-r3-1.bundle',Path('history/site-source-r3-1.bundle'))
copy(R31/'wenzhou-r3-1-deploy.tar.gz',Path('release/wenzhou-r3-1-deploy.tar.gz'))
for name in ['AGENTS.md','MOTHER_OBJECT_DEFINITION_RULE_2026-09-09.md','MOTHER_PUBLIC_PREVIEW_DELIVERY_RULE_2026-09-08.md']:copy(R31/name,Path(name))
(OUT/'tools').mkdir(exist_ok=True)
(OUT/'requirements.txt').write_text('numpy==2.3.5\npyproj==3.8.0\nshapely==2.1.2\npyshp==2.3.1\ncertifi==2026.7.22\n',encoding='utf-8')
print(OUT)
