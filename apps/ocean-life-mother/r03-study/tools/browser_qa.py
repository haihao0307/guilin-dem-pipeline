from pathlib import Path
from playwright.sync_api import sync_playwright
import json,time
R=Path(__file__).resolve().parents[1];html=(R/'FUNCTION_STUDY_R03.html').read_text()
report={'engine':'Chromium/SwiftShader','transport':'set_content, not public navigation','viewports':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=False,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
 for W,H in [(1280,900),(390,844)]:
  page=b.new_page(viewport={'width':W,'height':H},device_scale_factor=1);err=[];page.on('pageerror',lambda e:err.append(str(e)))
  page.set_content(html,wait_until='load');page.wait_for_function('!!window.FunctionStudy',timeout=120000)
  states=[]
  for mode in ['fish','brain','staghorn']:
   page.evaluate('(m)=>FunctionStudy.setMode(m)',mode);page.wait_for_timeout(1000);states.append(page.evaluate('FunctionStudy.getState()'))
   page.screenshot(path=str(R/f'qa/{W}_{mode}.png'))
  page.evaluate("FunctionStudy.setMode('fish');FunctionStudy.setMoving(true)");page.wait_for_timeout(1000);states.append(page.evaluate('FunctionStudy.getState()'));page.screenshot(path=str(R/f'qa/{W}_moving.png'))
  report['viewports'].append({'size':[W,H],'errors':err,'states':states,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
  page.close()
 b.close()
(R/'qa/browser-r03.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
