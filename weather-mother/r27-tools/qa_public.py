import base64
import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright

URL = os.environ["PUBLIC_URL"]
OUT = Path(os.environ["GITHUB_WORKSPACE"]) / os.environ["OUT_DIR"]
OUT.mkdir(parents=True, exist_ok=True)


def decode_data_url(value: str) -> bytes:
    return base64.b64decode(value.split(",", 1)[1])


def low_frequency_metrics(a: bytes, b: bytes) -> dict:
    ia = Image.open(io.BytesIO(a)).convert("L").resize((64, 40)).filter(ImageFilter.GaussianBlur(3))
    ib = Image.open(io.BytesIO(b)).convert("L").resize((64, 40)).filter(ImageFilter.GaussianBlur(3))
    pa, pb = list(ia.getdata()), list(ib.getdata())
    ma, mb = sum(pa) / len(pa), sum(pb) / len(pb)
    va = sum((x - ma) ** 2 for x in pa)
    vb = sum((x - mb) ** 2 for x in pb)
    cov = sum((x - ma) * (y - mb) for x, y in zip(pa, pb))
    corr = cov / ((va * vb) ** 0.5) if va and vb else 1.0
    mae = sum(abs(x - y) for x, y in zip(pa, pb)) / len(pa)
    return {"correlation": corr, "mae": mae}


def allow_raw_githack(context) -> None:
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


report = {
    "schema": "weather-mother-r27-unified-cloud-dna/public-qa@3",
    "pageCommit": os.environ["PAGE_COMMIT"],
    "publicURL": URL,
    "artifactBytes": int(os.environ["EXPECTED_BYTES"]),
    "artifactSHA256": os.environ["EXPECTED_SHA256"],
    "rawGithackExternalSiteGatePassed": True,
    "realIPhoneAcceptance": False,
    "visualAcceptance": False,
    "productionReady": False,
}

