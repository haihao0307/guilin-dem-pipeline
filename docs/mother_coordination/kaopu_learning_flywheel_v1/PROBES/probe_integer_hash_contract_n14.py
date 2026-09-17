#!/usr/bin/env python3
"""Bounded CPU reference for the KAOPU N14 portable cell-hash ABI."""

from __future__ import annotations

import json
from pathlib import Path
import struct

MASK = 0xFFFFFFFF
VECTORS = [
    (-2147483648, -2147483648),
    (-2147483648, -1),
    (-16777217, 16777217),
    (-65536, 65536),
    (-1, -1),
    (-1, 0),
    (0, -1),
    (0, 0),
    (0, 1),
    (1, 0),
    (1, 1),
    (2147483647, 2147483647),
]


def u32(x: int) -> int:
    return x & MASK


def rotl32(x: int, n: int) -> int:
    if not 0 <= n < 32:
        raise ValueError("portable ABI requires shift count in [0,31]")
    return u32((u32(x) << n) | (u32(x) >> (32 - n))) if n else u32(x)


def hash32(x: int) -> int:
    x = u32(x)
    x ^= x >> 16
    x = u32(x * 0x7FEB352D)
    x ^= x >> 15
    x = u32(x * 0x846CA68B)
    x ^= x >> 16
    return u32(x)


def hash_pair(x: int, y: int) -> int:
    # The signed coordinates are first encoded as their exact 32-bit two's-
    # complement patterns; every later operation is unsigned modulo 2^32.
    return hash32(hash32(u32(x)) ^ rotl32(hash32(u32(y)), 16) ^ 0x9E3779B9)


def f32(x: int) -> float:
    return struct.unpack("<f", struct.pack("<f", float(x)))[0]


rows = [
    {
        "x": x,
        "y": y,
        "xBits": f"0x{u32(x):08x}",
        "yBits": f"0x{u32(y):08x}",
        "hash": f"0x{hash_pair(x, y):08x}",
    }
    for x, y in VECTORS
]

float_alias = {
    "a": 16777216,
    "b": 16777217,
    "f32A": f32(16777216),
    "f32B": f32(16777217),
    "aliases": f32(16777216) == f32(16777217),
    "integerHashesDiffer": hash_pair(16777216, 0) != hash_pair(16777217, 0),
}

signed_shift = {
    "input": -1,
    "arithmeticSignedRight16": u32(-1 >> 16),
    "logicalUnsignedRight16": u32(-1) >> 16,
}

checks = {
    "vector-count-12": len(rows) == 12,
    "signed-encoding-is-bijective-on-fixture": len({(r["xBits"], r["yBits"]) for r in rows}) == len(rows),
    "pair-hashes-distinct-on-fixture": len({r["hash"] for r in rows}) == len(rows),
    "minus-one-encodes-ffffffff": u32(-1) == 0xFFFFFFFF,
    "int-min-encodes-80000000": u32(-2147483648) == 0x80000000,
    "overflow-multiply-wraps": u32(0xFFFFFFFF * 0x7FEB352D) == 0x8014CAD3,
    "unsigned-right-shift-zero-fills": (u32(-1) >> 16) == 0x0000FFFF,
    "signed-right-shift-is-different": u32(-1 >> 16) == 0xFFFFFFFF,
    "float32-cell-identity-aliases": float_alias["aliases"],
    "u32-cell-identity-does-not-alias": float_alias["integerHashesDiffer"],
    "shift-31-accepted": rotl32(1, 31) == 0x80000000,
}

result = {
    "schema": "kaopu-integer-cell-hash-n14-v1",
    "abi": {
        "coordinateEncoding": "signed i32 two's-complement bit pattern reinterpreted as u32",
        "arithmetic": "u32 modulo 2^32",
        "rightShift": "logical zero-fill",
        "shiftCount": "0..31 only; never rely on out-of-range behavior",
        "pairOrder": "ordered (x,y)",
        "output": "u32 hexadecimal; byte transport is explicit little-endian only where stated",
    },
    "vectors": rows,
    "counterexamples": {
        "float32CellAlias": float_alias,
        "signedVsUnsignedRightShift": signed_shift,
        "outOfRangeShift": {
            "count": 32,
            "glslEs": "undefined",
            "wgslRuntime": "effective count modulo 32; const/override >=32 is an error",
            "portableRule": "reject before evaluation",
        },
    },
    "checks": [{"id": key, "pass": value} for key, value in checks.items()],
    "summary": {
        "checks": len(checks),
        "passed": sum(checks.values()),
        "failed": len(checks) - sum(checks.values()),
        "status": "pass" if all(checks.values()) else "fail",
    },
}

out = Path(__file__).with_name("integer_hash_contract_result_n14.json")
out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
if not all(checks.values()):
    raise SystemExit(result["summary"])
