"""Rebuild only in disposable rebuild-work. Fixed published files stay untouched."""
from pathlib import Path
import argparse,shutil,subprocess,sys
P=Path(__file__).resolve().parents[1];W=P/'rebuild-work';R3=W/'R3';R31=W/'R3_1'
ap=argparse.ArgumentParser();ap.add_argument('--decode-only',action='store_true');args=ap.parse_args()
for r in [R3,R31]:r.mkdir(parents=True,exist_ok=True)
shutil.copytree(P/'site/dist',R3/'site/dist',dirs_exist_ok=True)
for a,b in [(P/'records/R3/XIAOMA_3D_KNOWLEDGE_R3.md',R3/'XIAOMA_3D_KNOWLEDGE_R3.md'),(P/'records/R3_1/evidence/LAND_SOURCE_LOCK.json',R31/'evidence/LAND_SOURCE_LOCK.json')]:
 b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(a,b)
# Source input is linked/copied into the scratch workspace; never downloaded.
land=R31/'evidence/land-polygons-split-4326.zip'
if not land.exists():
 try:land.hardlink_to(P/'inputs/hydro/land-polygons-split-4326.zip')
 except OSError:shutil.copy2(P/'inputs/hydro/land-polygons-split-4326.zip',land)
def run(name,text,root):
 script=root/'tools'/name;script.parent.mkdir(exist_ok=True);script.write_text(text,encoding='utf-8');subprocess.run([sys.executable,'-X','utf8',str(script)],check=True)
prepare=(P/'source-tools/R3/prepare_dem.py').read_text(encoding='utf-8')
prepare=prepare.replace("Path('G:/DEM/Wenzhou_Knowledge_Lab_R1_20260909/evidence/recovery/01_CANONICAL_COLD')",repr(P/'inputs/canonical-dem').replace('WindowsPath','Path').replace('PosixPath','Path'))
prepare=prepare.replace("Path('G:/DEM/Wenzhou_Knowledge_Lab_R2_20260909/site/public/data-r2-2/OBJECT_EVIDENCE_R2_2.json')",repr(P/'inputs/knowledge-r2-2/OBJECT_EVIDENCE_R2_2.json').replace('WindowsPath','Path').replace('PosixPath','Path'))
if args.decode_only:
 prepare=prepare.split('queries = json.loads')[0]+"\nprint('Canonical decode verified:', checked, full_hash, flush=True)\n"
run('prepare_dem.py',prepare,R3)
if args.decode_only:sys.exit(0)
run('validate_surface.py',(P/'source-tools/R3/validate_surface.py').read_text(encoding='utf-8'),R3)
hydro=(P/'source-tools/R3_1/build_hydro.py').read_text(encoding='utf-8')
hydro=hydro.replace("Path('G:/DEM/Wenzhou_3D_Lab_R3_20260909')",repr(R3).replace('WindowsPath','Path').replace('PosixPath','Path'))
hydro=hydro.replace("Path('G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/OSM_WATERWAYS_SOURCE_WGS84.geojson')",repr(P/'inputs/hydro/OSM_WATERWAYS_SOURCE_WGS84.geojson').replace('WindowsPath','Path').replace('PosixPath','Path'))
run('build_hydro.py',hydro,R31)
v=(P/'source-tools/R3_1/validate_surface.py').read_text(encoding='utf-8').replace('G:/DEM/Wenzhou_3D_Lab_R3_20260909',R3.as_posix())
run('validate_surface.py',v,R31)
print('Rebuild finished in',R3/'site/dist','; fixed site untouched.')
