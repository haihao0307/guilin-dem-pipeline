from pathlib import Path
import sys,shutil
p=Path(sys.argv[1]);new=p/'new';shutil.copytree(p/'source',new,dirs_exist_ok=True)
f=new/'app.mjs';s=f.read_text();old="function showProp(o){if(!o){";assert s.count(old)==1
s=s.replace(old,"function showProp(o){if(!o||clip?.row.kind!=='hand'||!['grasp','carry'].includes(clip?.row.task)){").replace('MP06-R1','MP06-R1.1');f.write_text(s)
f=new/'build.cjs';f.write_text(f.read_text().replace('MP06-R1','MP06-R1.1'))
f=p/'reproducibility/publish.py';s=f.read_text().replace("products/r06-1'","products/r06-1-1'").replace('mp06-r1-','mp06-r1-1-').replace('MP06-R1','MP06-R1.1');s=s.replace(" for p in sorted(runtime.rglob('*')):\n  if p.is_file():\n   sha=git('hash-object','-w',str(p));git('update-index','--add','--cacheinfo','100644,'+sha+','+publicPrefix+'/'+p.relative_to(runtime).as_posix(),env=env)"," entries=[]\n for p in sorted(runtime.rglob('*')):\n  if p.is_file():\n   sha=git('hash-object','-w',str(p));entries.append('100644 '+sha+'\\t'+publicPrefix+'/'+p.relative_to(runtime).as_posix())\n git('update-index','--index-info',env=env,input='\\n'.join(entries)+'\\n')")
f.write_text(s)
f=p/'reproducibility/qa-public.cjs';s=f.read_text().replace('MP06-R1','MP06-R1.1');anchor="r.sourceClothRows.push({id:e.action,activationAndSeekWallMS:Date.now()-s,...proof});"
assert s.count(anchor)==1
s=s.replace(anchor,"const prop=await p.evaluate(()=>{const d=window.__MP06__.debug();return d.viewer.scene.children.filter(o=>o.userData?.kind&&o.visible).map(o=>o.userData.kind);});assert.equal(prop.length,e.action==='hand:carry'?1:0,'Source prop visibility drift');"+anchor)
f.write_text(s)
print('Corrected original prop display condition only; no motion or cloth cache data changed')
