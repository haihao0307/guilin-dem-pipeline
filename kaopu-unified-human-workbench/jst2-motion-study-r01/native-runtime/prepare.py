#!/usr/bin/env python3
"""Download only SHA-locked original R07 native resources for a static viewer."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse, hashlib, json, urllib.request, gzip

HERE = Path(__file__).resolve().parent
HOST_URL = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/5543f756ca3af1428323696324303fa70b8de850/kaopu-unified-human-workbench/human-integrated-r07/preview.html'
HOST_SHA = 'd1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a'
HOST_BYTES = 5449139
MANIFEST_URL = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/1ba2b58eb3fdd6efe60b993240e988980547c93e/kaopu-unified-human-workbench/human-integrated-r06/StreamingManifest.json'
MANIFEST_SHA = 'f3075563d5b20ae6bd6471de77eb6394fa4cb12f5aa37774075ccaadd9c7fbd4'
BASE = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/475ead2759159b83927a1aa8ae6879595e1d18bc/kaopu-unified-human-workbench/human-integrated-r05/'
FACE = 'https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/02f596def9d07ebfc187e1eb18ad345a57c8a6b6/kaopu-unified-human-workbench/face-transfer/assets/'
IMAGES = [
    ('detail.png', 894772, '330121475d188b626b27138d1e41c1712201a605ef147bc62f549e262074417a'),
    ('chroma.png', 480198, '9d499858603d6b367a1bd6c844312d51573250835bba50a5177624b1d4485df4'),
]

def sha(data): return hashlib.sha256(data).hexdigest()

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'KAOPU-native-motion-study/1'}), timeout=60) as response:
        return response.read()

def verified(path, url, expected_sha, expected_bytes=None):
    data = path.read_bytes() if path.exists() else b''
    if sha(data) != expected_sha or (expected_bytes is not None and len(data) != expected_bytes):
        data = fetch(url)
        assert sha(data) == expected_sha, f'SHA mismatch: {url}'
        assert expected_bytes is None or len(data) == expected_bytes, f'Size mismatch: {url}'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--packets', default='hot', help='Comma separated original packet IDs; hot is the one-person startup default')
    args = parser.parse_args()
    # The canonical host is an ignored build input. A clean checkout must be
    # able to reproduce it from this immutable commit without manual copying.
    verified(HERE.parent/'native'/'r07-host.html', HOST_URL, HOST_SHA, HOST_BYTES)
    manifest_raw = verified(HERE/'StreamingManifest.json', MANIFEST_URL, MANIFEST_SHA)
    manifest = json.loads(manifest_raw)
    selected_ids = set(args.packets.split(','))
    packets = [p for p in manifest['files'] if p['id'] in selected_ids]
    assert {p['id'] for p in packets} == selected_ids, 'Unknown native packet'
    chunks = {c['url']: c for p in packets for c in p['chunks']}
    def one(c):
        data = verified(HERE/c['url'], BASE+c['url'], c['sha256'], c['bytes'])
        return {'path': c['url'], 'bytes': len(data), 'sha256': sha(data), 'sourceURL': BASE+c['url']}
    with ThreadPoolExecutor(max_workers=5) as pool:
        files = list(pool.map(one, chunks.values()))
    for packet in packets:
        compressed = b''.join((HERE/c['url']).read_bytes() for c in packet['chunks'])
        assert len(compressed) == packet['bytes'] and sha(compressed) == packet['sha256']
        raw = gzip.decompress(compressed)
        assert len(raw) == packet['rawBytes'] and sha(raw) == packet['rawSHA256']
    for name, size, digest in IMAGES:
        data = verified(HERE/'assets'/name, FACE+name, digest, size)
        files.append({'path':'assets/'+name,'bytes':len(data),'sha256':digest,'sourceURL':FACE+name})
    lock_path = HERE/'SOURCE_LOCK.json'
    previous = json.loads(lock_path.read_text()) if lock_path.exists() else {'files':[], 'packetIds':[]}
    by_path = {f['path']:f for f in previous['files']}
    by_path.update({f['path']:f for f in files})
    lock = {'schema':'kaopu/native-motion-viewer-assets@1','nativeSourceCommit':'5543f756ca3af1428323696324303fa70b8de850','nativeHostSHA256':HOST_SHA,'nativeHostBytes':HOST_BYTES,'nativeHostURL':HOST_URL,'streamManifestSHA256':MANIFEST_SHA,'packetIds':sorted(set(previous['packetIds'])|selected_ids),'files':list(by_path.values()),'originalBytesUnmodified':True}
    lock_path.write_text(json.dumps(lock,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'nativeHostVerified':True,'nativeHostBytes':HOST_BYTES,'packetsVerified':sorted(selected_ids),'filesVerified':len(files),'bytesVerified':sum(x['bytes'] for x in files)}))

if __name__ == '__main__': main()
