#!/usr/bin/env python3
"""Deterministic mathematical probe for the Wenzhou reversible DEM transform.

This probe uses generated integer fixtures only.  Its report can prove transform
round-trip behaviour and container integrity, but it cannot prove a Wenzhou source
compression ratio or production suitability.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import platform
from pathlib import Path
import time

import numpy as np

from reversible_cdf53 import (
    FormatError,
    decode_lossless,
    encode_grid,
    forward_1d,
    inverse_1d,
    pack_lossless,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    rng = np.random.default_rng(20260907)
    one_dimensional_cases = 0
    two_dimensional_cases = 0
    failures: list[str] = []

    started = time.perf_counter()
    for length in range(1, 66):
        for _ in range(16):
            source = rng.integers(-32768, 32768, size=length, dtype=np.int64)
            restored = inverse_1d(forward_1d(source))
            one_dimensional_cases += 1
            if not np.array_equal(restored, source):
                failures.append(f"1d_roundtrip_length_{length}")
                break

    shapes = [
        (1, 1),
        (1, 257),
        (256, 1),
        (2, 2),
        (3, 5),
        (16, 17),
        (31, 32),
        (257, 257),
        (513, 513),
    ]
    benchmark: dict[str, object] = {}
    for shape in shapes:
        source = rng.integers(-1200, 4200, size=shape, dtype=np.int16)
        if source.size > 16:
            source.reshape(-1)[::97] = -32768
        encode_started = time.perf_counter()
        encoded = encode_grid(source)
        blob = pack_lossless(encoded, compression_level=9)
        encode_seconds = time.perf_counter() - encode_started
        decode_started = time.perf_counter()
        restored = decode_lossless(blob)
        decode_seconds = time.perf_counter() - decode_started
        two_dimensional_cases += 1
        if not np.array_equal(restored, source):
            failures.append(f"2d_roundtrip_shape_{shape[0]}x{shape[1]}")
        if shape == (513, 513):
            benchmark = {
                "shape": [513, 513],
                "rawInt16Bytes": int(source.nbytes),
                "containerBytes": len(blob),
                "containerToRawRatio": float(len(blob) / source.nbytes),
                "encodeSeconds": float(encode_seconds),
                "decodeSeconds": float(decode_seconds),
                "interpretation": "generated_math_fixture_only",
            }

    corruption_detected = False
    source = rng.integers(-1000, 1000, size=(35, 37), dtype=np.int16)
    blob = bytearray(pack_lossless(encode_grid(source)))
    blob[-1] ^= 1
    try:
        decode_lossless(blob)
    except FormatError:
        corruption_detected = True
    if not corruption_detected:
        failures.append("container_corruption_not_detected")

    elapsed = time.perf_counter() - started
    report = {
        "schema": "wenzhou-dem-kernel-math-probe/v1",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "status": "math_probe_passed" if not failures else "math_probe_failed",
        "sourceDataUsed": False,
        "realWenzhouWindowUsed": False,
        "syntheticFixtureUsed": True,
        "claimsAllowed": [
            "integer transform round-trip on the listed generated fixtures",
            "NoData-mask round-trip through the tested container path",
            "container corruption detection for the tested byte mutation",
        ],
        "claimsForbidden": [
            "Wenzhou compression ratio",
            "full-domain performance",
            "feature preservation",
            "production integration",
            "visual acceptance",
        ],
        "environment": {
            "python": platform.python_version(),
            "numpy": np.__version__,
            "platform": platform.platform(),
        },
        "oneDimensionalRoundTripCases": one_dimensional_cases,
        "twoDimensionalRoundTripCases": two_dimensional_cases,
        "containerCorruptionDetected": corruption_detected,
        "representativeGeneratedBenchmark": benchmark,
        "elapsedSeconds": float(elapsed),
        "failures": failures,
        "gates": {
            "mathRoundTrip": not failures,
            "realSourceProbe": False,
            "productionIntegration": False,
            "visualAcceptance": False,
            "productionReady": False,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
