#!/usr/bin/env python3
"""Real-browser regression for the locally authored FH88 motion preview.

Requires only Python's standard library and PREINSTALLED Chrome + ChromeDriver.
No downloader, installer, package manager, repository operation, or CI trigger.
No original/archive/teacher assets are opened. The HTTP server is loopback-only,
root-confined, has no directory listing, and refuses scripts and test outputs.

Usage on an already authorized, isolated runner:
    python3 ci_render.py
    python3 ci_render.py --out /tmp/fh88-render-results
    python3 ci_render.py --self-test  # pure local checks; no browser or socket
    python3 ci_render.py --sequence-frames 24  # optional real mechanism frames

The screenshots come from WebDriver's actual composited canvas element. This
avoids relying on preserveDrawingBuffer or an app-supplied image. PNG pixel
hashes (not compression-dependent file hashes) are compared for restoration.
A PASS is produced only by a completed browser run, never by static tests.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
import zlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parent
ALLOWED_SUFFIXES = {
    ".html", ".css", ".js", ".mjs", ".json", ".bin", ".glb", ".gltf",
    ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2",
}
EPSILON = 1e-7
MAX_ARTIFACT_BYTES = 30_000_000
RESERVED_REPORT_BYTES = 2_000_000
MAX_DRIVER_LOG_BYTES = 1_000_000
ARTIFACT_ROOT = None


class ArtifactBudgetExceeded(RuntimeError):
    pass


def artifact_bytes(root: Path) -> int:
    return sum(p.stat().st_size for p in root.rglob("*") if p.is_file())


def artifact_write(path: Path, data: bytes, final_report=False) -> None:
    if ARTIFACT_ROOT is not None:
        used = artifact_bytes(ARTIFACT_ROOT)
        previous = path.stat().st_size if path.exists() else 0
        limit = MAX_ARTIFACT_BYTES if final_report else MAX_ARTIFACT_BYTES - RESERVED_REPORT_BYTES - MAX_DRIVER_LOG_BYTES
        if used - previous + len(data) > limit:
            raise ArtifactBudgetExceeded("30 MB total artifact budget: required screenshots and final report take priority")
    path.write_bytes(data)

CASES = (("full", "overview"), ("mechanism", "side"), ("mechanism", "inside"))
# Request/JS-error accounting is page-scoped, not a whole-machine network trace.
CSP = "; ".join((
    "default-src 'none'", "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "connect-src 'self'", "font-src 'self'", "worker-src 'none'",
    "frame-src 'none'", "object-src 'none'", "base-uri 'none'",
    "form-action 'none'", "media-src 'none'",
))


def clean_environment(home: Path) -> dict[str, str]:
    """Allowlist, not a token-name denylist. Browser inherits no runner secrets."""
    home.mkdir(parents=True, exist_ok=True)
    for name in ("tmp", "config", "cache"):
        (home / name).mkdir(exist_ok=True)
    return {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC",
        "HOME": str(home), "TMPDIR": str(home / "tmp"),
        "XDG_CONFIG_HOME": str(home / "config"),
        "XDG_CACHE_HOME": str(home / "cache"),
    }


def json_write(path: Path, obj) -> None:
    encoded = (json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    if path.name == "TEST_RESULTS.json" and len(encoded) > RESERVED_REPORT_BYTES:
        # Snapshot files already preserve full geometry. Bound duplicate inline
        # diagnostics without silently omitting the fact that they were trimmed.
        obj = dict(obj)
        obj["reportDetailTrimmedForArtifactBudget"] = True
        obj["cases"] = [{k: v for k, v in c.items() if k != "snapshots"} for c in obj.get("cases", [])]
        if "logs" in obj:
            obj["logs"] = {k: (v[:100] if isinstance(v, list) else v) for k, v in obj["logs"].items()}
        encoded = (json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode("utf-8")
    artifact_write(path, encoded, final_report=path.name == "TEST_RESULTS.json")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def resolved_file(root: Path, request_path: str, excluded: Path) -> Path | None:
    """Reject traversal, hidden files, symlink escape, and render outputs."""
    decoded = urllib.parse.unquote(urllib.parse.urlsplit(request_path).path)
    if "\\" in decoded or "\x00" in decoded:
        return None
    parts = decoded.lstrip("/").split("/")
    if any(p.startswith(".") for p in parts if p):
        return None
    if decoded in ("", "/"):
        decoded = "/index.html"
    path = (root / decoded.lstrip("/")).resolve()
    try:
        path.relative_to(root.resolve())
    except ValueError:
        return None
    if path == excluded or excluded in path.parents:
        return None
    if not path.is_file() or path.suffix.lower() not in ALLOWED_SUFFIXES:
        return None
    return path


def make_handler(root: Path, out: Path, requests: list, audit_lock: threading.Lock):
    class Handler(SimpleHTTPRequestHandler):
        protocol_version = "HTTP/1.1"

        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(root), **kwargs)

        def list_directory(self, path):
            self.send_error(404)
            return None

        def end_headers(self):
            self.send_header("Cache-Control", "no-store, max-age=0")
            self.send_header("Content-Security-Policy", CSP)
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            super().end_headers()

        def send_head(self):
            if urllib.parse.urlsplit(self.path).path == "/favicon.ico":
                self.send_response(204)
                self.send_header("Content-Length", "0")
                self.end_headers()
                return None
            path = resolved_file(root, self.path, out)
            if path is None:
                self.send_error(404, "File unavailable")
                return None
            # Parent handler's fallback directory/traversal behavior is unused.
            try:
                stream = path.open("rb")
                size = os.fstat(stream.fileno()).st_size
            except OSError:
                self.send_error(404)
                return None
            self.send_response(200)
            content_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
            if path.suffix in (".js", ".mjs"):
                content_type = "text/javascript"
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            return stream

        def log_request(self, code="-", size="-"):
            with audit_lock:
                requests.append({"method": self.command, "path": self.path, "status": code})

        def log_message(self, *args):
            pass

    return Handler


def request_json(method: str, url: str, data=None):
    # Explicitly ignore inherited HTTP(S)_PROXY settings, also for loopback.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(
        url, data=json.dumps(data, allow_nan=False).encode() if data is not None else None,
        headers={"Content-Type": "application/json"}, method=method,
    )
    try:
        with opener.open(req, timeout=90) as response:
            result = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"WebDriver HTTP {exc.code}: {exc.read().decode(errors='replace')[:4000]}") from exc
    value = result.get("value", result)
    if isinstance(value, dict) and value.get("error"):
        raise RuntimeError(json.dumps(value, ensure_ascii=False)[:4000])
    return value


def png_pixels(data: bytes) -> tuple[int, int, bytes]:
    """Decode Chrome's non-interlaced 8-bit RGB/RGBA PNG with stdlib only."""
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Screenshot is not a PNG")
    pos, compressed, header = 8, bytearray(), None
    while pos + 12 <= len(data):
        length = struct.unpack(">I", data[pos:pos + 4])[0]
        kind, body = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + length]
        if len(body) != length or pos + 12 + length > len(data):
            raise ValueError("Truncated PNG")
        expected_crc = struct.unpack(">I", data[pos + 8 + length:pos + 12 + length])[0]
        if zlib.crc32(kind + body) & 0xffffffff != expected_crc:
            raise ValueError("PNG checksum mismatch")
        if kind == b"IHDR":
            header = struct.unpack(">IIBBBBB", body)
        elif kind == b"IDAT":
            compressed.extend(body)
        elif kind == b"IEND":
            break
        pos += length + 12
    if header is None:
        raise ValueError("Missing PNG header")
    width, height, depth, color, compression, filtering, interlace = header
    if not (0 < width <= 8192 and 0 < height <= 8192 and depth == 8 and color in (2, 6)
            and compression == 0 and filtering == 0 and interlace == 0):
        raise ValueError(f"Unsupported screenshot PNG format: {header}")
    channels = 3 if color == 2 else 4
    stride = width * channels
    decompressor = zlib.decompressobj()
    raw = decompressor.decompress(bytes(compressed), (stride + 1) * height + 1)
    if len(raw) != (stride + 1) * height or not decompressor.eof:
        raise ValueError("Unexpected PNG pixel data size")
    previous = bytearray(stride)
    rgba = bytearray(width * height * 4)
    for row in range(height):
        base = row * (stride + 1)
        filter_kind = raw[base]
        current = bytearray(raw[base + 1:base + 1 + stride])
        if filter_kind > 4:
            raise ValueError("Unknown PNG filter")
        for i in range(stride):
            a = current[i - channels] if i >= channels else 0
            b = previous[i]
            c = previous[i - channels] if i >= channels else 0
            if filter_kind == 1:
                predictor = a
            elif filter_kind == 2:
                predictor = b
            elif filter_kind == 3:
                predictor = (a + b) // 2
            elif filter_kind == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                predictor = a if pa <= pb and pa <= pc else b if pb <= pc else c
            else:
                predictor = 0
            current[i] = (current[i] + predictor) & 255
        if channels == 4:
            rgba[row * width * 4:(row + 1) * width * 4] = current
        else:
            start = row * width * 4
            for x in range(width):
                rgba[start + x * 4:start + x * 4 + 4] = current[x * 3:x * 3 + 3] + b"\xff"
        previous = current
    return width, height, bytes(rgba)


