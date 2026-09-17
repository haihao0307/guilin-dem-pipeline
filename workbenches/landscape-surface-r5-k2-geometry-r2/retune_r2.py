from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[2]
DIR = ROOT / "workbenches/landscape-surface-r5-k2-geometry-r2"
HTML = DIR / "index.html"
BUILD = DIR / "build.json"
s = HTML.read_text(encoding="utf-8")

replacements = [
    ("geo:1.45,concavity:.75,spikeGuard:.90", "geo:1.65,concavity:.85,spikeGuard:.95"),
    ("value=\"1.45\"", "value=\"1.65\""),
    (">1.45</output>", ">1.65</output>"),
    (">0.75</output>", ">0.85</output>"),
    ("value=\".75\"", "value=\".85\""),
    (">0.90</output>", ">0.95</output>"),
    ("value=\".90\"", "value=\".95\""),
    ("baseAmp=Number.isFinite(options.amp)?options.amp:.34", "baseAmp=Number.isFinite(options.amp)?options.amp:.48"),
    ("ell=options.scale||5.2", "ell=options.scale||7.2"),
    ("meshSafetyFraction=options.meshSafetyFraction??.16", "meshSafetyFraction=options.meshSafetyFraction??.22"),
    ("smoothing=options.smoothing??.58", "smoothing=options.smoothing??.34"),
    ("return d*1.34-concavity*cavity*cavity*1.92+rim*.046-concavity*.040", "return d*1.55-concavity*cavity*cavity*2.25+rim*.055-concavity*.055"),
    ("config.stage===2?.22:config.stage===3?.29:.34", "config.stage===2?.31:config.stage===3?.40:.48"),
    ("strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:5.2,layers:3,gridStep:step,meshSafetyFraction:.16,directionDeg:18,warp:.48,smoothing:.58", "strength:config.geo,concavity:config.concavity,spikeGuard:config.spikeGuard,scale:7.2,layers:3,gridStep:step,meshSafetyFraction:.22,directionDeg:18,warp:.52,smoothing:.34"),
]
for old, new in replacements:
    assert old in s, f"retune token missing: {old}"
    s = s.replace(old, new)

# Make the geometry strength control start in the useful region while preserving a lower diagnostic range.
s = s.replace('id="geo" type="range" min=".6" max="2.4" step=".05" value="1.65"', 'id="geo" type="range" min=".8" max="2.8" step=".05" value="1.65"', 1)

raw = s.encode("utf-8")
HTML.write_bytes(raw)
b = json.loads(BUILD.read_text(encoding="utf-8"))
b["candidateSha256"] = hashlib.sha256(raw).hexdigest()
b["candidateBytes"] = len(raw)
b["geometry"].update({
    "defaultStrength": 1.65,
    "defaultConcavity": 0.85,
    "defaultSpikeGuard": 0.95,
    "baseAmplitudeM": 0.48,
    "nominalAmplitudeM": 0.792,
    "scaleM": 7.2,
    "meshSafetyFraction": 0.22,
    "smoothing": 0.34,
    "tuningNote": "broader three-band geometry field; stronger concavity; lower smoothing; larger local safe cap while downward outward motion remains suppressed",
})
BUILD.write_text(json.dumps(b, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"retuned": True, "candidateSha256": b["candidateSha256"], "candidateBytes": b["candidateBytes"], "geometry": b["geometry"]}, ensure_ascii=False))
