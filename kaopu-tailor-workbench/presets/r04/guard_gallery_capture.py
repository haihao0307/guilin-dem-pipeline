"""Do not request or present a thumbnail until the native result was rendered."""
from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'app.mjs';s=f.read_text()
s=s.replace('${e?`<img src="assets/results/', '${e&&e.thumbReady!==false?`<img src="assets/results/')
f.write_text(s)
f=P/'sweep_native.py';s=f.read_text()
s=s.replace("'thumb':id+'.png','kind':'ORIGINAL_SOLVER_RESULT'", "'thumb':id+'.png','thumbReady':False,'kind':'ORIGINAL_SOLVER_RESULT'")
marker="  for id in ['J06','T01','T03','T05','S02','P01']:"
addition="""  if not PUBLIC:
   for item in index['rows'].values():
    assert (A/'results'/item['thumb']).exists()
    item['thumbReady']=True
    item['thumbSHA256']=digest((A/'results'/item['thumb']).read_bytes())
   write(A/'results/index.json',index)
   page.reload(wait_until='domcontentloaded');page.wait_for_function('window.__R04?.state().ready',timeout=300000)
"""
if "item['thumbSHA256']" not in s:
 assert marker in s;s=s.replace(marker,addition+marker)
f.write_text(s)
# The runtime migration is intentionally one-time. Keep its entry point safe
# for subsequent CI/public verification runs rather than applying strings twice.
f=P/'continue_native.py';s=f.read_text()
old="f=P/'app.mjs';s=f.read_text().replace(\"version:'R04-SOURCE-2'\",\"version:'R04-SOURCE-3'\")"
if "SOURCE3_RUNTIME_MIGRATED" not in s:
 assert old in s
 at=s.index(old)
 s=s[:at]+"if not (P/'SOURCE3_RUNTIME_MIGRATED.json').exists():\n"+'\n'.join(' '+line for line in s[at:].splitlines())+"\n (P/'SOURCE3_RUNTIME_MIGRATED.json').write_text('{\"runtimeMigrationApplied\":true}')\n"
 f.write_text(s)
print('THUMBNAIL_CAPTURE_GUARD_READY')
