from pathlib import Path
P=Path(__file__).resolve().parent
f=P/'index.html';s=f.read_text();anchor='<script type="module" src="app.mjs"></script>'
assert s.count(anchor)==1
url='https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0434-8c8245dd87e5/person-core/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js'
assert '<script type="importmap">' not in s
s=s.replace(anchor,'<script type="importmap">{"imports":{"three":"'+url+'"}}</script>'+anchor);f.write_text(s)
f=P/'qa/browser.py';s=f.read_text();old="page.goto(BASE+'?look=K02',wait_until='domcontentloaded');page.wait_for_function('window.__MP01__?.audit().rows.length===2 && !__MP01__.audit().pending')"
new="page.goto(BASE+'?look=K02',wait_until='domcontentloaded');wait_boot(page)"
assert s.count(old)==1;s=s.replace(old,new)
needle='server=None\ntry:'
helper='''def wait_boot(page):
 start=time.monotonic()
 while time.monotonic()-start<180:
  status=page.locator('#status').inner_text()
  if R['pageErrors'] or status.startswith('工作台初始化未完成') or status.startswith('载入 K02 失败'):
   R['initialStatus']=status;page.screenshot(path=str(OUT/'boot-failure.png'))
   raise AssertionError({'status':status,'pageErrors':R['pageErrors']})
  if page.evaluate('!!window.__MP01__ && __MP01__.audit().rows.length===2 && !__MP01__.audit().pending'):return
  page.wait_for_timeout(500)
 R['initialStatus']=page.locator('#status').inner_text();page.screenshot(path=str(OUT/'boot-timeout.png'))
 raise AssertionError('Initial display exceeded bounded wait: '+R['initialStatus'])
server=None
try:'''
assert s.count(needle)==1;s=s.replace(needle,helper);f.write_text(s)
print('PINNED_THREE_IMPORTMAP_AND_FAILFAST_BOOT_READY')
