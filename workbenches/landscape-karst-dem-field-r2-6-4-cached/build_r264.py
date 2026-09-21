from pathlib import Path
import base64, hashlib, json, struct, zlib
import numpy as np
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / 'workbenches/landscape-karst-dem-field-r2-6-4-cached'
TEMPLATE = OUT_DIR / 'template.html'
INDEX = OUT_DIR / 'index.html'
DEFAULT_CACHE = OUT_DIR / 'default.kfc.b64'
NO_CRACK_CACHE = OUT_DIR / 'no-cracks.kfc.b64'
BUILD = OUT_DIR / 'build.json'
CONTRACT = OUT_DIR / 'production_contract.json'

BOUNDS = np.array([[-10.0, 10.0], [-7.4, 9.4], [-10.0, 10.0]], dtype=np.float32)
SHAPE = (60, 78, 78)  # y, z, x


def smooth(a, b, t):
    q = np.clip((t - a) / (b - a), 0, 1)
    return q * q * (3 - 2 * q)


def sdf_volume(crack_depth=1.35, crack_width=0.26, notch_amp=2.8, branch=0.9, cavity=1.0, detail=0.85):
    ny, nz, nx = SHAPE
    ys = np.linspace(BOUNDS[1, 0], BOUNDS[1, 1], ny, dtype=np.float32)
    zs = np.linspace(BOUNDS[2, 0], BOUNDS[2, 1], nz, dtype=np.float32)
    xs = np.linspace(BOUNDS[0, 0], BOUNDS[0, 1], nx, dtype=np.float32)
    y, z, x = np.meshgrid(ys, zs, xs, indexing='ij')

    reef_h = -6.0 + 0.10 * np.sin(x * 0.42) + 0.08 * np.sin(z * 0.37) + 0.035 * np.sin(x * 0.81 - z * 0.57)
    reef_dom = (np.sqrt((x / 10.6) ** 2 + (z / 9.1) ** 2) - 1) * 2.2
    reef = np.maximum(np.maximum(y - reef_h, reef_dom), -y - 7.3)

    a, b = (x + 1.6) / 4.5, (z - 0.2) / 3.7
    c, d = (x - 2.8) / 3.3, (z + 0.6) / 3.0
    e, f = (x + 3.3) / 2.6, (z + 2.2) / 2.2
    h = -5.95 + 9.5 * np.exp(-(a * a + b * b) * 1.35)
    h += 6.1 * np.exp(-(c * c + d * d) * 1.7)
    h += 3.8 * np.exp(-(e * e + f * f) * 1.9)
    h += 0.48 * np.sin(x * 0.43 + z * 0.17) + 0.22 * np.sin(x * 0.2 - z * 0.52 + 1.7)
    h += 0.10 * np.cos(x * 0.75 + z * 0.32)

    radial = np.sqrt((x / 7.9) ** 2 + (z / 6.5) ** 2)
    sea_noise = 0.16 * np.sin(x * 0.37 + z * 0.23) + 0.08 * np.sin(x * 0.83 - z * 0.49)
    sea = -4.08 + sea_noise
    yr = y - sea
    lip = smooth(-0.60, -0.12, yr) * (1 - smooth(-0.02, 0.10, yr))
    neck = smooth(-2.35, -1.45, yr) * (1 - smooth(-0.18, 0.02, yr))
    az = 0.72 + 0.18 * np.sin(np.arctan2(z, x) * 3.0) + 0.10 * np.sin(np.arctan2(z, x) * 7.0)
    notch = (lip * 0.78 + neck * 0.52) * smooth(0.78, 1.1, radial) * az * notch_amp * 0.42
    flare = (1 - smooth(-2.7, -1.55, yr)) * smooth(0.80, 1.12, radial) * notch_amp * 0.11

    rock = np.maximum(np.maximum((y - h) * 0.36, (radial - 1) * 1.75 + notch - flare), -y - 7.15)
    noise = (np.sin(x * 0.51 + y * 0.12 + z * 0.39)
             + np.sin(x * 1.07 - y * 0.21 + z * 0.84) * 0.45
             + np.cos(x * 0.27 + y * 0.33 - z * 0.73) * 0.35) / 1.8
    rock += noise * 0.18 * detail

    caves = [
        ((-4.5, -1.45, 1.9), (2.25, 1.35, 2.75)),
        ((3.55, -0.55, 1.5), (1.75, 1.15, 2.25)),
        ((0.7, 1.65, -4.45), (1.9, 1.4, 2.5)),
        ((-0.4, 2.8, 3.7), (1.05, 0.9, 1.55)),
        ((-2.2, 2.5, 3.3), (0.62, 0.72, 0.72)),
        ((2.8, 1.15, 2.7), (0.8, 0.62, 0.94)),
    ]
    cv = np.full_like(rock, 1e6)
    for (cx, cy, cz), (rx, ry, rz) in caves:
        q = (np.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2) - 1)
        q *= min(rx, ry, rz) / max(cavity, 0.01)
        cv = np.minimum(cv, q)
    if cavity > 0:
        rock = np.maximum(rock, -cv)

    pre = rock.copy()
    if crack_depth > 0:
        paths = [
            (0.88, 0.20, -0.18, 0.82, -3.5, 6.6),
            (0.34, -0.94, -0.22, 1.03, -3.0, 5.2),
            (-0.62, 0.72, 0.08, 1.28, -2.3, 4.1),
            (0.58, -0.82, 0.14, 1.36, 3.1, 7.0),
        ]
        crack = np.full_like(rock, 1e6)
        for i, (ax, az, c0, freq, lo, hi) in enumerate(paths):
            if i > 1 and branch < 0.35:
                continue
            warp = 0.12 * np.sin(y * freq + i * 1.73) + 0.04 * np.sin(y * 2.1 - i)
            plane = np.abs(x * ax + z * az + c0 + warp)
            t = np.clip((-pre) / crack_depth, 0, 1)
            width = crack_width * np.power(np.maximum(1 - t, 0), 0.72)
            width *= 1 if i < 2 else (0.55 + 0.28 * branch)
            shell = np.maximum(pre, -pre - crack_depth)
            window = np.maximum(lo - y, y - hi)
            crack = np.minimum(crack, np.maximum(np.maximum(plane - width, shell), window))
        rock = np.maximum(rock, -crack)

    k = 0.34
    blend = np.maximum(k - np.abs(rock - reef), 0) / k
    field = np.minimum(rock, reef) - blend * blend * k * 0.25
    return field


