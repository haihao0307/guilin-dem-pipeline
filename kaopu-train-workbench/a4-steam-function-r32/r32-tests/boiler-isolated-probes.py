"""Normal supported Chrome controls and captured single-field interval diagnostic. No whole acceptance."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
P=Path(__file__).resolve().parent
report={'status':'RUNNING','diagnostic_only':True,'whole_frame_accepted':False,'tested_commit':os.getenv('GITHUB_SHA'),'events':[]}
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,channel='chrome',chromium_sandbox=True,ignore_default_args=['--enable-unsafe-swiftshader','--no-sandbox','--unsafely-disable-devtools-self-xss-warnings','--disable-ipc-flooding-protection','--disable-client-side-phishing-detection'])
  report['browser_command']=browser.new_browser_cdp_session().send('Browser.getBrowserCommandLine')['arguments']
  assert not any(a.split('=')[0] in ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security','--ignore-certificate-errors','--enable-unsafe-swiftshader','--disable-gpu-watchdog'] for a in report['browser_command'])
  page=browser.new_page(viewport={'width':1100,'height':1000})
  def event(data):
   report['events'].append(data);print('BOILER_ISOLATED_PROBE',json.dumps(data),flush=True)
   (P/'BOILER_ISOLATED_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  page.expose_function('reportBoilerProbe',event)
  page.on('console',lambda m:print('CONSOLE',m.type,m.text,flush=True))
  page.set_content('<!doctype html><title>A4 diagnostic only - not train preview</title>')
  page.add_script_tag(path=str(P/'boiler-isolated-probes.js'))
  report['source_manifest']=json.loads((P/'BOILER_PROBE_SOURCE_RESULT.json').read_text())
  result=page.evaluate('input=>runBoilerIsolatedProbes(input)',json.loads((P/'BOILER_PROBE_SOURCE.json').read_text()))
  report['result']=result;report['status']=result['status'];print(json.dumps({'status':report['status'],'stages':result['stages']}),flush=True)
  browser.close()
except Exception as e:
 report['status']='DIAGNOSTIC_EXCEPTION';report['failure']=repr(e);raise
finally:
 (P/'BOILER_ISOLATED_RESULT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
