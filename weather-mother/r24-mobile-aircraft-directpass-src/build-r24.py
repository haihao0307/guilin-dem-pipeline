from __future__ import annotations
import base64
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE_COMMIT = "8aeb8dac519f8bda851cfc998e07266870d3eaef"
BASE_PATH = "weather-mother/full-weather-r22-20260909/index.html"
R23_SAFE = ROOT / "weather-mother/r23-mobile-recovery-src/mobile-safe-aircraft.html"
OVERLAY = ROOT / "weather-mother/r24-mobile-aircraft-directpass-src/aircraft-directpass.js"
OUT = ROOT / "weather-mother/full-weather-r24-mobile-aircraft-directpass-20260911/index.html"

base = subprocess.check_output(["git", "show", f"{BASE_COMMIT}:{BASE_PATH}"], cwd=ROOT).decode("utf-8")
safe = R23_SAFE.read_text(encoding="utf-8")
overlay = OVERLAY.read_text(encoding="utf-8")

# Keep the user-proven R23 cloud renderer byte-for-byte, adding only a separate
# Canvas2D aircraft layer before the mobile document closes.
idx = safe.lower().rfind("</body>")
if idx < 0:
    raise SystemExit("R23 mobile source has no closing body")
safe_r24 = safe[:idx] + "\n<script>\n" + overlay + "\n</script>\n" + safe[idx:]
safe_r24 = safe_r24.replace("<title>Weather Mother · R23 Mobile Silver Flight</title>", "<title>Weather Mother · R24 Mobile Aircraft Direct Pass</title>", 1)
safe64 = base64.b64encode(safe_r24.encode("utf-8")).decode("ascii")

patch = f'''\n<script id="weather-mother-r24-mobile-aircraft-directpass">\n(()=>{{'use strict';\nconst isAppleMobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);\nconst compactTouch=innerWidth<=700&&navigator.maxTouchPoints>0;\nif(!(isAppleMobile||compactTouch))return;\ndocument.documentElement.dataset.weatherMobileAircraftDirect='r24';\nconst safe=decodeURIComponent(escape(atob('{safe64}')));\nlet timer=0;\nfunction patchAircraft(){{\n  for(const f of document.querySelectorAll('iframe[data-key="aircraft"]')){{\n    if(f.dataset.mobileAircraftDirect==='r24')continue;\n    f.dataset.mobileAircraftDirect='r24';\n    f.dataset.mobileCloudFirst='r23-preserved';\n    f.srcdoc=safe;\n  }}\n  clearTimeout(timer);timer=setTimeout(patchAircraft,160);\n}}\nnew MutationObserver(patchAircraft).observe(document.documentElement,{{childList:true,subtree:true}});\naddEventListener('resize',patchAircraft);patchAircraft();\n}})();\n</script>\n'''

# R22 contains nested HTML strings, so inject only before the OUTERMOST final html tag.
idx = base.lower().rfind("</html>")
if idx < 0:
    out = base + patch
else:
    out = base[:idx] + patch + base[idx:]
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out, encoding="utf-8")
print(OUT)
print(f"base_bytes={len(base.encode('utf-8'))} mobile_r24_bytes={len(safe_r24.encode('utf-8'))} out_bytes={len(out.encode('utf-8'))}")