def build_cache(crack_depth):
    volume = sdf_volume(crack_depth=crack_depth)
    spacing = (
        (BOUNDS[1, 1] - BOUNDS[1, 0]) / (SHAPE[0] - 1),
        (BOUNDS[2, 1] - BOUNDS[2, 0]) / (SHAPE[1] - 1),
        (BOUNDS[0, 1] - BOUNDS[0, 0]) / (SHAPE[2] - 1),
    )
    verts, faces, normals, _ = marching_cubes(volume, level=0, spacing=spacing, gradient_direction='ascent', allow_degenerate=False)
    positions = np.empty_like(verts, dtype=np.float32)
    positions[:, 0] = verts[:, 2] + BOUNDS[0, 0]
    positions[:, 1] = verts[:, 0] + BOUNDS[1, 0]
    positions[:, 2] = verts[:, 1] + BOUNDS[2, 0]
    out_normals = np.empty_like(normals, dtype=np.float32)
    out_normals[:, 0] = normals[:, 2]
    out_normals[:, 1] = normals[:, 0]
    out_normals[:, 2] = normals[:, 1]
    out_normals /= np.linalg.norm(out_normals, axis=1, keepdims=True) + 1e-8
    kinds = (positions[:, 1] < -5.25).astype(np.uint8)
    qpos = np.round((positions - BOUNDS[:, 0]) / (BOUNDS[:, 1] - BOUNDS[:, 0]) * 65535).clip(0, 65535).astype('<u2')
    qnorm = np.round(np.clip(out_normals, -1, 1) * 127).astype(np.int8)
    indices = faces.astype('<u4')
    header = {
        'bounds': BOUNDS.tolist(), 'vertices': len(positions), 'faces': len(faces),
        'positionType': 'u16x3', 'normalType': 'i8x3', 'kindType': 'u8', 'indexType': 'u32'
    }
    header_bytes = json.dumps(header, separators=(',', ':')).encode('utf-8')
    raw = struct.pack('<I', len(header_bytes)) + header_bytes
    raw += qpos.tobytes() + qnorm.tobytes() + kinds.tobytes() + indices.tobytes()
    encoded = base64.b64encode(zlib.compress(raw, 9)).decode('ascii')
    return encoded, header, len(raw)


OUT_DIR.mkdir(parents=True, exist_ok=True)
default_data, default_header, default_raw = build_cache(1.35)
no_crack_data, no_crack_header, no_crack_raw = build_cache(0.0)
DEFAULT_CACHE.write_text(default_data, encoding='ascii')
NO_CRACK_CACHE.write_text(no_crack_data, encoding='ascii')
INDEX.write_text(TEMPLATE.read_text(encoding='utf-8'), encoding='utf-8')

contract = {
    'schema': 'KARST_FIELD_PRODUCTION_CONTRACT_R264',
    'authority': 'deterministic function field',
    'renderCache': 'quantized indexed surface generated from frozen field',
    'cacheIsNotTerrainTruth': True,
    'cracksAffectDistanceField': True,
    'reefPlatformContinuousUnion': True,
    'runtimeTide': {'source': 'Ocean Mother', 'changesGeometry': False, 'affects': ['waterSurface', 'wetBand', 'reefWetDryBoundary']},
    'cacheKey': 'demHash + operatorHash + frozenParameterHash + formatVersion',
    'runtimeBands': ['demMacro', 'karstStructure', 'surfaceMicroscope'],
    'visualApproved': False,
}
CONTRACT.write_text(json.dumps(contract, ensure_ascii=False, indent=2), encoding='utf-8')
report = {
    'schema': 'LANDSCAPE_KARST_DEM_FIELD_R264_CACHED_PRODUCTION',
    'output': str(INDEX.relative_to(ROOT)),
    'outputSha256': hashlib.sha256(INDEX.read_bytes()).hexdigest(),
    'defaultCacheBytes': DEFAULT_CACHE.stat().st_size,
    'noCrackCacheBytes': NO_CRACK_CACHE.stat().st_size,
    'defaultGeometry': default_header,
    'noCrackGeometry': no_crack_header,
    'rawGeometryBytes': {'default': default_raw, 'noCracks': no_crack_raw},
    'runtimeRenderer': 'simple indexed WebGL2 surface cache; no full-screen SDF raymarch',
    'productionCandidate': True,
    'visualApproved': False,
}
BUILD.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
