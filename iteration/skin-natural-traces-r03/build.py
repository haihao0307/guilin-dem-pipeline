from pathlib import Path

# R02's BUILD metadata and retained HTML cache label differ. The wrapper also
# inserts the separately reviewed R03.1 visual calibration without rewriting R02.
TEMPLATE=Path(__file__).with_name('build_template.py')
code=TEMPLATE.read_text()

trace_anchor="trace=(ROOT/'natural-traces.js').read_text()\none('/* KAOPU SSG-01 / Skin Surface Lab R01.',trace+'\\n/* KAOPU SSG-01 / Skin Surface Lab R01.')"
trace_patch="trace=(ROOT/'natural-traces.js').read_text()\ntune=(ROOT/'visual-tune-r03-1.js').read_text()\none('/* KAOPU SSG-01 / Skin Surface Lab R01.',trace+'\\n'+tune+'\\n/* KAOPU SSG-01 / Skin Surface Lab R01.')"
assert code.count(trace_anchor)==1
code=code.replace(trace_anchor,trace_patch,1)

old="one(\"material.customProgramCacheKey=()=>key()+'/ssg-paint-r02-v3';\",\"material.customProgramCacheKey=()=>key()+'/skin-natural-traces-r03-v1';\")"
new="""import re
cache_keys=re.findall(r\"material\\.customProgramCacheKey=\\(\\)=>key\\(\\)\\+[^;]+;\",s)
assert len(cache_keys)==1,cache_keys
s=s.replace(cache_keys[0],\"material.customProgramCacheKey=()=>key()+'/skin-natural-traces-r03-v2';\",1)"""
assert code.count(old)==1
code=code.replace(old,new,1)
code=code.replace('skin-natural-traces-r03-v1','skin-natural-traces-r03-v2')
exec(compile(code,str(TEMPLATE),'exec'))
