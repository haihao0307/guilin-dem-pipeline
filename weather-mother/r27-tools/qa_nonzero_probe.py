import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

url = os.environ["PUBLIC_URL"]
out = Path(os.environ["GITHUB_WORKSPACE"]) / os.environ["OUT_DIR"]
out.mkdir(parents=True, exist_ok=True)

flags = [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=flags)
    context = browser.new_context(viewport={"width": 640, "height": 400}, device_scale_factor=1)
    context.add_cookies(
        [
            {
                "name": "__Http-phish",
                "value": "1",
                "url": "https://raw.githack.com/",
                "secure": True,
                "httpOnly": True,
                "sameSite": "Lax",
            }
        ]
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url + "?qa=nonzero-shared-density", wait_until="domcontentloaded", timeout=120000)
    page.wait_for_function("window.WeatherR27 && WeatherR27.qa.ready", timeout=120000)
    page.evaluate("WeatherR27.WorldClock.playing=false;WeatherR27.setType(0);WeatherR27.setSeeds(73017,991);WeatherR27.setMode('observe')")
    probe = page.evaluate(
        """() => {
          let best = { point: [0, 0, 0], value: -1 };
          for (let y = 2.0; y <= 6.0; y += 0.25) {
            for (let z = -10; z <= 10; z += 0.5) {
              for (let x = -8; x <= 8; x += 0.5) {
                const point = [x, y, z];
                const value = WeatherR27.CloudQuery.sample(point);
                if (value > best.value) best = { point, value };
              }
            }
          }
          return best;
        }"""
    )
    page.evaluate("WeatherR27.setMode('flight')")
    flight_value = page.evaluate("point => WeatherR27.CloudQuery.sample(point)", probe["point"])
    context.close()
    browser.close()

report = {
    "schema": "weather-mother-r27-unified-cloud-dna/nonzero-shared-density@1",
    "pageCommit": os.environ["PAGE_COMMIT"],
    "publicURL": url,
    "cloudType": "Cumulus",
    "objectSeed": 73017,
    "detailSeed": 991,
    "probePoint": probe["point"],
    "observeDensity": probe["value"],
    "flightDensity": flight_value,
    "nonzero": probe["value"] > 0.01,
    "identicalAcrossModes": probe["value"] == flight_value,
    "pageErrors": errors,
}
report["pass"] = report["nonzero"] and report["identicalAcrossModes"] and not errors
(out / "PUBLIC_NONZERO_QUERY_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["pass"]:
    raise SystemExit(1)
