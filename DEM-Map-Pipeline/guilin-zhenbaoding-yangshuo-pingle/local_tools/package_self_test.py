from __future__ import annotations

import argparse
import compileall
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--package-root', required=True)
    parser.add_argument('--project-root', required=True)
    args = parser.parse_args()
    package_root = Path(args.package_root).resolve()
    project_root = Path(args.project_root).resolve()
    errors: list[str] = []
    notes: list[str] = []

    required = [
        package_root / '.github/workflows/guilin-dem-extended.yml',
        project_root / 'config/task_config.json',
        project_root / 'config/existing_five_manifest.json',
        project_root / 'scripts/run_cloud_pipeline.py',
        project_root / 'scripts/mosaic_dem.py',
        project_root / 'web/index.html',
        project_root / 'local_tools/LocalBuild.ps1',
        project_root / 'tests/run_tests.py',
    ]
    for path in required:
        if not path.is_file(): errors.append(f'missing: {path}')

    for path in [project_root / 'config/task_config.json', project_root / 'config/existing_five_manifest.json', project_root / 'web/status.json']:
        try: json.loads(path.read_text(encoding='utf-8-sig'))
        except Exception as exc: errors.append(f'json: {path}: {exc}')

    if not compileall.compile_dir(project_root / 'scripts', quiet=1): errors.append('python compile failed')

    forbidden = [re.compile(r'EARTHDATA_TOKEN\s*[:=]\s*[A-Za-z0-9._-]{20,}'), re.compile(r'ghp_[A-Za-z0-9]{20,}')]
    for path in package_root.rglob('*'):
        if not path.is_file() or path.suffix.lower() in {'.png','.zip','.tif','.tiff','.gz'}: continue
        try: text = path.read_text(encoding='utf-8-sig', errors='ignore')
        except Exception: continue
        for pattern in forbidden:
            if pattern.search(text): errors.append(f'possible secret in {path}')

    try:
        import numpy, rasterio, pyproj, shapely, matplotlib  # noqa: F401
        completed = subprocess.run([sys.executable, str(project_root / 'tests/run_tests.py')], cwd=project_root, check=False, text=True, capture_output=True)
        notes.append(completed.stdout)
        notes.append(completed.stderr)
        if completed.returncode != 0: errors.append(f'synthetic tests failed: {completed.returncode}')
    except Exception as exc:
        notes.append(f'geospatial synthetic tests skipped: {exc}')

    report = project_root / 'reports' / 'PACKAGE_SELF_TEST.txt'
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text('\n'.join(['STATUS=' + ('PASS' if not errors else 'FAIL'), *errors, *notes]), encoding='utf-8')
    print(report.read_text(encoding='utf-8'))
    return 0 if not errors else 1


if __name__ == '__main__':
    raise SystemExit(main())
