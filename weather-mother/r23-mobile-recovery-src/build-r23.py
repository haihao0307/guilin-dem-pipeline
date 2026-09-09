from __future__ import annotations
import base64
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
BASE_COMMIT = "8aeb8dac519f8bda851cfc998e07266870d3eaef"
BASE_PATH = "weather-mother/full-weather-r22-20260909/index.html"
FALLBACK = ROOT / "weather-mother/r23-mobile-recovery-src/mobile-safe-aircraft.html"
OUT = ROOT / "weather-mother/full-weather-r23-mobile-cloud-first-20260910/index.html"

base = subprocess.check_output(["git", "show", f"{BASE_COMMIT}:{BASE_PATH}"], cwd=ROOT).decode("utf-8")
safe = FALLBACK.read_text(encoding="utf-8")
safe64 = base64.b64encode(safe.encode("utf-8")).decode("ascii")

patch = f'''\n<script id="weather-mother-r23-mobile-cloud-first">\n(()=>{{'use strict';\nconst isAppleMobile=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);\nconst compactTouch=innerWidth<=700&&navigator.maxTouchPoints>0;\nif(!(isAppleMobile||compactTouch))return;\ndocument.documentElement.dataset.weatherMobileCloudFirst='r23';\nconst safe=decodeURIComponent(escape(atob('{safe64}')));\nlet timer=0;\nfunction patchAircraft(){{\n  for(const f of document.querySelectorAll('iframe[data-key="aircraft"]')){{\n    if(f.dataset.mobileCloudFirst==='r23')continue;\n    f.dataset.mobileCloudFirst='r23';\n    f.srcdoc=safe;\n  }}\n  clearTimeout(timer);timer=setTimeout(patchAircraft,120);\n}}\nnew MutationObserver(patchAircraft).observe(document.documentElement,{{childList:true,subtree:true}});\naddEventListener('resize',patchAircraft);patchAircraft();\n}})();\n</script>\n'''

marker = "</body>"
if marker in base:
    out = base.replace(marker, patch + marker, 1)
else:
    out = base + patch
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out, encoding="utf-8")
print(OUT)
print(f"base_bytes={len(base.encode('utf-8'))} fallback_bytes={len(safe.encode('utf-8'))} out_bytes={len(out.encode('utf-8'))}")
