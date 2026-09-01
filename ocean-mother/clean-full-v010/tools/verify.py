#!/usr/bin/env python3
"""Verify this package without external dependencies or file modification."""
from __future__ import annotations
import hashlib
import json
import re
import sys
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

ALLOWED = {'.md','.json','.js','.cjs','.html','.css','.vert','.frag','.glsl','.py','.bat','.txt'}

def digest(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def safe(name: str) -> bool:
    return isinstance(name, str) and bool(name) and not name.startswith('/') and '\\' not in name and '..' not in PurePosixPath(name).parts

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href','src') and value:
                self.links.append((tag, key, value))

def check(root: Path) -> dict:
    root = root.resolve()
    errors = []
    def require(ok, label):
        if not ok:
            errors.append(label)
    try:
        manifest = json.loads((root/'MANIFEST.json').read_text('utf-8'))
        require(manifest.get('format') == 'ocean-mother-clean-full-manifest', 'manifest format')
        expected = manifest['files']
        actual = {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
        require(actual == set(expected) | {'MANIFEST.json'}, 'file list mismatch')
        for name, entry in expected.items():
            require(safe(name), 'unsafe path: '+name)
            if not safe(name):
                continue
            p = root/name
            require(p.is_file() and not p.is_symlink(), 'missing or symlink: '+name)
            if not p.is_file() or p.is_symlink():
                continue
            b = p.read_bytes()
            require(len(b) == entry['bytes'] and digest(b) == entry['sha256'], 'file identity: '+name)
            require(p.suffix.lower() in ALLOWED, 'forbidden asset type: '+name)
            require(not b.startswith((b'\x89PNG',b'\xff\xd8\xff',b'GIF87a',b'GIF89a',b'RIFF',b'PK\x03\x04')), 'binary asset: '+name)
            text = b.decode('utf-8')
            require(not re.search(r'data\s*:\s*image/', text, re.I), 'embedded image: '+name)
            if p.suffix == '.html':
                parser = Links(); parser.feed(text)
                for tag, attr, address in parser.links:
                    url = urlsplit(address)
                    if not url.scheme and url.path:
                        target = (p.parent/unquote(url.path)).resolve()
                        require(target.is_relative_to(root) and target.exists(), 'missing HTML dependency: '+name+' : '+address)
                    elif url.scheme in ('http','https') and attr == 'src':
                        require(False, 'external runtime dependency: '+name)
        source = json.loads((root/'SOURCE_LOCK.json').read_text('utf-8'))
        for name, entry in source['files'].items():
            require(safe(name), 'unsafe source path')
            if safe(name):
                b = (root/name).read_bytes()
                require(digest(b) == entry['sha256'], 'source identity: '+name)
                git = hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
                require(git == entry['gitBlobSha'], 'Git blob: '+name)
        counts = {}
        for rel, key in [('workbench','published'),('workbench/weather','weather')]:
            folder = root/rel
            upstream = json.loads((folder/'MANIFEST.json').read_text('utf-8'))
            for name, entry in upstream['files'].items():
                require(safe(name), key+' unsafe path')
                if safe(name):
                    b = (folder/name).read_bytes()
                    require(len(b) == entry['bytes'] and digest(b) == entry['sha256'], key+' mismatch: '+name)
            counts[key] = len(upstream['files'])
        return {'status':'PACKAGE_INTEGRITY_PASS' if not errors else 'PACKAGE_INTEGRITY_FAIL',
                'filesChecked':len(expected),'sourceFilesChecked':len(source['files']),
                'publishedEntriesChecked':counts['published'],'weatherEntriesChecked':counts['weather'],
                'errors':errors,'browserTestExecuted':False,'visualApproved':False,'productionApproved':False}
    except (OSError, ValueError, KeyError, TypeError) as exc:
        return {'status':'PACKAGE_INTEGRITY_FAIL','errors':errors+[str(exc)],'browserTestExecuted':False}

if __name__ == '__main__':
    result = check(Path(__file__).resolve().parents[1])
    print(json.dumps(result, ensure_ascii=False, indent=2))
    sys.exit(0 if result['status']=='PACKAGE_INTEGRITY_PASS' else 1)
