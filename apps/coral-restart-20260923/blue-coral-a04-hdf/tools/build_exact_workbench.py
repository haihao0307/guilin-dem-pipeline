#!/usr/bin/env python3
"""Build the verified Blue Coral A04 single-file 3D comparison workbench.

The builder does not alter geometry. It embeds the user-provided teacher source,
the exact 36-accessor field payload, and the bundled runtime into one HTML file.
"""
from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

LOCKED = {
    "sourceArchiveSha256": "c65bc1b9c389b3b1c3f4c09fc345619ad4ad4994666a06eb294822eafa503857",
    "gltfSha256": "6a13fc948469db72878528f4941a734bfac256dc1d2939ab6dcc9e2fe1818e0a",
    "binarySha256": "23f65069936dc9316b975617beb9a07991a24b20bba8de5f45ff6bb0afecadb3",
    "textureSha256": "27734e7adaa0657fb314715088f74c707c12c8029965cb12172fef104a673906",
    "fieldPayloadBytes": 30_625_096,
    "fieldPayloadSha256": "4763714feed24c967d8e39a27ccba18a456a70131247856d6b4fc3c697cd4f06",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def compact_json(path: Path) -> str:
    value = json.loads(path.read_text(encoding="utf-8"))
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")


def gzip_base64(data: bytes) -> str:
    return base64.b64encode(gzip.compress(data, compresslevel=9, mtime=0)).decode("ascii")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--source-zip", required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--object-graph", required=True)
    parser.add_argument("--fields", required=True)
    parser.add_argument("--template", required=True)
    parser.add_argument("--bundle", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--build-manifest", required=True)
    args = parser.parse_args()

    source_dir = Path(args.source_dir)
    source_zip = Path(args.source_zip)
    package_path = Path(args.package)
    manifest_path = Path(args.manifest)
    graph_path = Path(args.object_graph)
    field_path = Path(args.fields)
    template_path = Path(args.template)
    bundle_path = Path(args.bundle)
    output_path = Path(args.output)
    build_manifest_path = Path(args.build_manifest)

    source_gltf_path = source_dir / "scene.gltf"
    source_binary_path = source_dir / "scene.bin"
    texture_path = source_dir / "textures" / "material_0_baseColor.png"

    archive = source_zip.read_bytes()
    source_gltf = source_gltf_path.read_bytes()
    source_binary = source_binary_path.read_bytes()
    texture = texture_path.read_bytes()
    fields = field_path.read_bytes()
    identities = {
        "sourceArchiveSha256": sha256(archive),
        "gltfSha256": sha256(source_gltf),
        "binarySha256": sha256(source_binary),
        "textureSha256": sha256(texture),
        "fieldPayloadBytes": len(fields),
        "fieldPayloadSha256": sha256(fields),
    }
    assert identities == LOCKED, (identities, LOCKED)

    package = json.loads(package_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    graph = json.loads(graph_path.read_text(encoding="utf-8"))
    assert package["schema"] == "kaopu.canonical-coral-teacher/1.0"
    assert package["version"] == "BLUE_CORAL_CANONICAL_A04"
    assert package["fields"]["payloadSha256"] == LOCKED["fieldPayloadSha256"]
    assert manifest["dimensions"]["accessors"] == 36
    assert manifest["dimensions"]["surfaces"] == 9
    assert graph["candidateOwnsIndependentTypedArrays"] is True
    assert graph["candidateOwnsIndependentGpuBuffers"] is True

    replacements = {
        "__CANONICAL_PACKAGE__": compact_json(package_path),
        "__ACCESSOR_MANIFEST__": compact_json(manifest_path),
        "__OBJECT_GRAPH__": compact_json(graph_path),
        "__SOURCE_GLTF__": compact_json(source_gltf_path),
        "__SOURCE_TEXTURE_DATA_URI__": "data:image/png;base64," + base64.b64encode(texture).decode("ascii"),
        "__SOURCE_BINARY_GZIP_BASE64__": gzip_base64(source_binary),
        "__FIELD_PAYLOAD_GZIP_BASE64__": gzip_base64(fields),
        "__RUNTIME_BUNDLE__": bundle_path.read_text(encoding="utf-8").replace("</script", "<\\/script"),
    }
    html = template_path.read_text(encoding="utf-8")
    for marker, value in replacements.items():
        count = html.count(marker)
        assert count == 1, (marker, count)
        html = html.replace(marker, value)
    assert "__" not in html, "Unresolved build marker remains"
    assert "new GLTFLoader(" in html, "Teacher loader missing"
    assert "gltfLoaderUsedForCandidate: false" in html, "Candidate anti-clone marker missing"
    assert "reconstructCandidate" in html, "Canonical decoder missing"
    assert "meshSimplification: false" in html
    assert "marchingCubes: false" in html

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    output = output_path.read_bytes()
    manifest_output = {
        "schema": "kaopu.coral-a04-build/1.0",
        "version": "BLUE_CORAL_CANONICAL_A04",
        "stage": "ONE_TO_ONE_HIGH_DIMENSIONAL_FIELD_EXPRESSION",
        "output": output_path.name,
        "htmlBytes": len(output),
        "htmlSha256": sha256(output),
        "sourceIdentity": identities,
        "canonicalPackageSha256": sha256(package_path.read_bytes()),
        "accessorManifestSha256": sha256(manifest_path.read_bytes()),
        "objectGraphSha256": sha256(graph_path.read_bytes()),
        "runtimeBundleSha256": sha256(bundle_path.read_bytes()),
        "singleFile": True,
        "runtimeNetworkFetch": False,
        "candidateSourceCloneUsed": False,
        "candidateGltfLoaderUsed": False,
        "meshSimplification": False,
        "decimation": False,
        "remeshing": False,
        "voxelization": False,
        "marchingCubes": False,
        "manualVisualAcceptance": False,
        "structureGrammarUnlocked": False,
        "finalGenerator": False,
        "productionReady": False,
    }
    build_manifest_path.parent.mkdir(parents=True, exist_ok=True)
    build_manifest_path.write_text(json.dumps(manifest_output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest_output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
