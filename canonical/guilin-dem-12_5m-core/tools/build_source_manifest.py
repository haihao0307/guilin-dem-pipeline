from pathlib import Path
import argparse
import hashlib
import json


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--preflight-dir", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--package-zip", type=Path, required=True)
    parser.add_argument("--mosaic-manifest", type=Path, required=True)
    args = parser.parse_args()

    sources = []
    for tif in sorted(args.source_dir.glob("*.dem.tif")):
        report = json.loads(
            (args.preflight_dir / f"{tif.stem}.preflight.json").read_text(encoding="utf-8")
        )
        raster = report["raster"]
        metadata = tif.name.replace(".dem.tif", ".iso.xml")
        sources.append(
            {
                "file": tif.name,
                "metadata_file": metadata,
                "bytes": tif.stat().st_size,
                "sha256": sha256(tif),
                "width": raster["width"],
                "height": raster["height"],
                "crs": raster["crs"],
                "transform": raster["transform"],
                "bounds": raster["bounds"],
                "pixel_size_m": raster["pixel_size"],
                "nodata": raster["nodata"],
            }
        )

    mosaic = json.loads(args.mosaic_manifest.read_text(encoding="utf-8"))
    manifest = {
        "schema": "guilin-dem-12_5m-clean-rebuild/v2",
        "package_version": "2.0.0",
        "source_package": {
            "filename": args.package_zip.name,
            "bytes": args.package_zip.stat().st_size,
            "sha256": sha256(args.package_zip),
        },
        "truth_policy": {
            "source_resolution_m": 12.5,
            "source_dem_read_only": True,
            "active_30m_dem_allowed": False,
            "derived_web_or_mosaic_is_measured_source": False,
        },
        "source_count": len(sources),
        "sources": sources,
        "first_pass_mosaic": {
            "grid": mosaic["grid"],
            "coverage": mosaic["coverage"],
            "complete_coverage_claim_allowed": False,
            "local_manifest": "local-only mosaic-v0001 manifest; not published in the canonical source package",
        },
        "status": "source_package_present_but_first_pass_mosaic_has_nodata_gaps",
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
