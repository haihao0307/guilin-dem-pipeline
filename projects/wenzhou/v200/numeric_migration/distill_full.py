"""Losslessly migrate a single-band Int16 V200 DEM to a tiled numeric store.
Never deletes the source. Compare every row-major sample, including NoData.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse, hashlib, gzip, json, struct, time
from datetime import datetime, timezone
import numpy as np
import rasterio

EXPECTED = '639a69429e104d9c2db1550870da79dc2b89df9ac893c18405901530c25ff353'


def encode(a):
    q = a.astype(np.int32)
    d = q.copy()
    d[1:] -= q[:-1]
    q = d.copy()
    d[:, 1:] -= q[:, :-1]
    return b'WZN7' + struct.pack('<HH', a.shape[1], a.shape[0]) + gzip.compress(d.astype('<i2').tobytes(), compresslevel=6, mtime=0)


def decode(b):
    if b[:4] != b'WZN7':
        raise ValueError('Unexpected numeric file magic')
    w, h = struct.unpack('<HH', b[4:8])
    d = np.frombuffer(gzip.decompress(b[8:]), dtype='<i2')
    if d.size != w * h:
        raise ValueError('Unexpected sample count')
    return d.reshape(h, w).astype(np.int64).cumsum(0).cumsum(1).astype('<i2')


def main(source, out):
    t = time.time()
    out.mkdir(parents=True, exist_ok=True)
    (out / 'tiles').mkdir(exist_ok=True)
    with rasterio.open(source) as ds:
        if ds.count != 1 or ds.dtypes[0] != 'int16':
            raise ValueError('Expected original single-band Int16 values')
        a = ds.read(1).astype('<i2')
        tr = ds.transform
        metadata = {'width': ds.width, 'height': ds.height, 'crs': ds.crs.to_string(), 'crsWkt': ds.crs.to_wkt(), 'transform': [tr.a, tr.b, tr.c, tr.d, tr.e, tr.f], 'nodata': int(ds.nodata), 'scales': list(ds.scales), 'offsets': list(ds.offsets), 'unit': 'm', 'pixelConvention': 'pixel centers', 'tags': ds.tags(), 'dtype': 'int16', 'byteOrder': 'little-endian'}
    digest = hashlib.sha256(a.tobytes(order='C')).hexdigest()
    if digest != EXPECTED:
        raise ValueError('Wrong V200 pixel identity')
    recon = np.empty_like(a)
    jobs = [(r, c) for r in range(0, a.shape[0], 1024) for c in range(0, a.shape[1], 1024)]

    def one(rc):
        r, c = rc
        x = a[r:r+1024, c:c+1024]
        b = encode(x)
        name = f'tiles/r{r:05d}-c{c:05d}.wzn'
        p = out / name
        p.write_bytes(b)
        # Independent filesystem re-read, not the encoder's input buffer.
        back = decode(p.read_bytes())
        bad = int(np.count_nonzero(x != back))
        recon[r:r+x.shape[0], c:c+x.shape[1]] = back
        if bad:
            raise ValueError(f'Changed source values in {name}: {bad}')
        return {'path': name, 'startRow': r, 'startCol': c, 'width': x.shape[1], 'height': x.shape[0], 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest(), 'valueSha256': hashlib.sha256(x.tobytes()).hexdigest(), 'mismatchedSamples': bad}

    with ThreadPoolExecutor(max_workers=8) as pool:
        tiles = list(pool.map(one, jobs))
    backhash = hashlib.sha256(recon.tobytes(order='C')).hexdigest()
    bad = int(np.count_nonzero(a != recon))
    if backhash != digest or bad:
        raise ValueError('Full row-major reconstruction differs from source')
    valid = a[a != metadata['nodata']]
    report = {'schema': 'wenzhou-v7-complete-numeric-roundtrip-1', 'checkedUtc': datetime.now(timezone.utc).isoformat(), 'passed': True, 'sourceName': source.name, 'sourceContainerBytes': source.stat().st_size, 'sourceContainerSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'historicalContainerMatched': False, 'sourceValueSha256': digest, 'reconstructedValueSha256': backhash, 'sampleCount': int(a.size), 'validSamples': int(valid.size), 'nodataSamples': int(a.size-valid.size), 'mismatchedSamples': bad, 'maxSourceNodeErrorM': 0, 'minimumM': int(valid.min()), 'maximumM': int(valid.max()), 'meanM': float(valid.mean()), 'rawBytes': int(a.nbytes), 'numericBytes': sum(x['bytes'] for x in tiles), 'tileCount': len(tiles), 'allSamplesCompared': True, 'fullStoreOnlineVerified': False, 'sourceDeleted': False, 'deletionAllowed': False, 'codec': 'WZN7: <HH shape, gzip modular Int16 2D delta; cumulative Y then X modulo 65536', 'grid': metadata, 'elapsedSeconds': time.time()-t}
    manifest = {'schema': 'wenzhou-v7-complete-numeric-manifest-1', 'sourceValueSha256': digest, 'grid': metadata, 'tiles': tiles, 'sourceDeleted': False, 'fullStoreOnlineVerified': False}
    for name, obj in [('FULL_NUMERIC_ROUNDTRIP.json', report), ('FULL_NUMERIC_MANIFEST.json', manifest)]:
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('source', type=Path)
    p.add_argument('output', type=Path)
    args = p.parse_args()
    main(args.source, args.output)
