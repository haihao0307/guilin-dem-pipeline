from pathlib import Path
import shutil,json,hashlib,re
root=Path(__file__).resolve().parents[4]
dst=root/'kaopu-hair-workbench/foundation/f13'
donor=Path('G:/Three.js/Human/Hair-Fiber-System-R08-Run-20261016')
for d in ['src','vendor/fiber','vendor/motion','tools','evidence','docs']:(dst/d).mkdir(parents=True,exist_ok=True)
files=['NativeMotion.mjs','NativePoseCache.mjs','NativeHeadBinding.mjs','SurfaceBVH.mjs','GuideDynamics.mjs','BundleFriction.mjs','CollisionProxies.mjs','SurfaceContactField.mjs','detail-dynamics.mjs','wind.mjs','HairRenderer.mjs','HairPassCache.mjs']
sources={}
for name in files:
 p=donor/'src'/name;data=p.read_bytes();sources['src/'+name]=hashlib.sha256(data).hexdigest()
 text=data.decode('utf-8').replace("'../references/three.module.js'","'../three.module.js'").replace("'../references/motion/", "'../motion/")
 (dst/'vendor/fiber'/name).write_text(text,encoding='utf-8')
for p in (donor/'references/motion').iterdir():
 if p.is_file():shutil.copy2(p,dst/'vendor/motion'/p.name);sources['references/motion/'+p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
shutil.copy2(root/'kaopu-hair-workbench/foundation/f12/vendor/three.module.js',dst/'vendor/three.module.js')
(dst/'vendor/fiber/Groom.mjs').write_text("export const GUIDE_COUNT=43,NODES=25,NODE_POWER=1.3,COUNT=43;export const STYLES={medium:{length:.30},long:{length:.43}};",encoding='utf-8')
renderer=(dst/'vendor/fiber/HairRenderer.mjs').read_text(encoding='utf-8')
fragment=re.search(r'const fragment=`(.*?)`;\s*export class HairRenderer',renderer,re.S).group(1)
(dst/'src/FiberOptics.mjs').write_text('export const fragment='+json.dumps(fragment)+';\n',encoding='utf-8')
# Preserve snapshot evidence; no donor source is edited.
(dst/'DONOR_SNAPSHOT.json').write_text(json.dumps({'workbench':str(donor),'copiedUTC':'2026-10-16','sourceStatus':'local R08 in progress, immutable copied snapshot; publication files still describe R07','files':sources,'adaptations':['Three.js imports unified with host','solver population 43, one retained guide per F12 subclump','optical fragment retained from HairRenderer']},indent=2),encoding='utf-8')
(dst/'.gitignore').write_text('/.build/\n',encoding='utf-8')
print(dst)