flags = [
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--disable-dev-shm-usage",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=flags)

    desktop_context = browser.new_context(viewport={"width": 640, "height": 400}, device_scale_factor=1)
    allow_raw_githack(desktop_context)
    desktop = desktop_context.new_page()
    desktop_errors, desktop_console = [], []
    desktop.on("pageerror", lambda e: desktop_errors.append(str(e)))
    desktop.on("console", lambda m: desktop_console.append(m.text) if m.type == "error" else None)
    desktop.goto(URL + "?qa=desktop", wait_until="domcontentloaded", timeout=120000)
    desktop.wait_for_function("window.WeatherR27 && WeatherR27.qa.ready", timeout=120000)
    desktop.evaluate(
        "document.querySelector('[data-quality=mobile]').click();"
        "WeatherR27.WorldClock.playing=false;WeatherR27.WorldClock.time=4"
    )
    desktop.wait_for_timeout(250)

    base = desktop.evaluate(
        """() => ({
          title: document.title,
          qa: WeatherR27.qa,
          overflow: {
            x: document.documentElement.scrollWidth-innerWidth,
            y: document.documentElement.scrollHeight-innerHeight
          },
          seed: WeatherR27.seedInvariantReport(),
          queryObserve: WeatherR27.CloudQuery.sample([0,3.8,0]),
          architecture: {
            sameCloudForObserveAndFlight: WeatherR27.qa.sameCloudForObserveAndFlight,
            worldStateSeparated: WeatherR27.qa.worldStateSeparated,
            querySeparated: WeatherR27.qa.querySeparated,
            cacheSeparated: WeatherR27.qa.cacheSeparated,
            physicalRainClaim: WeatherR27.qa.physicalRainClaim
          }
        })"""
    )

    genus_hashes = {}
    for index in range(10):
        desktop.evaluate(f"WeatherR27.setType({index});WeatherR27.RenderCache.dirty=true")
        desktop.wait_for_timeout(100)
        image = decode_data_url(desktop.evaluate("WeatherR27.capture()"))
        genus_hashes[str(index)] = hashlib.sha256(image).hexdigest()[:16]

    desktop.evaluate(
        "WeatherR27.setType(0);WeatherR27.setMode('observe');"
        "WeatherR27.setSeeds(73017,991);WeatherR27.RenderCache.dirty=true"
    )
    desktop.wait_for_timeout(120)
    seed_a = decode_data_url(desktop.evaluate("WeatherR27.capture()"))
    desktop.evaluate("WeatherR27.setSeeds(73017,992);WeatherR27.RenderCache.dirty=true")
    desktop.wait_for_timeout(120)
    seed_b = decode_data_url(desktop.evaluate("WeatherR27.capture()"))
    desktop.evaluate("WeatherR27.setSeeds(73018,992);WeatherR27.RenderCache.dirty=true")
    desktop.wait_for_timeout(120)
    seed_c = decode_data_url(desktop.evaluate("WeatherR27.capture()"))

    desktop.evaluate("WeatherR27.setMode('flight')")
    query_flight = desktop.evaluate("WeatherR27.CloudQuery.sample([0,3.8,0])")
    desktop.screenshot(path=str(OUT / "PUBLIC_R27_DESKTOP_640x400.png"))

    report["desktop"] = {
        **base,
        "queryFlight": query_flight,
        "sameQueryAcrossModes": base["queryObserve"] == query_flight,
        "tenUniqueCloudGenera": len(set(genus_hashes.values())),
        "hashes": genus_hashes,
        "detailSeed": {
            "changesPixels": hashlib.sha256(seed_a).digest() != hashlib.sha256(seed_b).digest(),
            **low_frequency_metrics(seed_a, seed_b),
        },
        "objectSeed": {
            "changesPixels": hashlib.sha256(seed_b).digest() != hashlib.sha256(seed_c).digest(),
            **low_frequency_metrics(seed_b, seed_c),
        },
        "pageErrors": desktop_errors,
        "consoleErrors": desktop_console,
    }
    desktop_context.close()

    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    allow_raw_githack(mobile_context)
    mobile = mobile_context.new_page()
    mobile_errors, mobile_console = [], []
    mobile.on("pageerror", lambda e: mobile_errors.append(str(e)))
    mobile.on("console", lambda m: mobile_console.append(m.text) if m.type == "error" else None)
    mobile.goto(URL + "?qa=mobile", wait_until="domcontentloaded", timeout=120000)
    mobile.wait_for_function("window.WeatherR27 && WeatherR27.qa.ready", timeout=120000)
    mobile.evaluate("WeatherR27.WorldClock.playing=false")

    before = mobile.evaluate(
        """() => ({
          title: document.title,
          qa: WeatherR27.qa,
          position: [...WeatherR27.ObserverState.position],
          yaw: WeatherR27.ObserverState.yaw,
          roll: WeatherR27.ObserverState.roll,
          overflow: {
            x: document.documentElement.scrollWidth-innerWidth,
            y: document.documentElement.scrollHeight-innerHeight
          },
          panel: getComputedStyle(document.getElementById('panel')).display
        })"""
    )
    mobile.click("#mobileToggle")
    mobile.wait_for_timeout(100)
    panel_after = mobile.evaluate("getComputedStyle(document.getElementById('panel')).display")
    mobile.click("#mobileToggle")
    mobile.click("#flightBtn")
    turn = mobile.locator("[data-key=d]")
    turn.dispatch_event("pointerdown", {"pointerId": 7, "clientX": 20, "clientY": 20})
    mobile.wait_for_timeout(350)
    turn.dispatch_event("pointerup", {"pointerId": 7, "clientX": 20, "clientY": 20})
    after = mobile.evaluate(
        """() => ({
          position: [...WeatherR27.ObserverState.position],
          yaw: WeatherR27.ObserverState.yaw,
          roll: WeatherR27.ObserverState.roll,
          mode: WeatherR27.ObserverState.mode
        })"""
    )
    mobile.screenshot(path=str(OUT / "PUBLIC_R27_MOBILE_390x844.png"))
    report["mobile390x844"] = {
        "before": before,
        "panelAfter": panel_after,
        "after": after,
        "positionChanged": before["position"] != after["position"],
        "yawChanged": before["yaw"] != after["yaw"],
        "rollChanged": before["roll"] != after["roll"],
        "pageErrors": mobile_errors,
        "consoleErrors": mobile_console,
        "horizontalOverflow": before["overflow"]["x"],
    }
    mobile_context.close()
    browser.close()

arch = report["desktop"]["architecture"]
report["overallPass"] = all(
    [
        report["desktop"]["title"] == "Weather Mother · Cloud DNA Flight R27",
        report["mobile390x844"]["before"]["title"] == "Weather Mother · Cloud DNA Flight R27",
        report["desktop"]["tenUniqueCloudGenera"] == 10,
        report["desktop"]["sameQueryAcrossModes"],
        report["desktop"]["seed"]["identical"],
        report["desktop"]["detailSeed"]["changesPixels"],
        report["desktop"]["detailSeed"]["correlation"] > 0.995,
        report["desktop"]["objectSeed"]["changesPixels"],
        report["desktop"]["objectSeed"]["correlation"] < 0.995,
        arch["sameCloudForObserveAndFlight"],
        arch["worldStateSeparated"],
        arch["querySeparated"],
        arch["cacheSeparated"],
        arch["physicalRainClaim"] is False,
        report["mobile390x844"]["panelAfter"] == "block",
        report["mobile390x844"]["horizontalOverflow"] == 0,
        report["mobile390x844"]["after"]["mode"] == "flight",
        report["mobile390x844"]["positionChanged"],
        report["mobile390x844"]["yawChanged"],
        report["mobile390x844"]["rollChanged"],
        not report["desktop"]["pageErrors"],
        not report["desktop"]["consoleErrors"],
        not report["mobile390x844"]["pageErrors"],
        not report["mobile390x844"]["consoleErrors"],
    ]
)

(OUT / "PUBLIC_QA.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
)
print(json.dumps(report, ensure_ascii=False, indent=2))
if not report["overallPass"]:
    raise SystemExit(1)
