from pathlib import Path

# R02's BUILD metadata and its retained HTML cache-key label are not identical.
# Keep the reviewed build template unchanged, replace only its hard-coded cache-key
# patch with a unique structural lookup, and refuse to continue if uniqueness is lost.
TEMPLATE=Path(__file__).with_name('build_template.py')
code=TEMPLATE.read_text()
old="one(\"material.customProgramCacheKey=()=>key()+'/ssg-paint-r02-v3';\",\"material.customProgramCacheKey=()=>key()+'/skin-natural-traces-r03-v1';\")"
new="""import re
cache_keys=re.findall(r\"material\\.customProgramCacheKey=\\(\\)=>key\\(\\)\\+[^;]+;\",s)
assert len(cache_keys)==1,cache_keys
s=s.replace(cache_keys[0],\"material.customProgramCacheKey=()=>key()+'/skin-natural-traces-r03-v1';\",1)"""
assert code.count(old)==1
code=code.replace(old,new,1)
exec(compile(code,str(TEMPLATE),'exec'))
