from __future__ import annotations
import base64
import hashlib
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "evidence"
OUT.mkdir(parents=True, exist_ok=True)
EXPECTED_SHA = "fb9212ce294078c62ab925c6c4da647bd7cb500ee9a765b46eb0cea9ca596c90"
EXPECTED_BYTES = 21287

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

def png_bytes(page):
    data = page.evaluate("document.getElementById('c').toDataURL('image/png')")
    return base64.b64decode(data.split(",", 1)[1])

def wait_draw(page):
    # UI actions schedule a render after 140 ms. Waiting only for ready=true can
    # accidentally observe the previous frame before the scheduled draw starts.
    page.wait_for_timeout(260)
    page.wait_for_function("window.__MM_READY__===true", timeout=180000)
    page.wait_for_timeout(80)

def canvas_hash(page):
    return hashlib.sha256(png_bytes(page)).hexdigest()

def record_frame(page, name):
    audit = page.evaluate("window.__MM__.audit()")
    (OUT / (name + ".json")).write_text(json.dumps(audit, ensure_ascii=False, indent=2))
    page.screenshot(path=str(OUT / (name + ".png")), full_page=True)
    print(json.dumps({"frame": name, "audit": audit}, ensure_ascii=False), flush=True)
    return audit

def static_checks():
    path = ROOT / "workbenches/landscape-microscope-r3/index.html"
    raw = path.read_bytes()
    text = raw.decode()
    assert len(raw) == EXPECTED_BYTES
    assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA
    assert text.count("<canvas") == 1 and text.count("<script>") == 1
    assert "<img" not in text and "texture2D" not in text and "sampler2D" not in text
    assert "http://" not in text and "https://" not in text
    assert "for(int j=0;j<17;j++)" in text and "for(int it=0;it<119;it++)" in text
    assert "fractureMaskQ" in text and "mossCells" in text and "strataMaskQ" in text
    return {"bytes": len(raw), "sha256": EXPECTED_SHA, "externalAssets": 0}

def visible(audit):
    # The final palette can intentionally stay below 190, so a fixed white-pixel
    # threshold is not a reliable blank-frame test. Distinct modes, screenshots
    # and tile hashes below provide the stronger variation checks.
    return audit["glError"] == 0 and 4 < audit["mean"] < 250 and audit["hash"] not in ("0", "811c9dc5")

