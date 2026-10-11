#!/usr/bin/env python3
"""Pin the local V2 generator closure and build its recipe-only SQLite profile."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
FILES = (
    'room-recipe.mjs',
    'room-unit.mjs',
    'room-native.mjs',
    'native/timber/original-core.mjs',
    'native/timber/three-adapter.mjs',
    'r312-wall/original-shaders.mjs',
    'r312-wall/adapter-shaders.mjs',
    'r312-wall/r312-wall.mjs',
)

def build_release():
    pins = []
    for filename in FILES:
        raw = (ROOT / filename).read_bytes()
        pins.append({
            'id': filename.replace('/', '__'),
            'version': 'walled-city-room-r02',
            'sha256': hashlib.sha256(raw).hexdigest(),
            'localPath': '../' + filename,
        })
    input_path = HERE / 'release-input.json'
    input_path.write_text(json.dumps(pins, indent=2) + '\n')
    subprocess.run([sys.executable, str(HERE / 'build_template.py'),
                    '--dependencies', str(input_path)], check=True)

if __name__ == '__main__':
    build_release()
