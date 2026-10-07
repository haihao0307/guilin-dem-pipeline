"""Rebuild privately from official original bytes. Never publishes scan data."""
import argparse,pathlib,datetime,uuid,shutil,subprocess,os,hashlib,json
from tools.download_runtime_sources import download

def main():
    p=argparse.ArgumentParser();p.add_argument('--private-parent',required=True);p.add_argument('--blender',required=True);p.add_argument('--groom-data',required=True);a=p.parse_args()
    parent=pathlib.Path(a.private_parent).expanduser().resolve();blender=pathlib.Path(a.blender).expanduser().resolve();guides=pathlib.Path(a.groom_data).expanduser().resolve();here=pathlib.Path(__file__).resolve().parent
    if not parent.is_dir()or not blender.is_file()or not guides.is_file():p.error('Use existing private parent, Blender executable and retained teacher-groom.js')
    if any((x/'.git').exists()for x in [parent,*parent.parents]):p.error('Private output must be outside every Git checkout')
    if shutil.disk_usage(parent).free<2*1024**3:p.error('At least 2 GiB free disk is required')
    expected='706a8192d47b1f8a422ee3094107a71946b8fd417ce7f0c456ef29addf2c60be'
    if hashlib.sha256(guides.read_bytes()).hexdigest()!=expected:p.error('Retained groom source hash differs; do not substitute another head or guides')
    root=parent/('TEN24-private-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);root.mkdir();(root/'reports').mkdir()
    print('New private output:',root,flush=True)
    download(root,here/'original-files-manifest.json')
    env=dict(os.environ,TEN24_PRIVATE_ROOT=str(root),TEN24_GROOM_DATA=str(guides))
    def run(scene,script):
        log=root/'reports'/(script+'.log');cmd=[str(blender),'-b','--disable-autoexec',str(scene),'--python',str(here/'tools'/script)]
        with log.open('w',encoding='utf-8')as f:r=subprocess.run(cmd,env=env,stdout=f,stderr=subprocess.STDOUT)
        # Blender can exit 0 after a Python exception. Explicitly inspect logs.
        content=log.read_text(encoding='utf-8',errors='replace')
        if r.returncode or 'Traceback (most recent call last)'in content:raise RuntimeError('Stage failed: '+script+'; see '+str(log))
    source=root/'original/Blender/Blender Scene.blend'
    run(source,'inspect_scene.py');run(source,'build_groom.py')
    run(root/'work-r10/TEN24_Groom_R10.blend','refine_groom.py')
    run(root/'work-r10/TEN24_Groom_R11_Rebuilt.blend','reject_unsafe_roots.py')
    final=root/'work-r10/TEN24_Groom_R11_Verified.blend';run(final,'verify_groom.py')
    report=json.loads((root/'reports/ten24-groom-rebuilt-verified.json').read_text(encoding='utf-8'))['verification']
    if not report['all_functional_checks_passed']or report['evaluated_control_point_contacts']or report['evaluated_midpoint_contacts']:raise RuntimeError('Sampled contact/control verification failed; no runtime exported')
    run(final,'export_runtime.py')
    for im in (root/'original/Textures/JPG').rglob('*.jpg'):shutil.copy2(im,root/'runtime'/im.name)
    print('Verified private Blender scene:',final,flush=True)
    print('Private browser import folder:',root/'runtime',flush=True)
    print('Web materials and continuous spline collision remain unverified. No data uploaded.',flush=True)
if __name__=='__main__':main()