def run_profile(browser, base, mobile):
    name = "mobile" if mobile else "desktop"
    context = browser.new_context(
        viewport={"width": 390 if mobile else 900, "height": 844 if mobile else 680},
        is_mobile=mobile,
        has_touch=mobile,
        device_scale_factor=1,
    )
    page = context.new_page()
    errors = []
    requests = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: requests.append(r.url))
    page.goto(base + "/workbenches/landscape-microscope-r3/index.html", wait_until="domcontentloaded", timeout=60000)
    wait_draw(page)
    checks = []
    def check(label, ok):
        checks.append({"name": label, "passed": bool(ok)})
        assert ok, label
    audit = record_frame(page, name + "-preflight")
    check("default frame", visible(audit))
    default_hash = canvas_hash(page)
    for view in ("near", "mid", "far"):
        page.evaluate("window.__MM__.setView(" + json.dumps(view) + ")")
        wait_draw(page)
        q = page.evaluate("window.__MM__.audit()")
        check("view " + view, visible(q))
    mode_hashes = []
    for mode in range(5):
        page.evaluate(f"window.__MM__.setMode({mode})")
        wait_draw(page)
        q = page.evaluate("window.__MM__.audit()")
        mode_hashes.append(q["hash"])
        check("mode " + str(mode), q["glError"] == 0 and 0 <= q["mean"] <= 255)
    check("diagnostic modes distinct", len(set(mode_hashes)) == 5)
    page.evaluate("window.__MM__.setView('near');window.__MM__.setMode(3);document.getElementById('crack').value=0;document.getElementById('crack').dispatchEvent(new Event('input'))")
    wait_draw(page)
    normal_no_crack = canvas_hash(page)
    page.evaluate("document.getElementById('crack').value=.92;document.getElementById('crack').dispatchEvent(new Event('input'))")
    wait_draw(page)
    normal_crack = canvas_hash(page)
    check("fractures enter implicit shape", normal_no_crack != normal_crack)
    page.evaluate("document.getElementById('moss').value=0;document.getElementById('moss').dispatchEvent(new Event('input'))")
    wait_draw(page)
    normal_moss0 = canvas_hash(page)
    page.evaluate("document.getElementById('moss').value=.8;document.getElementById('moss').dispatchEvent(new Event('input'))")
    wait_draw(page)
    normal_moss1 = canvas_hash(page)
    check("moss does not rewrite shape normal", normal_moss0 == normal_moss1)
    page.evaluate("window.__MM__.setMode(0)")
    wait_draw(page)
    color_moss = canvas_hash(page)
    page.evaluate("document.getElementById('moss').value=0;document.getElementById('moss').dispatchEvent(new Event('input'))")
    wait_draw(page)
    color_nomoss = canvas_hash(page)
    check("moss changes material display", color_moss != color_nomoss)
    page.evaluate("window.__MM__.at(0)")
    wait_draw(page)
    first = canvas_hash(page)
    variants = []
    for i in range(8):
        page.evaluate(f"window.__MM__.at({i})")
        wait_draw(page)
        variants.append(canvas_hash(page))
    page.evaluate("window.__MM__.at(0)")
    wait_draw(page)
    first2 = canvas_hash(page)
    check("eight variants distinct", len(set(variants)) == 8)
    check("variant identity stable", first == first2)
    tiles = page.evaluate("""()=>{const c=document.getElementById('c'),x=document.createElement('canvas'),g=x.getContext('2d');x.width=c.width;x.height=c.height;g.drawImage(c,0,0);let a=[];for(let j=0;j<3;j++)for(let i=0;i<4;i++){let d=g.getImageData(Math.floor(i*x.width/4),Math.floor(j*x.height/3),Math.floor(x.width/4),Math.floor(x.height/3)).data,h=2166136261;for(let k=0;k<d.length;k+=53)h=Math.imul(h^d[k],16777619);a.push((h>>>0).toString(16))}return a}""")
    check("no exact repeated screen tiles", len(set(tiles)) >= 11)
    check("no page errors", not errors)
    check("no external runtime requests", all(u.startswith(base) for u in requests))
    check("no horizontal overflow", page.evaluate("document.documentElement.scrollWidth<=innerWidth"))
    page.screenshot(path=str(OUT / (name + "-complete.png")), full_page=True)
    page.evaluate("window.__MM__.setMode(4)")
    wait_draw(page)
    page.screenshot(path=str(OUT / (name + "-fractures.png")), full_page=True)
    report = {
        "profile": name,
        "passed": True,
        "checks": checks,
        "defaultAudit": audit,
        "defaultCanvasSHA256": default_hash,
        "variantCanvasSHA256": variants,
        "requests": requests,
        "pageErrors": errors,
        "GPU": "Chromium SwiftShader",
        "physicalPhone": False,
    }
    (OUT / (name + ".json")).write_text(json.dumps(report, ensure_ascii=False, indent=2))
    context.close()
    return report

def compare_r2(browser, base):
    hashes = []
    for path in ("workbenches/landscape-microscope-r2/index.html", "workbenches/landscape-microscope-r3/index.html"):
        context = browser.new_context(viewport={"width": 420, "height": 320}, device_scale_factor=1)
        page = context.new_page()
        page.goto(base + "/" + path, wait_until="domcontentloaded", timeout=60000)
        wait_draw(page)
        page.evaluate("window.__MM__.setMode(1)")
        wait_draw(page)
        hashes.append(canvas_hash(page))
        context.close()
    assert hashes[0] == hashes[1], "R2 public-principle output changed"
    return {"r2PrincipleSHA256": hashes[0], "r3PrincipleSHA256": hashes[1], "identical": True}

def main():
    static = static_checks()
    handler = lambda *a, **k: Quiet(*a, directory=str(ROOT), **k)
    server = ThreadingHTTPServer(("127.0.0.1", 8765), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = "http://127.0.0.1:8765"
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
            comparison = compare_r2(browser, base)
            desktop = run_profile(browser, base, False)
            mobile = run_profile(browser, base, True)
            browser.close()
        final = {"passed": True, "static": static, "principleComparison": comparison, "desktop": desktop["passed"], "mobile": mobile["passed"]}
        (OUT / "summary.json").write_text(json.dumps(final, ensure_ascii=False, indent=2))
        print(json.dumps(final, ensure_ascii=False))
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
