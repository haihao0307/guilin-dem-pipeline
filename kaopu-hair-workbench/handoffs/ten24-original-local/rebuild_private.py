"""Rebuild privately from official original bytes. Never publishes scan data."""
import argparse,pathlib,datetime,uuid,shutil,subprocess,os,hashlib,json,urllib.request,zipfile
from tools.download_runtime_sources import download
from tools.import_existing_sources import import_existing

def main():
    p=argparse.ArgumentParser();p.add_argument('--private-parent',required=True);p.add_argument('--blender',required=True);p.add_argument('--groom-data',help='Optional retained teacher-groom.js; otherwise use pinned existing project source');source=p.add_mutually_exclusive_group();source.add_argument('--source-root',help='Existing original folder containing Blender and Textures');source.add_argument('--source-zip',help='Existing official original ZIP');a=p.parse_args()
    parent=pathlib.Path(a.private_parent).expanduser().resolve();blender=pathlib.Path(a.blender).expanduser().resolve();guides=pathlib.Path(a.groom_data).expanduser().resolve()if a.groom_data else None;here=pathlib.Path(__file__).resolve().parent
    if not parent.is_dir()or not blender.is_file()or (guides is not None and not guides.is_file()):p.error('Use existing private parent, Blender executable and retained teacher-groom.js')
    if any((x/'.git').is_file() or ((x/'.git').is_dir() and ((x/'.git/HEAD').is_file() or (x/'.git/config').is_file())) for x in [parent,*parent.parents]):p.error('Private output must be outside every Git checkout')
    if shutil.disk_usage(parent).free<2*1024**3:p.error('At least 2 GiB free disk is required')
    expected='706a8192d47b1f8a422ee3094107a71946b8fd417ce7f0c456ef29addf2c60be'
    if guides is not None and hashlib.sha256(guides.read_bytes()).hexdigest()!=expected:p.error('Retained groom source hash differs; do not substitute another head or guides')
    root=parent/('TEN24-private-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:8]);root.mkdir();(root/'reports').mkdir()
    print('New private output:',root,flush=True)
    if guides is None:
        candidate=here.parent.parent/'qa/gnm-groom-editor/data/teacher-groom.js'
        if candidate.is_file():guides=candidate
        else:
            guides=root/'teacher-groom.js'
            url='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/cdf2ac931e444875dd400eafada7ee118702147f/kaopu-hair-workbench/qa/gnm-groom-editor/data/teacher-groom.js'
            with urllib.request.urlopen(url,timeout=90)as response:payload=response.read(700000)
            if hashlib.sha256(payload).hexdigest()!=expected:raise ValueError('Pinned existing groom source differs')
            guides.write_bytes(payload)
    if hashlib.sha256(guides.read_bytes()).hexdigest()!=expected:raise ValueError('Existing groom source differs; refusing substitution')
    print('Original guide source verified. No new groom model substituted.',flush=True)
    if a.source_root or a.source_zip:import_existing(root,here/'original-files-manifest.json',a.source_root,a.source_zip)
    else:download(root,here/'original-files-manifest.json')
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
if __name__=='__main__':
    try:main()
    except (OSError,ValueError,RuntimeError,zipfile.BadZipFile) as error:
        print('STOPPED:',error,flush=True)
        print('Original input files were not modified. Any partial output is in the new private folder; keep it for diagnosis.',flush=True)
        raise SystemExit(1)
