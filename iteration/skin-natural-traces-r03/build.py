from pathlib import Path

# R02's BUILD metadata says paint-r02-v3, but its retained HTML shader cache key
# still uses the older surface-lab name. Keep the full reviewed build template
# unchanged and patch only this verified source anchor before execution.
TEMPLATE=Path(__file__).with_name('build_template.py')
code=TEMPLATE.read_text()
old="material.customProgramCacheKey=()=>key()+'/ssg-paint-r02-v3';"
actual="material.customProgramCacheKey=()=>key()+'/ssg-surface-lab-r01-v1';"
assert code.count(old)==1
code=code.replace(old,actual,1)
exec(compile(code,str(TEMPLATE),'exec'))
