"""Package complete official PPF output for bit-exact, bounded-memory web replay.

No remeshing, frame removal, floating-point quantization or coordinate edits.
The only vertex-frame transform is reversible uint32 XOR and byte transposition.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import tomllib

import cbor2
import numpy as np

UPSTREAM = "b4ee7a44a741754d5bdfe1926d064d2483cf1456"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def compress(path, data):
    encoded = gzip.compress(data, compresslevel=9, mtime=0)
    path.write_bytes(encoded)
    return {"file": path.name, "bytes": len(encoded), "sha256": sha(encoded),
            "decodedBytes": len(data), "decodedSha256": sha(data)}


def export(session, destination, case, chunk_frames=8):
    output = session / "output"
    param = tomllib.loads((session / "param.toml").read_text())["param"]
    status = cbor2.loads((output / "status.cbor").read_bytes())["payload"]
    assert status["outcome"]["kind"] == "finished", "Only complete runs can be exported"
    total = param["frames"]
    assert status["frame"] == total
    files = sorted(output.glob("vert_*.bin"), key=lambda p: int(p.stem.split("_")[1]))
    assert [int(p.stem.split("_")[1]) for p in files] == list(range(total + 1))
    destination.mkdir(parents=True, exist_ok=True)
    info = tomllib.loads((session / "info.toml").read_text())
    nv = info["count"]["vert"]
    manifest = {"format": "ppf-replay-v1", "case": case,
                "identity": {"repository": "https://github.com/st-tech/ppf-contact-solver", "commit": UPSTREAM,
                             "backend": "cpu", "license": "Apache-2.0", "mode": "official-offline-result-replay"},
                "frames": total + 1, "fps": param["fps"], "vertexCount": nv,
                "triangleCount": info["count"]["tri"], "units": "metres", "parameters": param,
                "terminal": {k: status[k] for k in ("phase", "frame", "sim_time", "outcome")},
                "codec": "uint32-temporal-xor-byteplanes-gzip", "chunkFrames": chunk_frames,
                "noInterpolation": True, "framePrecision": "original IEEE754 float32 bits",
                "inputHashes": {p.relative_to(session).as_posix(): sha(p.read_bytes()) for p in
                                [session / "param.toml", session / "info.toml", *sorted((session / "bin").rglob("*"))] if p.is_file()}}
    # Each topology section retains the official index/value order. Integer
    # narrowing is range-checked and exact. Static coordinates stay float64.
    sections, data, offset = {}, [], 0
    for name, dtype, target in [("tri", "<u8", "<u4"), ("object_vert", "<u4", "<u4"),
                                ("uv", "<f4", "<f4"), ("color", "<f4", "<f4"),
                                ("static_vert", "<f8", "<f8"), ("static_tri", "<u8", "<u4"),
                                ("static_color", "<f4", "<f4"),
                                ("static_vert_dmap", "<u4", "<u4"), ("displacement", "<f8", "<f8")]:
        path = session / "bin" / (name + ".bin")
        if not path.exists():
            continue
        array = np.fromfile(path, dtype=dtype)
        if target == "<u4":
            assert np.all(array <= 0xffffffff)
        raw = array.astype(target, copy=False).tobytes()
        padding = (-offset) % 8
        if padding:
            data.append(bytes(padding)); offset += padding
        sections[name] = {"offset": offset, "count": len(array), "dtype": target, "bytes": len(raw)}
        data.append(raw); offset += len(raw)
    topology = compress(destination / "topology.bin.gz", b"".join(data))
    topology["sections"] = sections
    manifest["topology"] = topology
    original_objects = cbor2.loads((output / "statistics_manifest.cbor").read_bytes())["payload"]["objects"]
    ids = np.fromfile(session / "bin/object_vert.bin", "<u4")
    triangles = np.fromfile(session / "bin/tri.bin", "<u8").reshape(-1, 3)
    triangle_objects = ids[triangles[:, 0]]
    manifest["objects"] = []
    for obj in original_objects:
        indices = np.where(ids == obj["object_index"])[0]
        row = {"id": obj["object_index"], "name": obj["object_name"], "kind": obj["dynamics_type"]}
        if len(indices):
            assert np.all(np.diff(indices) == 1), "Viewer expects contiguous official object ranges"
            row.update(firstVertex=int(indices[0]), vertexCount=len(indices))
            row["material"] = {}
            for name in ("strain-limit", "young-mod", "bend", "friction", "contact-gap", "density"):
                values = np.fromfile(session / "bin/param" / ("tri-" + name + ".bin"), "<f4")
                unique = np.unique(values[triangle_objects == obj["object_index"]])
                row["material"][name] = unique.tolist()
        manifest["objects"].append(row)
    chunks, frame_rows, bounds = [], [], []
    for first in range(0, len(files), chunk_frames):
        selected = files[first:first + chunk_frames]
        raws = [p.read_bytes() for p in selected]
        assert all(len(b) == nv * 12 for b in raws)
        words = np.stack([np.frombuffer(b, dtype="<u4") for b in raws])
        differences = words.copy()
        differences[1:] ^= words[:-1]
        transposed = differences.view("u1").reshape(-1, 4).T.copy().tobytes()
        entry = compress(destination / f"frames-{first:04d}.bin.gz", transposed)
        # Validate the complete transform against every source byte before any
        # dataset is considered publishable.
        unpacked = np.frombuffer(gzip.decompress((destination / entry["file"]).read_bytes()), "u1")
        decoded = unpacked.reshape(4, -1).T.copy().view("<u4").reshape(words.shape)
        decoded = np.bitwise_xor.accumulate(decoded, axis=0)
        assert decoded.tobytes() == words.tobytes()
        entry.update(firstFrame=first, frameCount=len(selected), sourceSha256=sha(words.tobytes()), bitExact=True)
        chunks.append(entry)
        for i, raw in enumerate(raws):
            number = first + i
            positions = np.frombuffer(raw, "<f4").reshape(-1, 3)
            assert np.isfinite(positions).all()
            bounds.append([positions.min(0).tolist(), positions.max(0).tolist()])
            stats = cbor2.loads((output / f"statistics_{number}.cbor").read_bytes())["payload"]
            assert stats["solver_frame"] == number
            frame_rows.append({"frame": number, "sha256": sha(raw), "timeSeconds": stats["time_seconds"],
                               "objects": [{k: obj[k] for k in ("object_index", "contact_count", "area_stretch", "speed", "valid_channels")} for obj in stats["objects"]]})
    manifest["chunks"] = chunks
    manifest["bounds"] = [np.array(bounds)[:, 0].min(0).tolist(), np.array(bounds)[:, 1].max(0).tolist()]
    stats_raw = json.dumps({"contactCountMeaning": "Original solver per-object participation counts; do not sum as unique pairs", "frames": frame_rows}, separators=(",", ":")).encode()
    manifest["statistics"] = compress(destination / "statistics.json.gz", stats_raw)
    write_json(destination / "manifest.json", manifest)
    budget = {"case": case, "allOriginalFrames": len(files), "rawFrameBytes": len(files) * nv * 12,
              "frameTransferBytes": sum(c["bytes"] for c in chunks), "topologyTransferBytes": topology["bytes"],
              "statisticsTransferBytes": manifest["statistics"]["bytes"],
              "firstViewBytes": (destination / "manifest.json").stat().st_size + topology["bytes"] + chunks[0]["bytes"] + manifest["statistics"]["bytes"],
              "allFramesBitExact": True, "maximumDecodedThreeChunkBytes": 3 * chunk_frames * nv * 12}
    write_json(destination / "budget.json", budget)
    return budget


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("session", type=Path)
    parser.add_argument("destination", type=Path)
    parser.add_argument("--case", choices=["drape", "belt"], required=True)
    args = parser.parse_args()
    print(json.dumps(export(args.session, args.destination, args.case), indent=2))
