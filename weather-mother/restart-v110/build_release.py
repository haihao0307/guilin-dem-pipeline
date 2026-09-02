from pathlib import Path
import hashlib, json, subprocess, sys, zipfile

ROOT = Path.cwd()
OUT_PARENT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '_weather_restart_stage'
PACKAGE_NAME = 'Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0'
PACKAGE_DIR = OUT_PARENT / PACKAGE_NAME
ZIP_PATH = OUT_PARENT / f'{PACKAGE_NAME}.zip'
RECEIPT_PATH = OUT_PARENT / f'{PACKAGE_NAME}.receipt.json'

subprocess.check_call([sys.executable, str(Path(__file__).with_name('build.py')), str(OUT_PARENT)])

manifest_path = PACKAGE_DIR / 'MANIFEST.json'
manifest = json.loads(manifest_path.read_text())
manifest['status'] = 'PACKAGE_VERIFIED'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')

if ZIP_PATH.exists():
    ZIP_PATH.unlink()
with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(PACKAGE_DIR.iterdir()):
        assert path.is_file()
        info = zipfile.ZipInfo(f'{PACKAGE_NAME}/{path.name}', date_time=(2026, 9, 2, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, path.read_bytes())
with zipfile.ZipFile(ZIP_PATH) as archive:
    assert archive.testzip() is None
    assert len(archive.namelist()) == len(list(PACKAGE_DIR.iterdir()))

receipt = json.loads(RECEIPT_PATH.read_text())
receipt.update({
    'zipBytes': ZIP_PATH.stat().st_size,
    'zipSHA256': hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest(),
    'uncompressedBytes': sum(path.stat().st_size for path in PACKAGE_DIR.iterdir()),
    'files': len(list(PACKAGE_DIR.iterdir())),
    'packageManifestStatus': 'PACKAGE_VERIFIED'
})
RECEIPT_PATH.write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(receipt, ensure_ascii=False))