def image_info(data: bytes) -> dict:
    width, height, rgba = png_pixels(data)
    # Sample at most ~100,000 real pixels, enough to reject blank canvas output.
    step = max(1, width * height // 100000)
    colors = {rgba[i * 4:i * 4 + 4] for i in range(0, width * height, step)}
    return {
        "width": width, "height": height, "bytes": len(data),
        "fileSha256": sha256(data), "pixelSha256": sha256(rgba),
        "sampledDistinctColors": len(colors),
    }


def numeric_leaves(value, path="") -> dict[str, float]:
    result = {}
    if isinstance(value, bool) or value is None:
        return result
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise AssertionError(f"Non-finite snapshot number at {path}")
        result[path] = float(value)
    elif isinstance(value, dict):
        for key, child in sorted(value.items()):
            result.update(numeric_leaves(child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            result.update(numeric_leaves(child, f"{path}[{index}]"))
    return result


def compare_numeric(left, right) -> dict:
    a, b = numeric_leaves(left), numeric_leaves(right)
    if a.keys() != b.keys():
        return {"sameKeys": False, "maxDelta": None, "changed": [], "equal": False}
    deltas = [(key, abs(value - b[key])) for key, value in a.items()]
    changed = [{"path": key, "delta": delta} for key, delta in deltas if delta > EPSILON]
    return {
        "sameKeys": True, "numericCount": len(a),
        "maxDelta": max((d for _, d in deltas), default=0),
        "changed": changed, "equal": not changed,
    }


def stable_json(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def geometry_view(snapshot: dict):
    """Only actual geometry; changing time or UI metadata cannot prove motion."""
    if "geometry" in snapshot:
        return snapshot["geometry"]
    return {key: snapshot[key] for key in ("bodyTravelM", "bodyMountLiftM", "wheels", "mainRods", "couplingRods") if key in snapshot}


def snapshot_metrics(start: dict, half: dict, restored: dict) -> dict:
    """Collect snapshot evidence. Main-rod/axle checks use the agreed API schema."""
    geometry_start, geometry_half, geometry_restore = map(geometry_view, (start, half, restored))
    motion = compare_numeric(geometry_start, geometry_half)
    restoration = compare_numeric(geometry_start, geometry_restore)
    return {
        "geometryMotion": motion,
        "geometryRestore": restoration,
        "geometryExactRestore": stable_json(geometry_start) == stable_json(geometry_restore),
        "geometryHashes": {"t0": sha256(stable_json(geometry_start).encode()),
                           "t0_5": sha256(stable_json(geometry_half).encode()),
                           "t0_restored": sha256(stable_json(geometry_restore).encode())},
    }


def semantic_metrics(start: dict, half: dict, restored: dict) -> dict:
    """Independently check the snapshot's three rods and unequal wheel radii.

    This certifies the tested SI kinematic relationships, not physical contact,
    inner crank-web construction, solid-volume clearance, or whole-train dynamics.
    """
    violations, rods, wheels = [], [], []

    def check(condition, message):
        if not condition:
            violations.append(message)

    def near(a, b, tolerance=EPSILON):
        return abs(a - b) <= tolerance

    def distance(a, b):
        return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

    def local(point, snapshot):
        return [point[0] - snapshot["bodyTravelM"], point[1], point[2]]

    expected_ids = {"left", "right", "inside"}
    for phase, snap, expected_time in (("t0", start, 0), ("t0_5", half, 0.5), ("restored", restored, 0)):
        for field in ("timeS", "state", "bodyTravelM", "wheels", "mainRods", "couplingRods", "nominalContact"):
            check(field in snap, phase + ": missing " + field)
        if violations:
            return {"violations": violations, "mainRods": rods, "wheels": wheels}
        check(near(snap["timeS"], expected_time), phase + ": wrong requested phase time")
        check(near(snap["state"]["worldTimeS"], expected_time), phase + ": state time does not match UI phase")
        check(near(snap["state"]["omegaRadS"], -1.3), phase + ": prescribed angular velocity changed")
        check(snap.get("oldUpdateCalls") == 0, phase + ": frozen source update must never run")
        check(len(snap["mainRods"]) == 3 and {r["id"] for r in snap["mainRods"]} == expected_ids,
              phase + ": expected exactly the left/right/inside main rods")
        for rod in snap["mainRods"]:
            a, b = rod["endpointsM"]
            check(len(a) == len(b) == 3, phase + ": rod endpoints must be 3D")
            check(near(rod["lengthM"], 3.2), phase + ": " + rod["id"] + " nominal rod length is not 3.2 m")
            check(near(distance(a, b), 3.2), phase + ": " + rod["id"] + " world rod endpoints are not 3.2 m apart")
            endpoint_error = min(max(distance(a, rod["crankPinM"]), distance(b, rod["crossheadM"])),
                                 max(distance(b, rod["crankPinM"]), distance(a, rod["crossheadM"])))
            check(endpoint_error <= EPSILON, phase + ": rod mesh endpoints do not meet the pins")
        check(len(snap["wheels"]) > 0 and len({w["id"] for w in snap["wheels"]}) == len(snap["wheels"]),
              phase + ": wheel identities missing or duplicated")
        for wheel in snap["wheels"]:
            check(wheel["radiusM"] > 0 and wheel["halfWidthM"] > 0, phase + ": nonpositive wheel size")
            check(near(wheel["centreM"][2], wheel["radiusM"]), phase + ": wheel nominal bottom is off z=0")
        for rod in snap["couplingRods"]:
            check(near(distance(*rod["endpointsM"]), rod["lengthM"]), phase + ": coupling rod length changed")
        contact = snap["nominalContact"]
        check(contact["pureRolling"] is True and near(contact["contactPointLongitudinalVelocityMS"], 0),
              phase + ": nominal contact has longitudinal slip")
        check(contact.get("actualTreadOrAdhesionValidated") is False,
              phase + ": nominal-only contact limitation must stay explicit")
    if violations:
        return {"violations": violations, "mainRods": rods, "wheels": wheels}
    at0 = {r["id"]: r for r in start["mainRods"]}
    at_half = {r["id"]: r for r in half["mainRods"]}
    for identity in sorted(expected_ids):
        a, b = at0[identity], at_half[identity]
        local_a = [local(point, start) for point in a["endpointsM"]]
        local_b = [local(point, half) for point in b["endpointsM"]]
        local_delta = compare_numeric(local_a, local_b)
        world_delta = compare_numeric(a["endpointsM"], b["endpointsM"])
        check(not local_delta["equal"], identity + ": rod did not articulate relative to the moving train")
        check(near(a["crossheadM"][1], b["crossheadM"][1]) and near(a["crossheadM"][2], b["crossheadM"][2]),
              identity + ": crosshead left its prescribed inline guide")
        rods.append({"id": identity, "nominalLengthM": a["lengthM"],
                     "t0MeasuredLengthM": distance(*a["endpointsM"]),
                     "t0_5MeasuredLengthM": distance(*b["endpointsM"]),
                     "maxVehicleFrameEndpointDeltaM": local_delta["maxDelta"],
                     "maxWorldEndpointDeltaM": world_delta["maxDelta"],
                     "vehicleFrameCrossheadTravelM": local(b["crossheadM"], half)[0] - local(a["crossheadM"], start)[0]})
    start_wheels = {w["id"]: w for w in start["wheels"]}
    half_wheels = {w["id"]: w for w in half["wheels"]}
    check(start_wheels.keys() == half_wheels.keys(), "Wheel identities change during motion")
    driving_radii = [w["radiusM"] for w in start["wheels"] if w["driver"]]
    check(bool(driving_radii), "Missing driving wheels")
    if violations:
        return {"violations": violations, "mainRods": rods, "wheels": wheels}
    reference_radius = driving_radii[0]
    check(all(near(r, reference_radius) for r in driving_radii), "Driving-wheel radii disagree")
    check(len({round(w["radiusM"], 7) for w in start["wheels"]}) > 1, "Unequal-diameter wheel test has no unequal diameters")
    delta_theta = half["state"]["commonThetaRad"] - start["state"]["commonThetaRad"]
    body_delta = half["bodyTravelM"] - start["bodyTravelM"]
    check(near(delta_theta, -1.3 * 0.5), "Common theta does not advance by omega times dt")
    check(near(body_delta, -reference_radius * delta_theta), "Vehicle travel does not match nominal rolling")
    for identity, a in sorted(start_wheels.items()):
        b = half_wheels[identity]
        rotation_delta = b["rotationY"] - a["rotationY"]
        expected_delta = -delta_theta * reference_radius / a["radiusM"]
        centre_delta = [y - x for x, y in zip(a["centreM"], b["centreM"])]
        check(near(a["radiusM"], b["radiusM"]) and near(a["halfWidthM"], b["halfWidthM"]), identity + ": wheel geometry deforms")
        check(near(rotation_delta, expected_delta), identity + ": rotation does not scale inversely with radius")
        check(near(centre_delta[0], body_delta) and near(centre_delta[1], 0) and near(centre_delta[2], 0), identity + ": wheel centre does not follow the rigid train")
        wheels.append({"id": identity, "driver": a["driver"], "radiusM": a["radiusM"], "diameterM": 2 * a["radiusM"],
                       "geometryInvariant": near(a["radiusM"], b["radiusM"]) and near(a["halfWidthM"], b["halfWidthM"]),
                       "rotationDeltaRad": rotation_delta, "expectedRotationDeltaRad": expected_delta,
                       "rollingDistanceM": a["radiusM"] * rotation_delta,
                       "bodyTravelDeltaM": body_delta, "rollingResidualM": a["radiusM"] * rotation_delta - body_delta})
    return {"violations": violations, "mainRods": rods, "wheels": wheels,
            "referenceDrivingRadiusM": reference_radius, "commonThetaDeltaRad": delta_theta,
            "bodyTravelDeltaM": body_delta, "nominalContactOnly": True,
            "doesNotCertify": ["tread/adhesion", "inner crank webs", "whole-train collision", "full dynamics"]}


ERROR_HOOK = r"""
window.__FH88_RENDER_AUDIT = {errors: [], rejections: []};
addEventListener('error', e => window.__FH88_RENDER_AUDIT.errors.push({
  message: String(e.message || 'resource error'), filename: e.filename || null,
  line: e.lineno || null, column: e.colno || null,
  target: e.target && e.target !== window ? String(e.target.src || e.target.href || e.target.tagName) : null
}), true);
addEventListener('unhandledrejection', e => window.__FH88_RENDER_AUDIT.rejections.push(String(e.reason)));
"""


class Browser:
    def __init__(self, chrome: str, driver: str, out: Path, work: Path, no_sandbox=False):
        self.chrome, self.driver_binary, self.out, self.work = chrome, driver, out, work
        self.no_sandbox = no_sandbox
        self.process = self.log = self.url = self.log_thread = None
        self.env = clean_environment(work / "home")

    def start(self):
        self.log = (self.out / "chromedriver.log").open("wb")
        self.process = subprocess.Popen(
            [self.driver_binary, "--port=0", "--allowed-ips=127.0.0.1"],
            env=self.env, cwd=self.work, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        )
        def drain_log():
            remaining = MAX_DRIVER_LOG_BYTES
            while True:
                chunk = self.process.stdout.readline(65536)
                if not chunk:
                    break
                if remaining:
                    retained = chunk[:remaining]
                    self.log.write(retained)
                    self.log.flush()
                    remaining -= len(retained)
        self.log_thread = threading.Thread(target=drain_log, daemon=True)
        self.log_thread.start()
        deadline = time.monotonic() + 20
        port = None
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise RuntimeError("Fresh ChromeDriver exited; inspect chromedriver.log")
            content = (self.out / "chromedriver.log").read_text(errors="replace")
            match = re.search(r"ChromeDriver was started successfully on port (\d+)", content)
            if match:
                port = int(match.group(1))
                break
            time.sleep(0.1)
        if not port:
            raise RuntimeError("Fresh ChromeDriver did not report its selected port within 20 seconds")
        self.base = f"http://127.0.0.1:{port}"
        status = request_json("GET", self.base + "/status")
        if not status.get("ready"):
            raise RuntimeError("Fresh ChromeDriver is not ready")
        args = [
            "--headless=new", "--disable-dev-shm-usage", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--window-size=1680,980", "--force-device-scale-factor=1",
            "--disable-background-networking", "--disable-component-update", "--disable-sync",
            "--disable-extensions", "--disable-default-apps", "--no-pings",
            "--no-first-run", "--no-default-browser-check", "--metrics-recording-only",
            "--disable-client-side-phishing-detection", "--disable-domain-reliability",
            "--disable-features=MediaRouter,OptimizationHints,AutofillServerCommunication",
            "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
            "--proxy-server=http://127.0.0.1:9", "--proxy-bypass-list=127.0.0.1;localhost",
            "--user-data-dir=" + str(self.work / "profile"),
        ]
        if self.no_sandbox:
            args.append("--no-sandbox")
        caps = {
            "browserName": "chrome", "acceptInsecureCerts": False,
            "goog:chromeOptions": {"binary": self.chrome, "args": args},
            "goog:loggingPrefs": {"browser": "ALL", "performance": "ALL"},
        }
        created = request_json("POST", self.base + "/session", {"capabilities": {"alwaysMatch": caps}})
        self.url = self.base + "/session/" + created["sessionId"]
        self.capabilities = created.get("capabilities", {})
        self.cmd("POST", "/timeouts", {"script": 60000, "pageLoad": 90000, "implicit": 0})
        self.cdp("Page.addScriptToEvaluateOnNewDocument", {"source": ERROR_HOOK})
        self.cdp("Network.enable", {})
        self.cdp("Network.setCacheDisabled", {"cacheDisabled": True})

    def cmd(self, method, path, data=None):
        return request_json(method, self.url + path, data)

    def cdp(self, command, params):
        return self.cmd("POST", "/goog/cdp/execute", {"cmd": command, "params": params})

    def js(self, script, *args):
        return self.cmd("POST", "/execute/sync", {"script": script, "args": list(args)})

    def settle(self):
        return self.cmd("POST", "/execute/async", {
            "script": "const done=arguments[arguments.length-1]; let n=4; function f(){ if(--n) requestAnimationFrame(f); else done(true); } requestAnimationFrame(f);",
            "args": [],
        })

    def set_state(self, mode: str, camera: str, t: float):
        self.js("const a=window.FH88_PREVIEW; a.setMode(arguments[0]); a.setCamera(arguments[1]); a.setTime(arguments[2]);", mode, camera, t)
        self.settle()
        view = self.js("return window.FH88_PREVIEW.snapshot().view;")
        if view != {"mode": mode, "camera": camera}:
            raise AssertionError(f"Mode/camera state does not match request: {view}")

    def snapshot(self):
        value = self.js("return window.FH88_PREVIEW.snapshot();")
        if not isinstance(value, dict) or not numeric_leaves(geometry_view(value)):
            raise AssertionError("snapshot() must return an object with numeric geometric evidence")
        # Validate serializability and reject NaN/Infinity rather than report success.
        stable_json(value)
        return value

    def capture(self, label: str, viewport=True) -> dict:
        self.settle()
        # Browser compositor is the source, not renderer.toDataURL or synthetic art.
        element = self.js("const r=window.FH88_PREVIEW.renderer; return r.domElement || document.querySelector('canvas');")
        element_id = element.get("element-6066-11e4-a52e-4f735466cecf") or element.get("ELEMENT")
        if not element_id:
            raise AssertionError("No real canvas element returned by preview renderer")
        # A canvas can be covered by HTML controls. Hide only sibling overlays,
        # keeping the WebGL context/scene intact, and always restore their styles.
        self.js("""
const canvas=window.FH88_PREVIEW.renderer.domElement || document.querySelector('canvas');
window.__FH88_SCREENSHOT_HIDDEN=[];
for(let node=canvas;node && node.parentElement;node=node.parentElement){
  for(const sibling of node.parentElement.children){if(sibling===node)continue;
    window.__FH88_SCREENSHOT_HIDDEN.push([sibling,sibling.style.getPropertyValue('visibility'),sibling.style.getPropertyPriority('visibility')]);
    sibling.style.setProperty('visibility','hidden','important');
  }
  if(node.parentElement===document.body)break;
}
""")
        try:
            self.settle()
            encoded = self.cmd("GET", "/element/" + urllib.parse.quote(element_id, safe="") + "/screenshot")
            data = base64.b64decode(encoded, validate=True)
        finally:
            self.js("for(const [element,value,priority] of window.__FH88_SCREENSHOT_HIDDEN||[]){if(value)element.style.setProperty('visibility',value,priority);else element.style.removeProperty('visibility');}delete window.__FH88_SCREENSHOT_HIDDEN;")
            self.settle()
        path = self.out / (label + "-canvas.png")
        artifact_write(path, data)
        info = image_info(data)
        if info["width"] < 200 or info["height"] < 160 or info["sampledDistinctColors"] < 8:
            raise AssertionError(f"Blank or implausibly small actual canvas screenshot: {info}")
        info["file"] = path.relative_to(self.out).as_posix()
        info["source"] = "Actual browser compositor canvas-element screenshot; sibling HTML overlays temporarily hidden and restored"
        if viewport:
            viewport_data = base64.b64decode(self.cmd("GET", "/screenshot"), validate=True)
            artifact_write(self.out / (label + "-viewport.png"), viewport_data)
        return info

    def close(self):
        if self.url:
            try:
                request_json("DELETE", self.url)
            except Exception:
                pass
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=10)
        if self.log_thread:
            self.log_thread.join(timeout=5)
        if self.log and (not self.log_thread or not self.log_thread.is_alive()):
            self.log.close()


def browser_information(browser: Browser) -> dict:
    return browser.js(r"""
const a=window.FH88_PREVIEW,r=a.renderer,c=r.domElement||document.querySelector('canvas');
const gl=r.getContext ? r.getContext() : c.getContext('webgl2')||c.getContext('webgl');
if(!gl) throw Error('No real WebGL context');
const ext=gl.getExtension('WEBGL_debug_renderer_info');
return {webglVersion:gl.getParameter(gl.VERSION), shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
  actualRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
  actualVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
  debugRendererExtension:!!ext, contextLost:gl.isContextLost(), canvas:[c.width,c.height],
  viewport:[innerWidth,innerHeight,devicePixelRatio],
  rendererInfo:r.info?JSON.parse(JSON.stringify(r.info.render)):null,
  documentURL:location.href, userAgent:navigator.userAgent};
""")


def collect_logs(browser: Browser, origin: str) -> dict:
    console = browser.cmd("POST", "/se/log", {"type": "browser"})
    performance = browser.cmd("POST", "/se/log", {"type": "performance"})
    network, failed, responses = [], [], []
    for item in performance:
        message = json.loads(item["message"])["message"]
        params = message.get("params", {})
        if message["method"] == "Network.requestWillBeSent":
            request = params["request"]
            network.append({"url": request["url"], "method": request["method"], "type": params.get("type")})
        elif message["method"] == "Network.loadingFailed":
            failed.append({key: params.get(key) for key in ("requestId", "type", "errorText", "blockedReason", "canceled")})
        elif message["method"] == "Network.responseReceived":
            response = params["response"]
            responses.append({"url": response["url"], "status": response["status"], "fromDiskCache": response.get("fromDiskCache", False)})
    external = [entry for entry in network if urllib.parse.urlsplit(entry["url"]).scheme in ("http", "https", "ws", "wss")
                and not entry["url"].startswith(origin + "/")]
    hooks = browser.js("return window.__FH88_RENDER_AUDIT || {errors:['Audit error hook missing'],rejections:[]};")
    return {"console": console, "pageRequests": network, "responses": responses,
            "failedRequests": failed, "externalRequests": external, "javascript": hooks,
            "networkAuditScope": "Application page, plus local HTTP server; not whole-machine traffic"}


def source_manifest(root: Path, out: Path) -> list:
    entries = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or any(p.startswith(".") for p in path.relative_to(root).parts):
            continue
        if path.is_symlink() or out == path or out in path.parents:
            continue
        if path.suffix.lower() not in ALLOWED_SUFFIXES and path.name != "ci_render.py":
            continue
        data = path.read_bytes()
        entries.append({"path": path.relative_to(root).as_posix(), "bytes": len(data), "sha256": sha256(data)})
    return entries


def run(args) -> int:
    global ARTIFACT_ROOT
    out = Path(args.out).resolve()
    if out == ROOT or ROOT in out.parents and out.name.startswith("."):
        raise ValueError("Use a distinct, non-hidden output directory")
    if out.exists() and any(out.iterdir()):
        raise ValueError("Output directory must be empty; choose a fresh --out rather than deleting prior evidence")
    out.mkdir(parents=True, exist_ok=True)
    ARTIFACT_ROOT = out
    report = {
        "result": "NOT_RUN", "test": "FH88 native mechanical preview actual WebGL regression",
        "startedUTC": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "entry": "index.html", "cases": [], "switchCycles": args.switch_cycles,
        "phaseTimes": [0, 0.5, 0], "newBrowserProfile": True, "cacheDisabled": True,
        "artifactBudgetBytes": MAX_ARTIFACT_BYTES, "driverLogCapBytes": MAX_DRIVER_LOG_BYTES,
        "browserEnvironmentAllowlist": ["PATH", "LANG", "LC_ALL", "TZ", "HOME", "TMPDIR", "XDG_CONFIG_HOME", "XDG_CACHE_HOME"],
        "noPackageInstallation": True, "noExternalAssetDownload": True,
        "noOriginalAssetRead": True, "syntheticImageGeneration": False,
        "sourceManifest": source_manifest(ROOT, out),
    }
    requests, audit_lock = [], threading.Lock()
    server = thread = browser = work = None
    origin = None
    try:
        chrome = shutil.which(args.chrome) if args.chrome else next((p for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser") if (p := shutil.which(name))), None)
        driver = shutil.which(args.chromedriver) if args.chromedriver else shutil.which("chromedriver")
        if not chrome or not driver:
            report["result"] = "BLOCKED_MISSING_PREINSTALLED_BROWSER_OR_DRIVER"
            raise RuntimeError("Preinstalled Chrome and ChromeDriver are both required; no installs or downloads attempted")
        if not (ROOT / "index.html").is_file():
            report["result"] = "BLOCKED_MISSING_ENTRY"
            raise RuntimeError("Local preview index.html does not exist")
        work = tempfile.TemporaryDirectory(prefix="fh88-browser-")
        work_path = Path(work.name)
        env = clean_environment(work_path / "home")
        report["browserVersions"] = {name: subprocess.check_output([path, "--version"], text=True, timeout=15, env=env).strip()
                                     for name, path in (("chrome", chrome), ("chromedriver", driver))}
        browser_major = re.search(r"\d+", report["browserVersions"]["chrome"])
        driver_major = re.search(r"\d+", report["browserVersions"]["chromedriver"])
        if not browser_major or not driver_major or browser_major.group() != driver_major.group():
            raise RuntimeError("Preinstalled Chrome and ChromeDriver major versions differ; no install attempted")
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(ROOT, out, requests, audit_lock))
        server.daemon_threads = True
        origin = f"http://127.0.0.1:{server.server_port}"
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        browser = Browser(chrome, driver, out, work_path, args.no_sandbox)
        browser.start()
        report["browserStarted"] = True
        report["sandboxDisabledByExplicitFlag"] = args.no_sandbox
        browser.cmd("POST", "/url", {"url": origin + "/index.html"})
        deadline = time.monotonic() + args.ready_timeout
        state = {}
        while time.monotonic() < deadline:
            state = browser.js("return {ready:window.FH88_PREVIEW?.ready===true,error:window.FH88_PREVIEW_ERROR||window.FH88_ERROR||null};")
            if state["ready"] or state["error"]:
                break
            time.sleep(0.2)
        report["coldStart"] = state
        if not state.get("ready") or state.get("error"):
            raise AssertionError("Preview failed cold-start readiness: " + repr(state))
        browser.settle()
        report["webgl"] = browser_information(browser)
        if report["webgl"]["contextLost"]:
            raise AssertionError("WebGL context is lost")
        baseline = {}
        for mode, camera in CASES:
            label = mode + "-" + camera
            record = {"case": label, "mode": mode, "camera": camera, "snapshots": {}, "screenshots": {}}
            report["cases"].append(record)
            for phase, timestamp in (("t0", 0), ("t0_5", 0.5), ("t0-restored", 0)):
                browser.set_state(mode, camera, timestamp)
                snapshot = browser.snapshot()
                record["snapshots"][phase] = snapshot
                json_write(out / (label + "-" + phase + "-snapshot.json"), snapshot)
                record["screenshots"][phase] = browser.capture(label + "-" + phase)
            record.update(snapshot_metrics(record["snapshots"]["t0"], record["snapshots"]["t0_5"], record["snapshots"]["t0-restored"]))
            record["mechanismMetrics"] = semantic_metrics(record["snapshots"]["t0"], record["snapshots"]["t0_5"], record["snapshots"]["t0-restored"])
            pixels = {name: info["pixelSha256"] for name, info in record["screenshots"].items()}
            record["motionPixelsChanged"] = pixels["t0"] != pixels["t0_5"]
            record["restorePixelsEqual"] = pixels["t0"] == pixels["t0-restored"]
            baseline[label] = (record["snapshots"]["t0"], record["screenshots"]["t0"])
            if record["mechanismMetrics"]["violations"]:
                raise AssertionError(label + ": " + "; ".join(record["mechanismMetrics"]["violations"]))
            if record["geometryMotion"]["equal"] or not record["geometryMotion"]["sameKeys"]:
                raise AssertionError(label + ": numeric geometry does not demonstrate phase motion")
            if not record["geometryRestore"]["equal"] or not record["restorePixelsEqual"]:
                raise AssertionError(label + ": t=0 -> 0.5 -> 0 geometry or canvas did not restore")
            if not record["motionPixelsChanged"]:
                raise AssertionError(label + ": canvas pixels did not change at second phase")
        # Verify actual pixels respond to both kinds of controls, separately.
        browser.set_state("full", "inside", 0)
        full_inside = browser.capture("full-inside-mode-check")
        report["controlsEffectChecks"] = {
            "sameCameraModeChangePixelsDiffer": full_inside["pixelSha256"] != baseline["mechanism-inside"][1]["pixelSha256"],
            "sameModeCameraChangePixelsDiffer": baseline["mechanism-side"][1]["pixelSha256"] != baseline["mechanism-inside"][1]["pixelSha256"],
            "modeSwitchPreservesGeometry": compare_numeric(geometry_view(baseline["mechanism-inside"][0]), geometry_view(browser.snapshot()))["equal"],
            "fullInsideScreenshot": full_inside,
        }
        if not all(report["controlsEffectChecks"][key] for key in ("sameCameraModeChangePixelsDiffer", "sameModeCameraChangePixelsDiffer", "modeSwitchPreservesGeometry")):
            raise AssertionError("Mode/camera controls did not produce the expected independent effects")
        # Revisit every mode/camera repeatedly, including all six combinations;
        # then compare every baseline with its original deterministic state.
        for cycle in range(args.switch_cycles):
            for mode in ("full", "mechanism"):
                for camera in ("overview", "side", "inside"):
                    browser.set_state(mode, camera, 0.5 if cycle % 2 else 0)
        report["repeatedSwitchChecks"] = []
        for mode, camera in CASES:
            label = mode + "-" + camera
            browser.set_state(mode, camera, 0)
            snapshot = browser.snapshot()
            shot = browser.capture(label + "-after-switches")
            original, original_shot = baseline[label]
            result = {"case": label, "geometry": compare_numeric(geometry_view(original), geometry_view(snapshot)),
                      "pixelsEqual": original_shot["pixelSha256"] == shot["pixelSha256"], "screenshot": shot}
            report["repeatedSwitchChecks"].append(result)
            if not result["geometry"]["equal"] or not result["pixelsEqual"]:
                raise AssertionError(label + ": repeated mode/camera switching changed baseline")
        if args.sequence_frames:
            sequence_dir = out / "animation"
            sequence_dir.mkdir(exist_ok=True)
            period = 2 * math.pi / 1.3
            report["optionalSequence"] = {"mode": "mechanism", "camera": "inside", "frameCount": args.sequence_frames,
                                          "mainShaftPeriodS": period, "playbackFramesPerSecond": args.sequence_frames / period,
                                          "seamlessLoopClaimed": False,
                                          "note": "Fixed track and unequal wheel radii mean one main-shaft turn is not a seamless scene loop.", "frames": []}
            for index in range(args.sequence_frames):
                timestamp = period * index / args.sequence_frames
                browser.set_state("mechanism", "inside", timestamp)
                try:
                    screenshot = browser.capture(f"animation/frame-{index:03d}", viewport=False)
                    snapshot = browser.snapshot()
                    json_write(sequence_dir / f"frame-{index:03d}-snapshot.json", snapshot)
                except ArtifactBudgetExceeded as budget_error:
                    report["optionalSequence"]["stoppedForArtifactBudget"] = str(budget_error)
                    break
                report["optionalSequence"]["frames"].append({"index": index, "timeS": timestamp, "screenshot": screenshot})
            report["optionalSequence"]["capturedFrameCount"] = len(report["optionalSequence"]["frames"])
            report["optionalSequence"]["frameCount"] = report["optionalSequence"]["capturedFrameCount"]
            report["optionalSequence"]["requestedFrameCount"] = args.sequence_frames
            # Leave ample room for the small frame manifest before opting in.
            try:
                json_write(sequence_dir / "FRAME_MANIFEST.json", report["optionalSequence"])
            except ArtifactBudgetExceeded:
                report["optionalSequence"]["manifestStoredInTestReportOnly"] = True
            browser.set_state("mechanism", "inside", 0)
        report["logs"] = collect_logs(browser, origin)
        if report["logs"]["externalRequests"] or report["logs"]["failedRequests"]:
            raise AssertionError("External or failed page requests detected; inspect report")
        if any(int(r["status"]) >= 400 for r in requests):
            raise AssertionError("Local HTTP asset request failed")
        hooks = report["logs"]["javascript"]
        if hooks["errors"] or hooks["rejections"] or any(x.get("level") == "SEVERE" for x in report["logs"]["console"]):
            raise AssertionError("JavaScript/resource/console errors detected; inspect report")
        report["result"] = "PASS_REAL_BROWSER_MOTION_RESTORE_AND_REPEATED_CONTROLS"
        print(report["result"], flush=True)
        return 0
    except Exception as exc:
        if not report["result"].startswith("BLOCKED_"):
            report["result"] = "FAILED_OR_INCOMPLETE"
        report["error"] = str(exc)
        report["traceback"] = traceback.format_exc()
        if browser and browser.url and "logs" not in report:
            try:
                report["logs"] = collect_logs(browser, origin)
            except Exception as log_error:
                report["logCollectionError"] = str(log_error)
        print(report["result"] + ": " + str(exc), file=sys.stderr, flush=True)
        return 1
    finally:
        if browser:
            browser.close()
        if server:
            server.shutdown()
            server.server_close()
        if thread:
            thread.join(timeout=5)
        if work:
            work.cleanup()
        report["serverRequests"] = list(requests)
        report["finishedUTC"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        report["artifactBytesBeforeFinalReport"] = artifact_bytes(out)
        json_write(out / "TEST_RESULTS.json", report)
        if artifact_bytes(out) > MAX_ARTIFACT_BYTES:
            raise AssertionError("Artifact budget exceeded")
        print("Saved " + str(out / "TEST_RESULTS.json"), flush=True)


def self_test() -> int:
    """No HTTP socket, browser, subprocess, download, or external state change."""
    import unittest

    def png_fixture():
        def chunk(kind, data):
            return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
        return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 1, 8, 6, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00\xff\x00\xff\x00\xff")) + chunk(b"IEND", b""))

    class UnitTests(unittest.TestCase):
        def test_png_pixels_and_crc(self):
            data = png_fixture()
            self.assertEqual(png_pixels(data), (2, 1, bytes.fromhex("ff0000ff00ff00ff")))
            broken = bytearray(data)
            broken[-1] ^= 1
            with self.assertRaises(ValueError):
                png_pixels(bytes(broken))

        def test_numeric_restore(self):
            a = {"geometry": {"p": [1, 2, 3]}, "time": 0}
            b = {"geometry": {"p": [2, 2, 3]}, "time": 0.5}
            result = snapshot_metrics(a, b, a)
            self.assertFalse(result["geometryMotion"]["equal"])
            self.assertTrue(result["geometryRestore"]["equal"])
            self.assertTrue(result["geometryExactRestore"])

        def test_clock_change_alone_cannot_prove_geometry_motion(self):
            a = {"timeS": 0, "state": {"commonThetaRad": 0}, "bodyTravelM": 0, "mainRods": [{"lengthM": 3.2}]}
            b = {**a, "timeS": 0.5, "state": {"commonThetaRad": -0.65}}
            self.assertTrue(compare_numeric(geometry_view(a), geometry_view(b))["equal"])

        def test_semantic_three_rods_unequal_wheels_and_bad_length(self):
            def fixture(t):
                theta, radius, crank, length = 0.25 - 1.3 * t, 0.95, 0.711 / 2, 3.2
                travel = 0.95 * 1.3 * t
                rods = []
                for i, identity in enumerate(("left", "right", "inside")):
                    angle = theta + i * 2 * math.pi / 3
                    pin = [travel + crank * math.cos(angle), (i - 1) * 0.7, radius + crank * math.sin(angle)]
                    cross = [pin[0] + math.sqrt(length ** 2 - (pin[2] - radius) ** 2), pin[1], radius]
                    rods.append({"id": identity, "lengthM": length, "endpointsM": [pin, cross], "crankPinM": pin, "crossheadM": cross})
                wheels = [{"id": "driver", "driver": True, "radiusM": radius, "halfWidthM": 0.07,
                           "centreM": [travel, 0.7, radius], "rotationY": -theta},
                          {"id": "small", "driver": False, "radiusM": 0.38, "halfWidthM": 0.07,
                           "centreM": [travel + 4, 0.7, 0.38], "rotationY": -(theta - 0.25) * radius / 0.38}]
                return {"timeS": t, "state": {"worldTimeS": t, "commonThetaRad": theta, "omegaRadS": -1.3},
                        "oldUpdateCalls": 0, "bodyTravelM": travel, "mainRods": rods, "wheels": wheels, "couplingRods": [],
                        "nominalContact": {"pureRolling": True, "contactPointLongitudinalVelocityMS": 0, "actualTreadOrAdhesionValidated": False}}
            a, b = fixture(0), fixture(0.5)
            result = semantic_metrics(a, b, a)
            self.assertEqual(result["violations"], [])
            self.assertEqual(len(result["mainRods"]), 3)
            self.assertEqual(len(result["wheels"]), 2)
            b["mainRods"][0]["lengthM"] = 3.21
            self.assertTrue(semantic_metrics(a, b, a)["violations"])

        def test_reject_nonfinite_and_different_shape(self):
            with self.assertRaises(AssertionError):
                numeric_leaves([float("nan")])
            self.assertFalse(compare_numeric([1], [1, 2])["equal"])

        def test_server_confinement_without_socket(self):
            with tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "site"
                root.mkdir()
                (root / "index.html").write_text("<canvas></canvas>")
                (root / "ci_render.py").write_text("private")
                out = root / "render-results"
                out.mkdir()
                (out / "test.png").write_bytes(b"not served")
                outside = Path(temp) / "outside.json"
                outside.write_text("[]")
                (root / "escape.json").symlink_to(outside)
                self.assertEqual(resolved_file(root, "/", out), root / "index.html")
                self.assertIsNone(resolved_file(root, "/%2e%2e/outside.json", out))
                self.assertIsNone(resolved_file(root, "/escape.json", out))
                self.assertIsNone(resolved_file(root, "/ci_render.py", out))
                self.assertIsNone(resolved_file(root, "/render-results/test.png", out))
                self.assertIsNone(resolved_file(root, "/.git/config", out))

        def test_artifact_budget_and_report_reservation(self):
            global ARTIFACT_ROOT, MAX_ARTIFACT_BYTES, RESERVED_REPORT_BYTES, MAX_DRIVER_LOG_BYTES
            old = ARTIFACT_ROOT, MAX_ARTIFACT_BYTES, RESERVED_REPORT_BYTES, MAX_DRIVER_LOG_BYTES
            try:
                with tempfile.TemporaryDirectory() as temp:
                    ARTIFACT_ROOT = Path(temp)
                    MAX_ARTIFACT_BYTES, RESERVED_REPORT_BYTES, MAX_DRIVER_LOG_BYTES = 64, 16, 4
                    artifact_write(Path(temp) / "canvas.png", b"x" * 40)
                    with self.assertRaises(ArtifactBudgetExceeded):
                        artifact_write(Path(temp) / "extra.png", b"x" * 5)
                    artifact_write(Path(temp) / "TEST_RESULTS.json", b"x" * 20, final_report=True)
                    self.assertEqual(artifact_bytes(Path(temp)), 60)
            finally:
                ARTIFACT_ROOT, MAX_ARTIFACT_BYTES, RESERVED_REPORT_BYTES, MAX_DRIVER_LOG_BYTES = old

        def test_environment_allowlist(self):
            with tempfile.TemporaryDirectory() as temp:
                before = os.environ.get("FH88_UNIT_TEST_SECRET")
                os.environ["FH88_UNIT_TEST_SECRET"] = "must-not-inherit"
                try:
                    self.assertNotIn("FH88_UNIT_TEST_SECRET", clean_environment(Path(temp)))
                finally:
                    if before is None:
                        os.environ.pop("FH88_UNIT_TEST_SECRET", None)
                    else:
                        os.environ["FH88_UNIT_TEST_SECRET"] = before

    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(UnitTests))
    print("Static/self-tests only; actual WebGL rendering has NOT run.")
    return 0 if result.wasSuccessful() else 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(ROOT / "render-results"))
    parser.add_argument("--chrome", help="Path/name of preinstalled Chrome; no downloads")
    parser.add_argument("--chromedriver", help="Path/name of preinstalled ChromeDriver; no downloads")
    parser.add_argument("--ready-timeout", type=float, default=60)
    parser.add_argument("--switch-cycles", type=int, default=5)
    parser.add_argument("--no-sandbox", action="store_true", help="Explicit opt-in only for an already isolated runner that requires it")
    parser.add_argument("--self-test", action="store_true", help="Pure local tests; no browser, sockets, or network")
    parser.add_argument("--sequence-frames", type=int, choices=(0, 12, 24), default=0,
                        help="Optional real mechanism/inside frame sequence; default is screenshots only, no GIF encoding")
    args = parser.parse_args()
    if not 1 <= args.switch_cycles <= 20 or not 1 <= args.ready_timeout <= 180:
        parser.error("switch-cycles must be 1..20; ready-timeout must be 1..180")
    return self_test() if args.self_test else run(args)


if __name__ == "__main__":
    raise SystemExit(main())
