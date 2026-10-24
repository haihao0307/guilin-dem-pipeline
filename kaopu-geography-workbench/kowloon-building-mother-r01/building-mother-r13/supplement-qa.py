import functools,http.server,json,threading,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent;out=Path('public-inspection-evidence');out.mkdir(exist_ok=True)
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root.parent)));threading.Thread(target=server.serve_forever,daemon=True).start()
r={'passed':False,'errors':[],'scope':'R13 fullscreen candidate and warehouse evidence visible after selection'}
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']);p=b.new_page(viewport={'width':1366,'height':900});p.set_default_timeout(180000);p.on('pageerror',lambda e:r['errors'].append(str(e)))
  p.goto(f'http://127.0.0.1:{server.server_port}/building-mother-r13/index.html');p.wait_for_function('semanticInspection.ready&&!semanticInspection.busy')
  p.locator('[data-building=warehouse]').click();p.wait_for_function('semanticInspection.caseId==="warehouse"&&!semanticInspection.busy')
  p.locator('[data-warehouse-candidate]').nth(1).click();p.wait_for_function('!semanticInspection.busy');p.wait_for_timeout(150)
  box=p.locator('#warehouseCandidateEvidence').bounding_box();assert box['y']<800 and box['y']+box['height']>150,box
  p.screenshot(path=str(out/'warehouse-candidate-box-visible.png'),full_page=True);r['warehouseEvidenceBox']=box
  p.locator('[data-building=kcc]').click();p.wait_for_function('semanticInspection.caseId==="kcc"&&!semanticInspection.busy');p.get_by_role('button',name='打开三维结构候选',exact=True).click();p.wait_for_function('semanticInspection.candidateViewer.state.ready&&!semanticInspection.candidateViewer.state.busy')
  p.wait_for_timeout(200)
  rect=p.locator('#kccCandidateCanvas').bounding_box();assert rect['width']>1000 and rect['height']>500,rect;r['candidateFullscreen']=rect
  p.locator('#kccCandidateCanvas').screenshot(path=str(out/'kcc-floor5-windows-desktop.png'))
  p.get_by_role('button',name='窗洞近景',exact=True).click();p.wait_for_function('!semanticInspection.candidateViewer.state.busy');p.locator('#kccCandidateCanvas').screenshot(path=str(out/'kcc-window-close-desktop.png'));p.get_by_role('button',name='完整显示本层',exact=True).click();p.wait_for_function('!semanticInspection.candidateViewer.state.busy')
  p.locator('[data-candidate-floor]').select_option('18');p.wait_for_function('semanticInspection.candidateViewer.state.actualFloor===18&&!semanticInspection.candidateViewer.state.busy');p.locator('#kccCandidateCanvas').screenshot(path=str(out/'kcc-floor18-windows-desktop.png'))
  p.get_by_role('button',name='收起候选，返回三栋建筑',exact=True).click();p.wait_for_function('!semanticInspection.busy');assert p.locator('#view').bounding_box()['height']>=350
  assert not r['errors'];r['passed']=True;b.close()
except Exception:r['errors'].append(traceback.format_exc());raise
finally:(out/'r13-supplement.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));server.shutdown()
