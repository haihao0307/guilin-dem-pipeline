from __future__ import annotations

"""R07-P13 browser gate profile.

Run the complete, already-proven P12 geometry/visual QA as an isolated process,
then open one fresh browser and verify the P13 Palau-only runtime contract.
This avoids mutating nested QA source strings while still proving that the
Palau admission fields survive real parameter rebuilds.
"""

import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any

import websocket


P12_QA = Path(__file__).with_name("coral_r07_massive_p12_browser_qa.py")


def wait_json(url: str) -> Any:
    last: Exception | None = None
    for _ in range(180):
        try:
            with urllib.request.urlopen(url, timeout=2) as response:
                return json.load(response)
        except Exception as exc:
            last = exc
            time.sleep(0.2)
    raise last or RuntimeError(f"timed out waiting for {url}")


def runtime_gate(root: Path) -> dict[str, Any]:
    chrome = shutil.which("google-chrome") or shutil.which("chromium") or shutil.which("chromium-browser")
    if not chrome:
        raise RuntimeError("Chrome/Chromium unavailable")
    profile = "/tmp/coral-r07-p13-palau-runtime"
    shutil.rmtree(profile, ignore_errors=True)
    process = subprocess.Popen(
        [
            chrome,
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--remote-debugging-port=9581",
            "--remote-allow-origins=*",
            "--use-angle=swiftshader",
            "--enable-webgl",
            "--ignore-gpu-blocklist",
            "--window-size=1536,960",
            f"--user-data-dir={profile}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        target = next(t for t in wait_json("http://127.0.0.1:9581/json/list") if t.get("type") == "page")
        ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=60, origin="http://127.0.0.1")
        seq = 0

        def call(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
            nonlocal seq
            seq += 1
            ident = seq
            ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
            while True:
                message = json.loads(ws.recv())
                if message.get("id") == ident:
                    if "error" in message:
                        raise RuntimeError(message["error"])
                    return message.get("result", {})

        def evaluate(expression: str) -> Any:
            result = call(
                "Runtime.evaluate",
                {"expression": expression, "returnByValue": True, "awaitPromise": True},
            )
            remote = result.get("result", {})
            if remote.get("subtype") == "error":
                raise RuntimeError(remote.get("description", "browser evaluation failed"))
            return remote.get("value")

        call("Page.enable")
        call("Runtime.enable")
        call(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": (
                    "window.__p13Errors=[];"
                    "addEventListener('error',e=>window.__p13Errors.push(String(e.message||e.error||e)));"
                    "addEventListener('unhandledrejection',e=>window.__p13Errors.push(String(e.reason||e)));"
                )
            },
        )
        call("Page.navigate", {"url": "http://127.0.0.1:8773/"})
        time.sleep(12)

        def snapshot() -> dict[str, Any]:
            return json.loads(
                evaluate(
                    r'''JSON.stringify((()=>({
                      ready:document.readyState,title:document.title,errors:window.__p13Errors||[],
                      qa:window.__CORAL_R07_QA__||{},build:window.__CORAL_R07_BUILD__||{},
                      palau:window.__CORAL_R07_PALAU_ONLY__||{},
                      body:(document.body.innerText||'').slice(0,5000)
                    }))())'''
                )
            )

        initial = snapshot()
        assert initial["ready"] == "complete" and not initial["errors"], initial
        assert "R07-P13" in initial["body"] and "帕劳限定" in initial["body"], initial
        qa, build, palau = initial["qa"], initial["build"], initial["palau"]
        for obj, label in ((qa, "QA"), (build, "Build"), (palau, "Palau marker")):
            assert obj.get("palauOccurrenceStatus") == "CONFIRMED_PALAU", (label, obj)
            assert obj.get("palauOnlyProductionEligible") is True, (label, obj)
            assert obj.get("productionAdmission") == "PALAU_ONLY_ADMITTED", (label, obj)
            assert obj.get("localSitePlacementReady") is False, (label, obj)
        assert qa.get("palauEvidenceAuthority") == "NOAA_NCEI", qa
        assert qa.get("palauEvidenceDatasetId") == "noaa-coral-19702", qa
        assert build.get("version") == "R07-P13", build
        assert palau.get("productionMode") == "PALAU_ONLY", palau
        assert palau.get("nonPalauSpeciesRejected") is True, palau
        assert palau.get("genericIndoPacificEvidenceRejected") is True, palau
        assert palau.get("species") == "Porites lutea", palau

        rebuilds: list[dict[str, Any]] = []
        for slider_id, value in (("microDepth", 0.31), ("warp", 0.37), ("lobes", 0.22)):
            state = json.loads(
                evaluate(
                    f'''JSON.stringify((()=>{{
                      const e=document.getElementById({json.dumps(slider_id)});
                      if(!e)throw new Error('missing slider {slider_id}');
                      e.value={json.dumps(str(value))};
                      e.dispatchEvent(new Event('input',{{bubbles:true}}));
                      const q=window.__CORAL_R07_QA__||{{}};
                      return{{slider:{json.dumps(slider_id)},value:Number(e.value),
                        palauOccurrenceStatus:q.palauOccurrenceStatus,
                        palauOnlyProductionEligible:q.palauOnlyProductionEligible,
                        productionAdmission:q.productionAdmission,
                        localSitePlacementReady:q.localSitePlacementReady,
                        species:q.candidateSpecies||q.scientificName,
                        signature:q.geometrySignature,rebuildMs:q.rebuildMs}};
                    }})())'''
                )
            )
            assert state["palauOccurrenceStatus"] == "CONFIRMED_PALAU", state
            assert state["palauOnlyProductionEligible"] is True, state
            assert state["productionAdmission"] == "PALAU_ONLY_ADMITTED", state
            assert state["localSitePlacementReady"] is False, state
            assert state["species"] == "Porites lutea", state
            assert state["rebuildMs"] < 8000, state
            rebuilds.append(state)

        final = snapshot()
        assert not final["errors"], final
        ws.close()
        return {
            "passed": True,
            "runtimeErrors": 0,
            "productionMode": "PALAU_ONLY",
            "species": "Porites lutea",
            "palauOccurrenceStatus": "CONFIRMED_PALAU",
            "palauOnlyProductionEligible": True,
            "productionAdmission": "PALAU_ONLY_ADMITTED",
            "localSitePlacementReady": False,
            "rebuildPersistence": rebuilds,
        }
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: coral_r07_massive_p13_browser_qa.py <build-dir>")
    root = Path(sys.argv[1])

    subprocess.run([sys.executable, str(P12_QA), str(root)], check=True)

    build_path = root / "BUILD_R07_P00.json"
    classification_path = root / "NOAA_CLASSIFICATION.json"
    evidence_path = root / "PALAU_OCCURRENCE_EVIDENCE.json"
    receipt_path = root / "PALAU_ONLY_GATE_RECEIPT.json"
    for path in (build_path, classification_path, evidence_path, receipt_path):
        if not path.is_file():
            raise RuntimeError(f"P13 evidence file missing: {path}")

    build = json.loads(build_path.read_text(encoding="utf-8"))
    classification = json.loads(classification_path.read_text(encoding="utf-8"))
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    assert build.get("schema") == "CORAL_MOTHER_R07_MASSIVE_P13_BUILD", build
    assert classification.get("palauOccurrenceStatus") == "CONFIRMED_PALAU", classification
    assert classification.get("palauOnlyProductionEligible") is True, classification
    assert evidence.get("productionAdmission") == "PALAU_ONLY_ADMITTED", evidence
    assert evidence.get("otherRegionEvidenceUsedForAdmission") is False, evidence
    assert evidence.get("genericIndoPacificEvidenceUsedForAdmission") is False, evidence
    assert receipt.get("passed") is True and receipt.get("productionMode") == "PALAU_ONLY", receipt

    runtime = runtime_gate(root)
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["palauOnlyBrowserQA"] = runtime
    build.setdefault("functionalGates", {}).update(
        {
            "palauOnlyProductionMode": True,
            "palauSpeciesOccurrenceConfirmed": True,
            "speciesLevelEvidence": True,
            "noaaNceiDatasetGate": True,
            "nonPalauSpeciesRejected": True,
            "genericIndoPacificEvidenceRejected": True,
            "localSitePlacementSeparate": True,
            "palauGatePersistsAcrossRebuilds": True,
        }
    )
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
