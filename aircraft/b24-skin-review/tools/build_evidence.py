"""Publish selected original atlas bytes, never modify aircraft geometry or livery.
The public gallery is a read-only source inspection, not a paint release.
Run with --source /path/to/locked.glb for an offline, reproducible build.
"""
from pathlib import Path
import argparse, hashlib, json, struct, urllib.request

SOURCE_URL = 'https://raw.githubusercontent.com/haihao0307/AIRCRAFT/7eadf5511c8b3721f6ece46c587ac88428c93740/public/assets/model/b-24_liberator.glb'
EXPECTED_BYTES = 23085972
EXPECTED_SHA256 = '541c3dcfb98ab590cdb1bc90d6ddcdfe80bce2a4b937f3bccefab0c7efe8be0d'
SELECTED = {2: '机身原图集', 5: '机翼及短舱原图集 A', 7: '尾翼原图集', 9: '机翼及短舱原图集 B'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path)
    args = parser.parse_args()
    if args.source:
        raw = args.source.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=120) as response:
            raw = response.read(EXPECTED_BYTES + 1)
    if len(raw) != EXPECTED_BYTES or hashlib.sha256(raw).hexdigest() != EXPECTED_SHA256:
        raise RuntimeError('Source GLB identity mismatch; publication aborted')
    if struct.unpack_from('<III', raw) != (0x46546c67, 2, len(raw)):
        raise RuntimeError('Invalid GLB header')
    chunks = {}
    offset = 12
    while offset < len(raw):
        size, kind = struct.unpack_from('<II', raw, offset)
        if offset + 8 + size > len(raw):
            raise RuntimeError('Invalid chunk length')
        chunks[kind] = raw[offset + 8:offset + 8 + size]
        offset += 8 + size
    manifest = json.loads(chunks[0x4e4f534a])
    binary = chunks[0x004e4942]
    output = Path(__file__).resolve().parent.parent / 'assets'
    output.mkdir(parents=True, exist_ok=True)
    images = []
    for index, title in SELECTED.items():
        image = manifest['images'][index]
        view = manifest['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        data = binary[start:start + view['byteLength']]
        if len(data) != view['byteLength'] or image['mimeType'] != 'image/jpeg':
            raise RuntimeError('Unexpected image representation')
        filename = f'original-atlas-{index:02d}.jpg'
        (output / filename).write_bytes(data)
        images.append({'id': index, 'title': title, 'path': 'assets/' + filename,
                       'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                       'transformation': 'none: byte-exact embedded JPEG',
                       'use': 'old-model seam candidate inspection only'})
    report = {'schema': 'b24-seam-evidence/1.0', 'sourceURL': SOURCE_URL,
              'sourceBytes': len(raw), 'sourceSHA256': EXPECTED_SHA256,
              'nodes': len(manifest['nodes']), 'meshes': len(manifest['meshes']),
              'imagesInOriginal': len(manifest['images']), 'publishedImages': images,
              'normalTextureMaterialCount': sum('normalTexture' in m for m in manifest['materials']),
              'generatedArtwork': False, 'geometryChanged': False,
              'historicalPanelLayoutApproved': False, 'productionReady': False,
              'warning': 'Old artwork, paint and markings are not the 80 DAYS livery and must not be copied into it.'}
    (output / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'sourceVerified': True, 'publishedImageCount': len(images),
                      'imageBytes': sum(i['bytes'] for i in images),
                      'geometryChanged': False}, ensure_ascii=False))

if __name__ == '__main__':
    main()
