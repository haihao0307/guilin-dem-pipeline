from __future__ import annotations
import hashlib
import json
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / "evidence"
OUT.mkdir(parents=True, exist_ok=True)
HTML = ROOT / "workbenches/landscape-full-r4/index.html"
EXPECTED_BYTES = 24971
EXPECTED_SHA = "7ce88e1265d625c6197f8d023ee0abb0a15908f6877a9a0a1a317b74453279eb"

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def static_checks():
    raw = HTML.read_bytes()
    text = raw.decode()
    assert len(raw) == EXPECTED_BYTES
    assert hashlib.sha256(raw).hexdigest() == EXPECTED_SHA
    assert text.count("<canvas") == 1
    assert text.count("<script") == 1
    assert "http://" not in text and "https://" not in text
    assert "workbenches/landscape-full-r4" not in text
    assert "for(int j=0;j<17;j++)" in text
    assert all(label in text for label in ["区域", "贴地", "岩壁", "微观", "亮白灰岩", "深灰灰岩", "暖灰白云质", "混合灰岩"])
    return {"bytes": len(raw), "sha256": EXPECTED_SHA, "externalRuntimeRequests": 0}


def main():
    static = static_checks()
    server = ThreadingHTTPServer(("127.0.0.1", 0), Quiet)
    port = server.server_address[1]
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    base = f"http://127.0.0.1:{port}"
    checks = []
    evidence = {"static": static, "checks": checks, "visualApproved": False, "productionReady": False}
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"])
            context = browser.new_context(viewport={"width": 320, "height": 240}, device_scale_factor=1)
            page = context.new_page()
            errors, requests = [], []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("request", lambda r: requests.append(r.url))
            response = page.goto(base + "/workbenches/landscape-full-r4/index.html", wait_until="domcontentloaded", timeout=60000)
            checks.append({"name": "HTTP document", "passed": response.status == 200})
            page.wait_for_function("window.__LM_READY__===true", timeout=480000)
            first = page.evaluate("window.__LM__.audit()")
            checks.append({"name": "default field rendered", "passed": first["glError"] == 0 and first["mean"] > 2 and first["hash"]})
            page.screenshot(path=str(OUT / "mobile-region.png"))
            page.evaluate("window.__LM__.setView('cliff')")
            page.wait_for_function("window.__LM_READY__===false", timeout=10000)
            page.wait_for_function("window.__LM_READY__===true", timeout=480000)
            cliff = page.evaluate("window.__LM__.audit()")
            checks.append({"name": "cliff view differs", "passed": cliff["glError"] == 0 and cliff["hash"] != first["hash"]})
            page.screenshot(path=str(OUT / "mobile-cliff.png"))
            page.evaluate("window.__LM__.setRock(0)")
            page.wait_for_function("window.__LM_READY__===true", timeout=480000)
            white = page.evaluate("window.__LM__.audit()")
            checks.append({"name": "rock appearance changes", "passed": white["hash"] != cliff["hash"]})
            page.evaluate("window.__LM__.setSeed(137)")
            page.wait_for_function("window.__LM_READY__===true", timeout=480000)
            seeded = page.evaluate("window.__LM__.audit()")
            checks.append({"name": "seed changes world", "passed": seeded["hash"] != white["hash"]})
            checks.append({"name": "no horizontal overflow", "passed": page.evaluate("document.documentElement.scrollWidth<=innerWidth")})
            outside = [u for u in requests if not u.startswith(base)]
            checks.append({"name": "no external runtime requests", "passed": not outside})
            checks.append({"name": "no script errors", "passed": not errors})
            evidence.update({"default": first, "cliff": cliff, "white": white, "seed137": seeded, "pageErrors": errors, "externalRequests": outside})
            assert all(x["passed"] for x in checks), json.dumps(evidence, ensure_ascii=False)
            context.close()
            browser.close()
    finally:
        server.shutdown()
        (OUT / "report.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2))
    print(json.dumps(evidence, ensure_ascii=False))

if __name__ == "__main__":
    main()
