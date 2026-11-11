from pathlib import Path
import shutil,json
r=Path("kaopu-fabric-workbench/knit-material-r06")
if r.exists(): shutil.rmtree(r)
shutil.copytree(Path("kaopu-fabric-workbench/knit-material-r05"),r)
shutil.rmtree(r/"evidence",ignore_errors=True)
# Patch the deterministic build, not a prebuilt stale page.
p=r/"build.py";s=p.read_text()
needle="  if(ix/4u==uv.x&&iy/4u==uv.y){bin=bins[128u+(iz*32u+iy)*64u+ix];}"
replacement="  if(ix/4u==uv.x&&iy/4u==uv.y){let candidateBin=bins[128u+(iz*32u+iy)*64u+ix];if(candidateBin.y>0u){bin=candidateBin;}}"
assert s.count(needle)==1
s=s.replace(needle,replacement)
needle="a+='\\n'+(r/'search.js').read_text()+'\\n'+(r/'performance.js').read_text()+'\\nboot();\\n'"
replacement=needle+"""
a=a.replace("VERSION='KNIT-MATERIAL-R05'","VERSION='KNIT-MATERIAL-R06'")
a=a.replace("let accelerated=true;","let accelerated=true;\\nfunction useAcceleration(){return accelerated&&W>=640&&material.params.hairDensity>=800;}")
a=a.replace("accelerated?1:0","useAcceleration()?1:0")
a=a.replace("if(accelerated)steps.push({name:'makeDepth'","if(useAcceleration())steps.push({name:'makeDepth'")
a=a.replace("revision,accelerated,profiled","revision,accelerated:useAcceleration(),requestedAcceleration:accelerated,profiled")
a=a.replace("source?.acceleration,accelerated,bufferBytes","source?.acceleration,accelerated:useAcceleration(),requestedAcceleration:accelerated,bufferBytes")
"""
assert s.count(needle)==1
s=s.replace(needle,replacement)
s=s.replace("replace('R04','R05')","replace('R04','R06')")
s=s.replace("'KNIT-MATERIAL-R05'","'KNIT-MATERIAL-R06'")
p.write_text(s)
# QA targets the new folder and identifies this version.
q=r/"qa.mjs";t=q.read_text().replace("KNIT-MATERIAL-R05","KNIT-MATERIAL-R06").replace("knit-material-r05/index.html","knit-material-r06/index.html")
q.write_text(t)
# Keep the original evidence script but give the new adaptive strategy explicit metadata.
(r/"TASK_ANCHOR.json").write_text(json.dumps({
 "taskId":"knit-material-r06-adaptive-20261111",
 "baseSha":"00052a694d5536007d1028b68e1f9560c5e16acb",
 "baseline":"KNIT-MATERIAL-R04",
 "target":"adaptive same-quality acceleration; prevent the R05 prepass/index overhead from being used in low-resolution or sparse-hair conditions",
 "changes":["conservative empty-cell fallback to original coarse bin","only enable spatial/depth acceleration at >=640px width and >=800 fibres per stitch","preserve material source, 2 AA samples, fibre count, 8 curve segments, 128 ray steps, 8 shadow samples"],
 "notClaimed":["60 FPS","physical GPU performance","visual acceptance"]
},ensure_ascii=False,indent=2))
print("R06 patch source prepared")
