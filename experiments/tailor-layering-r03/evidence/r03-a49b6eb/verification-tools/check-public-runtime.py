#!/usr/bin/env python3
"""Read actual public runtime bytes and compare them with the tested capsule."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener


class SameOriginRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(req.full_url).netloc != urlparse(newurl).netloc or urlparse(newurl).scheme != "https":
            raise ValueError("Public resource attempted an off-origin redirect")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--request", required=True, type=Path)
    parser.add_argument("--capsule", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    request = json.loads(args.request.read_text())
    capsule = json.loads(args.capsule.read_text())
    base = request["url"]
    source = request["sourceCommit"]
    assert base == "https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/layering-r03-20261021-a49b6eb/"
    assert source == capsule["sourceCommit"] == "a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b"
    entries = {item["path"]: item for item in capsule["entries"]}
    selected = sorted({p for p in entries if "/" not in p} | {
        "reference-body/manifest.json", "reference-body/geometry.bin.gz",
        "coordinate-adapter/continuous-solid.mjs", "coordinate-adapter/sewn-trims-mid-surface.mjs",
        "upstream/cloth-kernel.wasm", "upstream/native/P02.json.gz",
        "upstream/native/T03.json.gz", "upstream/native/T08.json.gz",
        "upstream/assets/PERSON_MANIFEST.json", "upstream/assets/native-person.json.gz",
        "upstream/runtime-tiles/knit-fine-0.json", "upstream/runtime-tiles/knit-soft-0.json",
        "upstream/runtime-tiles/denim-raw.json", "upstream/vendor/three.module.js",
        "upstream/person/Viewer.mjs", "upstream/person/load-person.mjs",
    })
    assert all(p in entries for p in selected)

    def fetch(name):
        expected = entries[name]
        url = base if name == "index.html" else urljoin(base, name)
        row = {"path": name, "requestedURL": url, "expectedSHA256": expected["sha256"],
               "expectedBytes": expected["bytes"], "passed": False}
        try:
            opener = build_opener(SameOriginRedirect())
            with opener.open(Request(url, headers={"Cache-Control": "no-cache", "Pragma": "no-cache"}), timeout=60) as response:
                data = response.read(expected["bytes"] + 1)
                row.update(status=response.status, finalURL=response.url, bytes=len(data),
                           sha256=hashlib.sha256(data).hexdigest(), contentType=response.headers.get("Content-Type"))
            assert row["status"] == 200 and row["finalURL"] == url
            assert row["bytes"] == expected["bytes"] and row["sha256"] == expected["sha256"]
            if name == "SOURCE_PROVENANCE.json":
                assert json.loads(data)["sourceCommit"] == source
                row["sourceCommitMatches"] = True
            if name == "index.html":
                assert source.encode() in data and "<title>独立衣物叠穿 · KAOPU R03</title>".encode() in data
                row["sourceAndVersionInBody"] = True
            row["passed"] = True
        except Exception as error:
            row["error"] = f"{type(error).__name__}: {error}"
        return row

    began = datetime.now(timezone.utc).isoformat()
    with ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(fetch, selected))
    result = {"schema": "tailor-r03-public-http-readback@1", "sourceCommit": source,
              "url": base, "startedUTC": began, "completedUTC": datetime.now(timezone.utc).isoformat(),
              "scope": "Exact entrance bytes, all root authored runtime files, native person, three native garments, material definitions, body geometry, WASM and Three.js",
              "passed": all(row["passed"] for row in rows), "resources": rows,
              "browserAcceptanceReplaced": False, "visualAcceptance": False, "productionReady": False}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x") as stream:
        json.dump(result, stream, indent=2)
        stream.write("\n")
    print(json.dumps({"passed": result["passed"], "resources": len(rows), "bytes": sum(r.get("bytes", 0) for r in rows),
                      "failures": [r for r in rows if not r["passed"]], "output": str(args.output)}, indent=2))
    raise SystemExit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
