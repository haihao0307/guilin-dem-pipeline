from __future__ import annotations

import argparse
import hashlib
import json
import struct
import zlib
from pathlib import Path

MAGIC = b"WSP1"
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "site/dist/r3-8/data/soil/soil-context.json"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def resolve_layer_path(layer: dict) -> Path:
    return (MANIFEST.parent / layer["path"]).resolve()


def pack_pair(value_layer: dict, uncertainty_layer: dict) -> tuple[bytes, dict]:
    value = resolve_layer_path(value_layer).read_bytes()
    uncertainty = resolve_layer_path(uncertainty_layer).read_bytes()
    assert len(value) == value_layer["bytes"]
    assert len(uncertainty) == uncertainty_layer["bytes"]
    assert sha256_bytes(value) == value_layer["sha256"]
    assert sha256_bytes(uncertainty) == uncertainty_layer["sha256"]

    value_z = zlib.compress(value, 9)
    uncertainty_z = zlib.compress(uncertainty, 9)
    header = {
        "schema": "wenzhou-soil-pair/wsp1",
        "property": value_layer["property"],
        "depth": value_layer["depth"],
        "rows": value_layer["rows"],
        "columns": value_layer["columns"],
        "value": {
            "statistic": value_layer["statistic"],
            "dtype": "int16le",
            "rawBytes": len(value),
            "compressedBytes": len(value_z),
            "sha256": value_layer["sha256"],
        },
        "uncertainty": {
            "statistic": uncertainty_layer["statistic"],
            "dtype": "int16le",
            "rawBytes": len(uncertainty),
            "compressedBytes": len(uncertainty_z),
            "sha256": uncertainty_layer["sha256"],
        },
    }
    header_b = json.dumps(header, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    out = b"".join([
        MAGIC,
        struct.pack("<I", len(header_b)),
        header_b,
        struct.pack("<I", len(value_z)),
        value_z,
        struct.pack("<I", len(uncertainty_z)),
        uncertainty_z,
    ])
    return out, header


def unpack_pair(blob: bytes) -> tuple[dict, bytes, bytes]:
    assert blob[:4] == MAGIC
    cursor = 4
    header_len = struct.unpack_from("<I", blob, cursor)[0]
    cursor += 4
    header = json.loads(blob[cursor:cursor + header_len])
    cursor += header_len
    value_len = struct.unpack_from("<I", blob, cursor)[0]
    cursor += 4
    value = zlib.decompress(blob[cursor:cursor + value_len])
    cursor += value_len
    uncertainty_len = struct.unpack_from("<I", blob, cursor)[0]
    cursor += 4
    uncertainty = zlib.decompress(blob[cursor:cursor + uncertainty_len])
    cursor += uncertainty_len
    assert cursor == len(blob)
    assert sha256_bytes(value) == header["value"]["sha256"]
    assert sha256_bytes(uncertainty) == header["uncertainty"]["sha256"]
    return header, value, uncertainty


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    layers = manifest["layers"]
    grouped: dict[tuple[str, str], dict[str, dict]] = {}
    for layer in layers:
        grouped.setdefault((layer["property"], layer["depth"]), {})[layer["statistic"]] = layer

    results = []
    total_raw = 0
    total_packed = 0
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)

    for (prop, depth), stats in sorted(grouped.items()):
        value = stats["Q0.5"]
        uncertainty = stats["uncertainty"]
        blob, header = pack_pair(value, uncertainty)
        decoded_header, decoded_value, decoded_uncertainty = unpack_pair(blob)
        assert decoded_header == header
        assert decoded_value == resolve_layer_path(value).read_bytes()
        assert decoded_uncertainty == resolve_layer_path(uncertainty).read_bytes()
        raw_bytes = value["bytes"] + uncertainty["bytes"]
        packed_bytes = len(blob)
        total_raw += raw_bytes
        total_packed += packed_bytes
        rec = {
            "property": prop,
            "depth": depth,
            "rawBytes": raw_bytes,
            "packedBytes": packed_bytes,
            "ratio": packed_bytes / raw_bytes,
            "savedBytes": raw_bytes - packed_bytes,
            "roundTripExact": True,
            "containerSha256": sha256_bytes(blob),
        }
        if args.out:
            filename = f"{prop}-{depth}.wsp1"
            (args.out / filename).write_bytes(blob)
            rec["path"] = filename
        results.append(rec)

    report = {
        "schema": "wenzhou-r3.8-soil-pair-pack-experiment/r1",
        "pairCount": len(results),
        "sourceLayerCount": len(layers),
        "targetContainerCount": len(results),
        "totalRawBytes": total_raw,
        "totalPackedBytes": total_packed,
        "overallRatio": total_packed / total_raw,
        "savedBytes": total_raw - total_packed,
        "savedFraction": 1 - total_packed / total_raw,
        "allRoundTripExact": all(x["roundTripExact"] for x in results),
        "pairs": results,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
