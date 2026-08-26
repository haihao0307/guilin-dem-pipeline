#!/usr/bin/env python3
"""Chromium QA for the three 10 km x 10 km landscape ecology showcases."""
from __future__ import annotations
import argparse, contextlib, json, os, threading
from dataclasses import asdict, dataclass
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from playwright.sync_api import sync_playwright

REGIONS=("guilin","wenzhou","kunming")
VIEWPORTS=(("desktop",1440,1000),("mobile-390x844",390,844))

@dataclass
class Result:
    page:str; viewport:str; passed:bool; screenshot:str
    assertions:dict[str,bool]; consoleErrors:list[str]; pageErrors:list[str]; failedRequests:list[str]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None: return

@contextlib.contextmanager
def serve(root:Path):
    handler=lambda *a,**kw:Quiet(*a,directory=str(root),**kw)
    server=ThreadingHTTPServer(("127.0.0.1",0),handler)
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    try: yield f"http://127.0.0.1:{server.server_port}"
    finally: server.shutdown();server.server_close();thread.join(timeout=5)

def inspect(page,url,name,viewport,out,region=None):
    ce=[];pe=[];fr=[]
    page.on("console",lambda m:ce.append(m.text) if m.type=="error" else None)
    page.on("pageerror",lambda e:pe.append(str(e)))
    page.on("requestfailed",lambda r:fr.append(f"{r.method} {r.url}: {r.failure}"))
    page.goto(url,wait_until="networkidle",timeout=30000)
    page.wait_for_function("() => document.documentElement.dataset.showcaseReady === 'true'",timeout=20000)
    assertions={"title":"三地典型地貌生态样板" in page.title(),"controller":"小华" in page.locator("body").inner_text()}
    if region is None:
        assertions.update({
            "threeCards":page.locator("#cards article.card").count()==3,
            "threeLinks":page.locator("#cards a.open").count()==3,
            "uniformAoi":page.get_by_text("10 × 10 km",exact=False).count()>=4,
            "approvalOpen":"等待用户" in page.locator("body").inner_text(),
        })
    else:
        canvas=page.locator("#terrain");canvas.wait_for(state="visible")
        manifest=page.evaluate("window.__LANDSCAPE_SHOWCASE__.manifest")
        selected=page.evaluate("window.__LANDSCAPE_SHOWCASE__.region.id")
        before=page.evaluate("window.__LANDSCAPE_SHOWCASE__.state.frame")
        ecology=page.locator('[data-layer="ecology"]');ecology.click();off=ecology.get_attribute("aria-pressed")=="false";ecology.click();on=ecology.get_attribute("aria-pressed")=="true"
        box=canvas.bounding_box()
        if box:
            page.mouse.move(box["x"]+box["width"]*.45,box["y"]+box["height"]*.55);page.mouse.down();page.mouse.move(box["x"]+box["width"]*.58,box["y"]+box["height"]*.48,steps=5);page.mouse.up();page.mouse.wheel(0,-160);page.wait_for_timeout(120)
        after=page.evaluate("window.__LANDSCAPE_SHOWCASE__.state.frame")
        assertions.update({
            "selectedRegion":selected==region,
            "widthKm":manifest["uniformAoi"]["widthKm"]==10,
            "heightKm":manifest["uniformAoi"]["heightKm"]==10,
            "areaKm2":manifest["uniformAoi"]["areaKm2"]==100,
            "proceduralPreview":manifest["truthClaims"]["proceduralPreview"] is True,
            "exactTruthNotClaimed":manifest["truthClaims"]["native12p5mTruthForEachShowcase"] is False,
            "truthNotOverwritten":manifest["truthClaims"]["truthOverwrite"] is False,
            "fourControls":page.locator("[data-layer]").count()==4,
            "toggleWorks":off and on,
            "canvasVisible":bool(box and box["width"]>=300 and box["height"]>=300),
            "renderAdvanced":after>before,
        })
        if region=="guilin": assertions["oldCoreDisclosed"]="原验证核心为 10 km²" in page.locator("#truth").inner_text()
        if region=="wenzhou": assertions["parentShaVisible"]="12.5 m COG" in page.locator("#truth").inner_text()
        if region=="kunming": assertions["failureBoundaryVisible"]="失败检查" in page.locator("#truth").inner_text()
    assertions.update({"consoleClean":not ce,"pageClean":not pe,"networkClean":not fr})
    out.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out),full_page=True)
    return Result(name,viewport,all(assertions.values()),str(out),assertions,ce,pe,fr)

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--root",type=Path,default=Path(__file__).resolve().parents[2]);ap.add_argument("--output",type=Path,default=Path("reports/procedural-landscape-showcases-v010"));a=ap.parse_args()
    root=a.root.resolve();out=a.output if a.output.is_absolute() else root/a.output;site=root/"web/procedural-landscape-showcases-v010"
    manifest=json.loads((site/"showcase.json").read_text(encoding="utf-8"))
    assert manifest["controllerAlias"]=="小华" and manifest["uniformAoi"]["areaKm2"]==100.0
    results=[]
    with serve(site) as base,sync_playwright() as pw:
        opts={"headless":True};explicit=os.environ.get("CHROMIUM_PATH")
        if explicit and Path(explicit).is_file():opts["executable_path"]=explicit
        browser=pw.chromium.launch(**opts)
        try:
            for vp,w,h in VIEWPORTS:
                for name,region in (("hub",None),*((r,r) for r in REGIONS)):
                    context=browser.new_context(viewport={"width":w,"height":h},device_scale_factor=1,locale="zh-CN",color_scheme="dark")
                    try:
                        suffix="" if region is None else f"?region={region}"
                        results.append(inspect(context.new_page(),f"{base}/index.html{suffix}",name,vp,out/f"{name}-{vp}.png",region))
                    finally:context.close()
        finally:browser.close()
    report={"schema":"dem_procedural_landscape_showcases_browser_qa@1.0.0","passed":all(r.passed for r in results),"controllerAlias":"小华","uniformAoi":{"widthKm":10.0,"heightKm":10.0,"areaKm2":100.0},"results":[asdict(r) for r in results]}
    out.mkdir(parents=True,exist_ok=True);(out/"report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2));return 0 if report["passed"] else 1
if __name__=="__main__":raise SystemExit(main())
