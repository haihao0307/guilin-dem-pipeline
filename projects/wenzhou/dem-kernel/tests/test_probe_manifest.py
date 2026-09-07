#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "transform"))

from probe_real_window import EXPECTED_COG, ProvenanceError, validate_manifest  # noqa: E402


class RealWindowManifestTests(unittest.TestCase):
    def _write_fixture(self, root: Path, *, data_class: str, source_sha: str) -> Path:
        payload = np.arange(12, dtype="<i2").reshape((3, 4))
        payload_path = root / "fixture.i16"
        payload_path.write_bytes(payload.tobytes(order="C"))
        payload_bytes = payload_path.read_bytes()
        source = dict(EXPECTED_COG)
        source["sha256"] = source_sha
        manifest = {
            "schema": "wenzhou-dem-real-window/v1",
            "dataClass": data_class,
            "provenanceStatus": "verified",
            "sourceCog": source,
            "sourceWindow": {"row": 0, "column": 0, "height": 3, "width": 4},
            "payload": {
                "path": payload_path.name,
                "format": "raw-i16",
                "bytes": len(payload_bytes),
                "sha256": hashlib.sha256(payload_bytes).hexdigest(),
                "dtype": "int16",
                "endian": "little",
                "grid": [3, 4],
            },
        }
        manifest_path = root / "manifest.json"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        return manifest_path

    def test_generic_fixture_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            manifest = self._write_fixture(
                Path(temporary),
                data_class="unit_test_fixture",
                source_sha=EXPECTED_COG["sha256"],
            )
            with self.assertRaises(ProvenanceError):
                validate_manifest(manifest)

    def test_wrong_source_cog_hash_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            manifest = self._write_fixture(
                Path(temporary),
                data_class="real_wenzhou_12p5m",
                source_sha="0" * 64,
            )
            with self.assertRaises(ProvenanceError):
                validate_manifest(manifest)

    def test_unfilled_template_is_rejected(self) -> None:
        template = ROOT / "truth" / "REAL_WINDOW_MANIFEST_TEMPLATE.json"
        with self.assertRaises(ProvenanceError):
            validate_manifest(template)


if __name__ == "__main__":
    unittest.main(verbosity=2)
