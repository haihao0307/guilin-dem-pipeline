from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
from pathlib import Path
from typing import Any

try:
    import numpy as np
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.warp import transform, transform_bounds
except ModuleNotFoundError:  # Metadata-only rebuilds can run with the standard library.
    np = None
    rasterio = None
    Resampling = None

    def _utm49(lon: float, lat: float) -> tuple[float, float]:
        a, ecc_sq, k0 = 6378137.0, 0.00669437999014, 0.9996
        ecc_prime_sq = ecc_sq / (1.0 - ecc_sq)
        lat_r, lon_r = math.radians(lat), math.radians(lon)
        lon0 = math.radians(111.0)
        sin_lat, cos_lat, tan_lat = math.sin(lat_r), math.cos(lat_r), math.tan(lat_r)
        n = a / math.sqrt(1.0 - ecc_sq * sin_lat * sin_lat)
        t = tan_lat * tan_lat
        c = ecc_prime_sq * cos_lat * cos_lat
        aa = cos_lat * (lon_r - lon0)
        m = a * ((1 - ecc_sq / 4 - 3 * ecc_sq**2 / 64 - 5 * ecc_sq**3 / 256) * lat_r
            - (3 * ecc_sq / 8 + 3 * ecc_sq**2 / 32 + 45 * ecc_sq**3 / 1024) * math.sin(2 * lat_r)
            + (15 * ecc_sq**2 / 256 + 45 * ecc_sq**3 / 1024) * math.sin(4 * lat_r)
            - (35 * ecc_sq**3 / 3072) * math.sin(6 * lat_r))
        x = k0 * n * (aa + (1 - t + c) * aa**3 / 6 + (5 - 18 * t + t**2 + 72 * c - 58 * ecc_prime_sq) * aa**5 / 120) + 500000.0
        y = k0 * (m + n * tan_lat * (aa**2 / 2 + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24 + (61 - 58 * t + t**2 + 600 * c - 330 * ecc_prime_sq) * aa**6 / 720))
        return x, y

    def transform(_src: str, _dst: str, xs: list[float], ys: list[float]) -> tuple[list[float], list[float]]:
        projected = [_utm49(float(x), float(y)) for x, y in zip(xs, ys)]
        return [point[0] for point in projected], [point[1] for point in projected]

    def transform_bounds(_src: str, _dst: str, left: float, bottom: float, right: float, top: float, densify_pts: int = 21) -> list[float]:
        corners = [_utm49(left, bottom), _utm49(left, top), _utm49(right, bottom), _utm49(right, top)]
        return [min(x for x, _ in corners), min(y for _, y in corners), max(x for x, _ in corners), max(y for _, y in corners)]

from common import read_json, sha256_file, utc_now, write_json


class PipelineError(RuntimeError):
    pass


def json_if_exists(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return read_json(path)
    except Exception:
        return default


LANDMARKS = [
    {
        "id": "zhenbao-ding",
        "name": "真寶鼎",
        "longitude": 110.82528,
        "latitude": 26.13556,
        "color": "#f2bd65",
    },
    {
        "id": "yangshuo-county-seat",
        "name": "陽朔縣",
        "longitude": 110.4920133,
        "latitude": 24.7815129,
        "color": "#73d7b0",
    },
    {
        "id": "yangtang-airfield",
        "name": "秧塘機場",
        "longitude": 110.15569,
        "latitude": 25.21753,
        "color": "#7bb7ff",
    },
    {
        "id": "guilin-old-city",
        "name": "桂林古城",
        "longitude": 110.2994,
        "latitude": 25.2742,
        "color": "#e989b7",
    },
]


def downsample_height(dem_path: Path, assets: Path, max_side: int = 2048) -> dict[str, Any]:
    if rasterio is None or np is None:
        raise PipelineError("rasterio and numpy are required to rebuild a DEM raster; use --from-manifest for metadata-only regeneration")
    with rasterio.open(dem_path) as dataset:
        scale = max(dataset.width / max_side, dataset.height / max_side, 1.0)
        width = max(2, int(round(dataset.width / scale)))
        height = max(2, int(round(dataset.height / scale)))
        data = dataset.read(1, out_shape=(height, width), masked=True, resampling=Resampling.bilinear)
        source_mask = (~np.ma.getmaskarray(data)).astype(np.uint8)
        values = np.asarray(data.filled(np.nan), dtype=np.float32)
        valid = values[np.isfinite(values) & (source_mask == 1)]
        if valid.size == 0:
            raise PipelineError("DEM preview grid contains no valid pixels")
        source_valid_fraction = float(source_mask.mean())
        if source_valid_fraction < 0.9999:
            raise PipelineError(
                f"Web context DEM has incomplete real coverage ({source_valid_fraction:.6f}); "
                "visual extrapolation is disabled"
            )
        filled = values
        mask = source_mask
        minimum = float(np.nanmin(valid))
        maximum = float(np.nanmax(valid))
        value_range = max(maximum - minimum, 1e-6)
        normalized = np.clip((filled - minimum) / value_range, 0.0, 1.0)
        quantized = np.round(normalized * 65535.0).astype("<u2")
        height_path = assets / "height_u16.bin"
        mask_path = assets / "mask_u8.bin"
        height_path.write_bytes(quantized.tobytes(order="C"))
        mask_path.write_bytes(mask.tobytes(order="C"))
        # A compact source-faithful 2D preview; it uses the same downloaded values.
        palette = np.stack(
            (
                np.clip(18 + normalized * 205, 0, 255),
                np.clip(55 + normalized * 175, 0, 255),
                np.clip(42 + normalized * 105, 0, 255),
            ),
            axis=0,
        ).astype(np.uint8)
        with rasterio.open(
            assets / "DEM_PREVIEW.png", "w", driver="PNG", width=width, height=height,
            count=3, dtype="uint8"
        ) as preview:
            preview.write(palette)
        bounds = list(dataset.bounds)
        wgs84_bounds = list(transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds, densify_pts=21)) if dataset.crs else None
        resolution = [abs(dataset.transform.a), abs(dataset.transform.e)]
        width_m = float(bounds[2] - bounds[0])
        height_m = float(bounds[3] - bounds[1])
        landmarks = []
        if dataset.crs:
            xs, ys = transform(
                "EPSG:4326",
                dataset.crs,
                [item["longitude"] for item in LANDMARKS],
                [item["latitude"] for item in LANDMARKS],
            )
            for item, x, y in zip(LANDMARKS, xs, ys):
                u = float(np.clip((x - bounds[0]) / width_m, 0.0, 1.0))
                v = float(np.clip((bounds[3] - y) / height_m, 0.0, 1.0))
                col = int(round(u * (width - 1)))
                row = int(round(v * (height - 1)))
                landmarks.append(
                    {
                        **item,
                        "projectedX": float(x),
                        "projectedY": float(y),
                        "gridU": u,
                        "gridV": v,
                        "elevationMeters": float(filled[row, col]),
                    }
                )
        height_sha256 = sha256_file(height_path)
        mask_sha256 = sha256_file(mask_path)
        return {
            "schemaVersion": "terrain-manifest/v1",
            "assetVersion": f"guilin-{height_sha256[:12]}",
            "ready": True,
            "gridWidth": width,
            "gridHeight": height,
            "minimumElevation": minimum,
            "maximumElevation": maximum,
            "bounds": bounds,
            "wgs84Bounds": wgs84_bounds,
            "crs": dataset.crs.to_string() if dataset.crs else None,
            "resolution": resolution,
            "widthMeters": width_m,
            "heightMeters": height_m,
            "axisConvention": {"x": "east", "y": "up", "z": "south"},
            "rowOrder": "north-to-south",
            "columnOrder": "west-to-east",
            "heightEncoding": {
                "sampleType": "uint16",
                "byteOrder": "little-endian",
                "quantizationMinimumMeters": minimum,
                "quantizationMaximumMeters": maximum,
                "decodeFormula": "min_m + sample_u16 / 65535 * (max_m - min_m)",
            },
            "heightBinary": "assets/height_u16.bin",
            "heightByteLength": height_path.stat().st_size,
            "heightSha256": height_sha256,
            "maskBinary": "assets/mask_u8.bin",
            "maskByteLength": mask_path.stat().st_size,
            "maskSha256": mask_sha256,
            "noDataPolicy": "网页只显示已下载的真实DEM像元；禁止插值外推补边",
            "validFraction": float(mask.mean()),
            "sourceValidFraction": source_valid_fraction,
            "visualFillApplied": False,
            "visualFillMethod": None,
            "sourceCoverageType": "downloaded",
            "landmarks": landmarks,
        }


def attach_lijiang(terrain: dict[str, Any], geojson_path: Path) -> None:
    if not geojson_path.exists() or not terrain.get("ready"):
        terrain["rivers"] = []
        return
    payload = read_json(geojson_path)
    bounds = terrain["bounds"]
    width_m = terrain["widthMeters"]
    height_m = terrain["heightMeters"]
    lines = []
    for feature in payload.get("features", []):
        coordinates = feature.get("geometry", {}).get("coordinates", [])
        if len(coordinates) < 2:
            continue
        longitudes = [float(point[0]) for point in coordinates]
        latitudes = [float(point[1]) for point in coordinates]
        xs, ys = transform("EPSG:4326", terrain["crs"], longitudes, latitudes)
        points = []
        for longitude, latitude, x, y in zip(longitudes, latitudes, xs, ys):
            u = (x - bounds[0]) / width_m
            v = (bounds[3] - y) / height_m
            if -0.01 <= u <= 1.01 and -0.01 <= v <= 1.01:
                points.append({"u": float(u), "v": float(v), "longitude": longitude, "latitude": latitude})
        if len(points) >= 2:
            lines.append(points)
    terrain["rivers"] = lines
    terrain["riverSource"] = payload.get("properties", {}).get("source", "OpenStreetMap contributors")
    terrain["riverLicense"] = payload.get("properties", {}).get("license", "ODbL 1.0")


def attach_waterways(terrain: dict[str, Any], geojson_path: Path) -> None:
    """Project every downloaded OSM waterway onto the DEM; names are metadata only."""
    if not geojson_path.exists() or not terrain.get("ready"):
        terrain["waterways"] = []
        terrain["waterwayCount"] = 0
        return
    payload = read_json(geojson_path)
    bounds = terrain["bounds"]
    width_m = terrain["widthMeters"]
    height_m = terrain["heightMeters"]
    lines = []
    for feature in payload.get("features", []):
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "LineString":
            continue
        coordinates = geometry.get("coordinates") or []
        if len(coordinates) < 2:
            continue
        longitudes = [float(point[0]) for point in coordinates]
        latitudes = [float(point[1]) for point in coordinates]
        xs, ys = transform("EPSG:4326", terrain["crs"], longitudes, latitudes)
        points = []
        for longitude, latitude, x, y in zip(longitudes, latitudes, xs, ys):
            u = (x - bounds[0]) / width_m
            v = (bounds[3] - y) / height_m
            if -0.01 <= u <= 1.01 and -0.01 <= v <= 1.01:
                points.append({"u": float(u), "v": float(v)})
        if len(points) >= 2:
            lines.append(points)
    terrain["waterways"] = lines
    terrain["waterwayCount"] = len(lines)
    terrain["waterwaySource"] = payload.get("properties", {}).get("source", "OpenStreetMap contributors")
    terrain["waterwayLicense"] = payload.get("properties", {}).get("license", "ODbL 1.0")
    terrain["waterwayLabelPolicy"] = "只绘制水系线，不显示名称"


def attach_ecology(terrain: dict[str, Any], package_dir: Path, assets: Path) -> None:
    """Package the existing ecology proof assets for the 60 km² Yangtang focus view."""
    runtime = package_dir / "runtime-assets"
    required = [runtime / name for name in (
        "field0-elevation-slope-forest-water.png",
        "field1-paddy-bund-rows-rock.png",
        "field2-wet-terrace-erosion-landuse.png",
        "trees.bin",
        "shrubs.bin",
        "rice.bin",
    )]
    if not all(path.exists() for path in required):
        terrain["ecology"] = {"ready": False, "sourceStatus": "package-missing"}
        return
    target = assets / "ecology" / "v0.3.1"
    target.mkdir(parents=True, exist_ok=True)
    for source in required:
        shutil.copy2(source, target / source.name)
    release = json_if_exists(package_dir / "ecology-release-manifest.json", {})
    aoi = release.get("aoi", {})
    terrain["ecology"] = {
        "ready": True,
        "version": "0.3.1",
        "aoiAreaSquareKilometers": float(aoi.get("areaKm2", 10.0)),
        "sideMeters": float(aoi.get("sideMeters", 3162.2776601683795)),
        "centerProjected": aoi.get("centerProjected", [415018.03522667295, 2789215.965156763]),
        "crs": aoi.get("crs", "EPSG:32649"),
        "sourceStatus": release.get("terrain", {}).get("sourceStatus", "visual-ecology-package"),
        "nativeSurveyClaim": bool(release.get("terrain", {}).get("nativeSurveyClaim", False)),
        "assetBase": "assets/ecology/v0.3.1",
        "fieldTextures": [
            "field0-elevation-slope-forest-water.png",
            "field1-paddy-bund-rows-rock.png",
            "field2-wet-terrace-erosion-landuse.png",
        ],
        "treeBinary": "trees.bin",
        "shrubBinary": "shrubs.bin",
        "riceBinary": "rice.bin",
        "recordLayout": release.get("recordLayout", {
            "tree": {"stride": 12}, "shrub": {"stride": 10}, "rice": {"stride": 10}
        }),
        "renderPolicy": "近景聚焦至 60 平方公里时显示生态实例；不扩展为全图测绘植被数据",
    }


def refresh_landmarks_from_manifest(terrain: dict[str, Any]) -> None:
    if not terrain.get("ready") or not terrain.get("crs"):
        return
    height_path = Path(__file__).resolve().parents[1] / "site" / "public" / "terrain" / terrain["heightBinary"]
    samples = None
    if height_path.exists():
        import array
        samples = array.array("H")
        samples.frombytes(height_path.read_bytes())
    bounds = terrain["bounds"]
    width_m, height_m = terrain["widthMeters"], terrain["heightMeters"]
    xs, ys = transform("EPSG:4326", terrain["crs"], [item["longitude"] for item in LANDMARKS], [item["latitude"] for item in LANDMARKS])
    landmarks = []
    for item, x, y in zip(LANDMARKS, xs, ys):
        u = float(np.clip((x - bounds[0]) / width_m, 0.0, 1.0)) if np is not None else max(0.0, min(1.0, (x - bounds[0]) / width_m))
        v = float(np.clip((bounds[3] - y) / height_m, 0.0, 1.0)) if np is not None else max(0.0, min(1.0, (bounds[3] - y) / height_m))
        col = int(round(u * (terrain["gridWidth"] - 1)))
        row = int(round(v * (terrain["gridHeight"] - 1)))
        elevation = terrain["minimumElevation"]
        if samples is not None:
            elevation += samples[row * terrain["gridWidth"] + col] / 65535.0 * (terrain["maximumElevation"] - terrain["minimumElevation"])
        landmarks.append({**item, "projectedX": float(x), "projectedY": float(y), "gridU": u, "gridV": v, "elevationMeters": float(elevation)})
    terrain["landmarks"] = landmarks


def build_minimal_html(meta: dict[str, Any]) -> str:
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>桂林真实 DEM</title>
  <style>
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#020504;font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif}body{touch-action:none}
    .stage,#gl{position:absolute;inset:0;width:100%;height:100%;display:block}.stage{overflow:hidden;background:#020504}.labels{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
    .label{position:absolute;display:flex;align-items:center;gap:8px;transform:translate(-13px,-50%);filter:drop-shadow(0 6px 9px rgba(0,0,0,.85));will-change:left,top;pointer-events:auto;cursor:pointer}.label.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 13px),-50%)}
    .ring{width:25px;height:25px;border:3px solid var(--marker);border-radius:50%;background:rgba(2,5,4,.28);box-shadow:0 0 0 5px color-mix(in srgb,var(--marker) 22%,transparent),inset 0 0 9px color-mix(in srgb,var(--marker) 45%,transparent);position:relative;animation:marker-spin 2.8s linear infinite}@keyframes marker-spin{to{transform:rotate(360deg)}}.ring:after{content:"";position:absolute;left:50%;top:22px;width:2px;height:32px;background:linear-gradient(var(--marker),transparent);transform:translateX(-50%)}
    .name{padding:7px 11px;border:1px solid color-mix(in srgb,var(--marker) 55%,transparent);border-radius:999px;background:rgba(2,8,6,.80);backdrop-filter:blur(10px);color:#fff;font-size:13px;font-weight:750;white-space:nowrap}
    .reset{position:absolute;z-index:3;left:14px;top:14px;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:50%;background:rgba(3,10,7,.66);color:#fff;font-size:22px;cursor:pointer;backdrop-filter:blur(10px)}.reset:hover{border-color:#e7b760}.loading{position:absolute;inset:0;display:grid;place-items:center;color:transparent}
  </style>
</head>
<body>
  <main class="stage">
    <canvas id="gl" aria-label="桂林真实一比一垂直比例三维 DEM，可拖动旋转并用滚轮连续缩放"></canvas>
    <div id="labels" class="labels" aria-label="地形地标"></div>
    <button id="reset" class="reset" type="button" aria-label="重置视角" title="重置视角">↺</button>
    <div id="loading" class="loading" aria-live="polite">加载中</div>
  </main>
<script>
const META=__META_JSON__,canvas=document.querySelector('#gl'),labelLayer=document.querySelector('#labels');let renderer=null;
function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])}
class TerrainRenderer{
 constructor(canvas,meta,height,mask){this.canvas=canvas;this.meta=meta;this.height=height;this.mask=mask;this.yaw=.72;this.pitch=.62;this.distance=2.7;this.target=[0,.05,0];this.exaggeration=1;this.drag=false;this.ecology=null;this.init();this.initLabels();this.bind();this.resize();this.loadEcology();requestAnimationFrame(()=>this.draw())}
 reset(){this.yaw=.72;this.pitch=.62;this.distance=2.7;this.target=[0,.05,0]}
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s}
 program(vs,fs){const g=this.gl,p=g.createProgram();g.attachShader(p,this.shader(g.VERTEX_SHADER,vs));g.attachShader(p,this.shader(g.FRAGMENT_SHADER,fs));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(p));return p}
 sample(u,v){const w=this.meta.gridWidth,h=this.meta.gridHeight,c=Math.max(0,Math.min(w-1,Math.round(u*(w-1)))),r=Math.max(0,Math.min(h-1,Math.round(v*(h-1))));return this.height[r*w+c]/65535}
 point(u,v,lift=0){const n=this.sample(u,v);return[(u-.5)*2*this.meta.widthMeters/this.maxDim,n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+lift,(v-.5)*2*this.meta.heightMeters/this.maxDim]}
 init(){const g=this.gl=this.canvas.getContext('webgl2',{antialias:true});if(!g)throw new Error('WebGL2 unavailable');
  const tvs=`#version 300 es\nin vec3 p;in float h;uniform mat4 vp;out float vh;out vec3 wp;void main(){wp=p;vh=h;gl_Position=vp*vec4(p,1.);}`;
  const tfs=`#version 300 es\nprecision highp float;in float vh;in vec3 wp;out vec4 o;vec3 pal(float t){vec3 a=mix(vec3(.035,.12,.10),vec3(.20,.38,.19),smoothstep(0.,.38,t));vec3 b=mix(vec3(.20,.38,.19),vec3(.62,.50,.27),smoothstep(.32,.72,t));vec3 c=mix(b,vec3(.90,.88,.78),smoothstep(.68,1.,t));return mix(a,c,smoothstep(.28,.8,t));}void main(){vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-.4,.85,.25));float d=.28+.72*max(dot(n,l),0.);o=vec4(pal(vh)*(d+pow(1.-max(n.y,0.),2.)*.12),1.);}`;
  this.programTerrain=this.program(tvs,tfs);const w=this.meta.gridWidth,H=this.meta.gridHeight;this.maxDim=Math.max(this.meta.widthMeters,this.meta.heightMeters);const verts=new Float32Array(w*H*4);let k=0;for(let r=0;r<H;r++)for(let c=0;c<w;c++){const i=r*w+c,n=this.height[i]/65535,valid=this.mask[i]>0;verts[k++]=(c/(w-1)-.5)*2*this.meta.widthMeters/this.maxDim;verts[k++]=valid?n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2:0;verts[k++]=(r/(H-1)-.5)*2*this.meta.heightMeters/this.maxDim;verts[k++]=n}
  const step=innerWidth<700?4:innerWidth<1100?2:1,qr=Math.ceil((H-1)/step),qc=Math.ceil((w-1)/step),idx=new Uint32Array(qr*qc*6);let q=0;for(let r=0;r<H-1;r+=step){const r1=Math.min(r+step,H-1);for(let c=0;c<w-1;c+=step){const c1=Math.min(c+step,w-1),a=r*w+c,b=r*w+c1,d=r1*w+c,e=r1*w+c1;idx[q++]=a;idx[q++]=d;idx[q++]=b;idx[q++]=b;idx[q++]=d;idx[q++]=e}}this.count=q;
  const vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);const pl=g.getAttribLocation(this.programTerrain,'p'),hl=g.getAttribLocation(this.programTerrain,'h');g.enableVertexAttribArray(pl);g.vertexAttribPointer(pl,3,g.FLOAT,false,16,0);g.enableVertexAttribArray(hl);g.vertexAttribPointer(hl,1,g.FLOAT,false,16,12);const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,idx,g.STATIC_DRAW);this.vao=vao;this.vp=g.getUniformLocation(this.programTerrain,'vp');
  const rvs=`#version 300 es\nin vec3 p;uniform mat4 vp;void main(){gl_Position=vp*vec4(p,1.);}`,rfs=`#version 300 es\nprecision highp float;out vec4 o;void main(){o=vec4(.22,.72,1.,.86);}`;this.programRiver=this.program(rvs,rfs);const river=[];for(const line of this.meta.waterways||this.meta.rivers||[])for(let i=1;i<line.length;i++)river.push(...this.point(line[i-1].u,line[i-1].v,.006),...this.point(line[i].u,line[i].v,.006));this.riverCount=river.length/3;this.riverVao=g.createVertexArray();g.bindVertexArray(this.riverVao);const rb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,rb);g.bufferData(g.ARRAY_BUFFER,new Float32Array(river),g.STATIC_DRAW);const rp=g.getAttribLocation(this.programRiver,'p');g.enableVertexAttribArray(rp);g.vertexAttribPointer(rp,3,g.FLOAT,false,12,0);this.riverVp=g.getUniformLocation(this.programRiver,'vp');g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.cullFace(g.BACK);g.enable(g.BLEND);g.blendFunc(g.SRC_ALPHA,g.ONE_MINUS_SRC_ALPHA)}
 initLabels(){labelLayer.replaceChildren();this.labels=(this.meta.landmarks||[]).map(item=>{const el=document.createElement('div');el.className='label';el.style.setProperty('--marker',item.color||'#f2bd65');el.innerHTML=`<span class="ring"></span><span class="name">${item.name}</span>`;labelLayer.appendChild(el);let hold=null;const cancel=()=>{if(hold){clearTimeout(hold);hold=null}};el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cancel();hold=setTimeout(()=>{hold=null;this.focusRegion(item);navigator.vibrate?.(24)},500)});['pointerup','pointercancel','pointerleave'].forEach(type=>el.addEventListener(type,cancel));return{item,el}})}
 focusRegion(item){const region=(this.meta.fineRegions||[]).find(entry=>entry.id===item.id);if(!region?.centerProjected)return;const [x,y]=region.centerProjected,b=this.meta.bounds,u=(x-b[0])/this.meta.widthMeters,v=(b[3]-y)/this.meta.heightMeters;const n=this.sample(u,v),scale=Math.max(this.meta.widthMeters,this.meta.heightMeters);this.target=[(u-.5)*2*this.meta.widthMeters/scale,n*(this.meta.maximumElevation-this.meta.minimumElevation)/scale*2+.04,(v-.5)*2*this.meta.heightMeters/scale];this.distance=Math.max(.16,Math.min(.7,region.sideMeters/scale*3.1))}
 projectLabel(item,vp,lift){const x=(item.gridU-.5)*2*this.meta.widthMeters/this.maxDim,z=(item.gridV-.5)*2*this.meta.heightMeters/this.maxDim,n=(item.elevationMeters-this.meta.minimumElevation)/(this.meta.maximumElevation-this.meta.minimumElevation),y=n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+lift,cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];return{nx:cx/cw,ny:cy/cw,visible:cw>0&&cx/cw>-1.08&&cx/cw<1.08&&cy/cw>-1.08&&cy/cw<1.08}}
 updateLabels(vp){for(const {item,el} of this.labels){const p=this.projectLabel(item,vp,.045);el.hidden=!p.visible;if(p.visible){el.classList.toggle('flip',p.nx>.42);el.style.left=`${(p.nx*.5+.5)*this.canvas.clientWidth}px`;el.style.top=`${(-p.ny*.5+.5)*this.canvas.clientHeight}px`}}}
 async loadEcology(){const e=this.meta.ecology;if(!e?.ready)return;try{const base=e.assetBase;const [tb,sb,rb]=await Promise.all([fetch(`${base}/${e.treeBinary}`).then(r=>r.arrayBuffer()),fetch(`${base}/${e.shrubBinary}`).then(r=>r.arrayBuffer()),fetch(`${base}/${e.riceBinary}`).then(r=>r.arrayBuffer())]);const points=[];const add=(bytes,stride,kind,tree)=>{const dv=new DataView(bytes),count=Math.floor(bytes.byteLength/stride),center=e.centerProjected,side=e.sideMeters;for(let i=0;i<count;i++){const o=i*stride,qx=dv.getUint16(o,true),qz=dv.getUint16(o+2,true),localX=qx/65535*side-side/2,localZ=qz/65535*side-side/2,px=center[0]+localX,py=center[1]-localZ,u=(px-this.meta.bounds[0])/this.meta.widthMeters,v=(this.meta.bounds[3]-py)/this.meta.heightMeters;if(u<0||u>1||v<0||v>1)continue;const ground=this.sample(u,v)*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2+.008,size=tree?(.9+dv.getUint8(o+6)/255*2.3):(.55+dv.getUint8(o+6)/255*1.3);points.push((u-.5)*2*this.meta.widthMeters/this.maxDim,ground,(v-.5)*2*this.meta.heightMeters/this.maxDim,size,kind)}};add(tb,e.recordLayout.tree.stride,0,true);add(sb,e.recordLayout.shrub.stride,1,false);add(rb,e.recordLayout.rice.stride,2,false);const g=this.gl,vs=`#version 300 es\nin vec3 p;in float size;in float kind;uniform mat4 vp;uniform float zoom;out float vk;void main(){gl_Position=vp*vec4(p,1.);gl_PointSize=mix(1.2,6.5,zoom)*size;vk=kind;}`,fs=`#version 300 es\nprecision highp float;in float vk;uniform float zoom;out vec4 o;void main(){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;vec3 c=vk<.5?vec3(.12,.42,.16):vk<1.5?vec3(.32,.62,.22):vec3(.71,.77,.22);o=vec4(c,.62+.3*zoom);}`;this.programEcology=this.program(vs,fs);this.ecologyVao=g.createVertexArray();g.bindVertexArray(this.ecologyVao);const buffer=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,buffer);g.bufferData(g.ARRAY_BUFFER,new Float32Array(points),g.STATIC_DRAW);const pp=g.getAttribLocation(this.programEcology,'p'),ss=g.getAttribLocation(this.programEcology,'size'),kk=g.getAttribLocation(this.programEcology,'kind');g.enableVertexAttribArray(pp);g.vertexAttribPointer(pp,3,g.FLOAT,false,20,0);g.enableVertexAttribArray(ss);g.vertexAttribPointer(ss,1,g.FLOAT,false,20,12);g.enableVertexAttribArray(kk);g.vertexAttribPointer(kk,1,g.FLOAT,false,20,16);this.ecologyVp=g.getUniformLocation(this.programEcology,'vp');this.ecologyZoom=g.getUniformLocation(this.programEcology,'zoom');this.ecology={count:points.length/5}}catch(error){console.warn('ecology package unavailable',error)}}
 bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.x=e.clientX;this.y=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw+=(e.clientX-this.x)*.008;this.pitch=Math.max(.10,Math.min(1.45,this.pitch+(e.clientY-this.y)*.006));this.x=e.clientX;this.y=e.clientY});this.canvas.addEventListener('pointerup',()=>this.drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(.09,Math.min(6,this.distance*Math.exp(e.deltaY*.0013)))},{passive:false});window.addEventListener('resize',()=>this.resize())}
 resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(this.canvas.width!==Math.round(w*d)||this.canvas.height!==Math.round(h*d)){this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.gl.viewport(0,0,this.canvas.width,this.canvas.height)}}
 draw(){const g=this.gl;this.resize();g.clearColor(.006,.014,.012,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cp=Math.cos(this.pitch),eye=[this.target[0]+Math.sin(this.yaw)*cp*this.distance,this.target[1]+Math.sin(this.pitch)*this.distance+.12,this.target[2]+Math.cos(this.yaw)*cp*this.distance],vp=mul(perspective(.74,this.canvas.width/this.canvas.height,.002,30),lookAt(eye,this.target,[0,1,0]));g.useProgram(this.programTerrain);g.bindVertexArray(this.vao);g.uniformMatrix4fv(this.vp,false,vp);g.drawElements(g.TRIANGLES,this.count,g.UNSIGNED_INT,0);if(this.riverCount){g.useProgram(this.programRiver);g.bindVertexArray(this.riverVao);g.uniformMatrix4fv(this.riverVp,false,vp);g.lineWidth(2);g.drawArrays(g.LINES,0,this.riverCount)}if(this.ecology?.count&&this.distance<.72){g.useProgram(this.programEcology);g.bindVertexArray(this.ecologyVao);g.uniformMatrix4fv(this.ecologyVp,false,vp);g.uniform1f(this.ecologyZoom,Math.min(1,Math.max(0,(.72-this.distance)/.55)));g.drawArrays(g.POINTS,0,this.ecology.count)}this.updateLabels(vp);requestAnimationFrame(()=>this.draw())}
}
document.querySelector('#reset').onclick=()=>renderer?.reset();
(async()=>{try{const t=META.terrain,[hb,mb]=await Promise.all([fetch(t.heightBinary).then(r=>r.arrayBuffer()),fetch(t.maskBinary).then(r=>r.arrayBuffer())]);renderer=new TerrainRenderer(canvas,t,new Uint16Array(hb),new Uint8Array(mb));document.querySelector('#loading').remove()}catch(error){console.error(error)}})();
</script>
</body></html>'''
    return template.replace("__META_JSON__", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))


def build_html(meta: dict[str, Any], provisional_uri: str, preview_uri: str) -> str:
    template = r'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>桂林扩展 DEM 完整范围预览</title>
  <style>
    :root{color-scheme:dark;--bg:#07100e;--panel:rgba(14,27,23,.86);--line:rgba(188,221,202,.16);--text:#eef5f0;--muted:#9fb2a8;--accent:#e7b760;--good:#61c58d;--warn:#e99b61;--bad:#e27474}
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:radial-gradient(circle at 68% 0,#193226 0,#0b1612 31%,#050908 100%);font-family:Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--text)}
    body{overflow-x:hidden}.shell{max-width:1540px;margin:0 auto;padding:22px}.top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:end;margin-bottom:18px}
    .eyebrow{font-size:12px;letter-spacing:.18em;color:var(--accent);text-transform:uppercase}.title{font-size:clamp(28px,4vw,56px);line-height:1.04;margin:8px 0 10px;font-weight:760}.subtitle{color:var(--muted);max-width:900px;line-height:1.75}
    .badge{display:inline-flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid var(--line);border-radius:999px;background:rgba(255,255,255,.04);font-size:13px;white-space:nowrap}.dot{width:9px;height:9px;border-radius:50%;background:var(--warn);box-shadow:0 0 18px currentColor}.badge.good .dot{background:var(--good)}
    .grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px}.viewer{position:relative;min-height:720px;border:1px solid var(--line);border-radius:24px;overflow:hidden;background:#020504;box-shadow:0 24px 80px rgba(0,0,0,.32)}
    #gl,#flat{position:absolute;inset:0;width:100%;height:100%;display:block}#flat{object-fit:contain;background:#f5f4ef;padding:18px}.hidden{display:none!important}
    .landmarks{position:absolute;inset:0;z-index:4;pointer-events:none;overflow:hidden}.landmark{position:absolute;display:flex;align-items:center;gap:9px;transform:translate(-13px,-50%);will-change:transform,left,top;filter:drop-shadow(0 7px 10px rgba(0,0,0,.72))}.landmark.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 13px),-50%)}.landmark-ring{width:27px;height:27px;flex:0 0 auto;border:3px solid var(--marker);border-radius:50%;background:rgba(4,10,7,.25);box-shadow:0 0 0 5px color-mix(in srgb,var(--marker) 22%,transparent),inset 0 0 10px color-mix(in srgb,var(--marker) 40%,transparent);position:relative}.landmark-ring::after{content:"";position:absolute;left:50%;top:24px;width:2px;height:34px;background:linear-gradient(var(--marker),transparent);transform:translateX(-50%)}.landmark-label{padding:7px 10px;border:1px solid color-mix(in srgb,var(--marker) 58%,transparent);border-radius:999px;background:rgba(3,10,7,.82);backdrop-filter:blur(10px);font-size:13px;font-weight:750;white-space:nowrap;color:#fff}.landmark-label small{display:block;font-size:10px;font-weight:500;color:#b8c8bf;margin-top:2px}
    .toolbar{position:absolute;z-index:5;left:18px;top:18px;display:flex;flex-wrap:wrap;gap:8px}.btn{border:1px solid rgba(255,255,255,.16);background:rgba(5,12,9,.72);backdrop-filter:blur(14px);color:var(--text);padding:10px 13px;border-radius:12px;cursor:pointer;font:inherit}.btn:hover,.btn.active{border-color:rgba(231,183,96,.7);background:rgba(67,48,20,.54)}
    .hud{position:absolute;z-index:5;left:18px;right:18px;bottom:18px;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:end}.hud-card{max-width:680px;padding:15px 16px;border:1px solid var(--line);background:rgba(4,10,7,.74);backdrop-filter:blur(15px);border-radius:16px}.hud-title{font-weight:700;margin-bottom:6px}.hud-copy{font-size:13px;color:var(--muted);line-height:1.6}.control{display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line);background:rgba(4,10,7,.76);backdrop-filter:blur(15px);border-radius:14px;font-size:12px}.control input{width:150px}
    .side{display:flex;flex-direction:column;gap:14px}.card{border:1px solid var(--line);border-radius:18px;background:var(--panel);padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.18)}.card h2{margin:0 0 13px;font-size:15px}.metric{display:grid;grid-template-columns:1fr auto;gap:12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.075);font-size:13px}.metric:last-child{border-bottom:0}.metric span:first-child{color:var(--muted)}.metric strong{text-align:right;font-weight:650}
    .statusline{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.55;color:var(--muted);margin:11px 0}.statusline i{width:8px;height:8px;margin-top:6px;border-radius:50%;background:var(--good);flex:0 0 auto}.statusline.warn i{background:var(--warn)}.statusline.bad i{background:var(--bad)}
    .sources{font-size:12px;line-height:1.7;color:var(--muted);word-break:break-word}.footer{margin:18px 0 6px;color:#7f9288;font-size:12px;line-height:1.8}.empty{position:absolute;inset:0;display:grid;place-items:center;padding:40px;text-align:center;background:linear-gradient(155deg,#0c1c17,#050907)}.empty img{max-width:min(90%,760px);max-height:72vh;border-radius:18px;background:white}.empty h3{margin:18px 0 8px;font-size:21px}.empty p{margin:0;color:var(--muted);max-width:650px;line-height:1.8}
    @media(max-width:1080px){.grid{grid-template-columns:1fr}.side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.viewer{min-height:680px}}@media(max-width:700px){.shell{padding:12px}.top{grid-template-columns:1fr}.viewer{min-height:590px;border-radius:18px}.side{grid-template-columns:1fr}.hud{grid-template-columns:1fr}.control{justify-content:space-between}.toolbar{left:10px;top:10px}.hud{left:10px;right:10px;bottom:10px}.title{font-size:34px}}
  </style>
</head>
<body>
<div class="shell">
  <header class="top">
    <div><div class="eyebrow">DEM MAP PIPELINE · GUILIN</div><h1 class="title">桂林—全州扩展 DEM</h1><div class="subtitle">使用 9 张实际下载的约 30 米 DEM 源片连续拼接，范围从阳朔、平乐向北覆盖真宝鼎，并向东扩展至全州县城以东。网页不再使用插值补边。</div></div>
    <div id="statusBadge" class="badge"><span class="dot"></span><span id="statusText">读取状态</span></div>
  </header>
  <main class="grid">
    <section class="viewer">
      <canvas id="gl"></canvas>
      <img id="flat" class="hidden" alt="DEM 二维预览">
      <div id="landmarks" class="landmarks" aria-label="地形地标"></div>
      <div id="empty" class="empty hidden"><div><img id="scopeImage" alt="任务范围"><h3>云端 DEM 构建已经登记</h3><p>当前页面先显示任务范围。GitHub Actions 完成源片下载、拼接、裁切和质检后，这里会自动切换为可旋转的真实三维地形。</p></div></div>
      <div class="toolbar"><button class="btn active" data-view="3d">三维地形</button><button class="btn" data-view="2d">二维高程图</button><button class="btn" id="reset">重置视角</button></div>
      <div class="hud"><div class="hud-card"><div class="hud-title" id="hudTitle">2048 级真实 DEM 地形</div><div class="hud-copy" id="hudCopy">拖动旋转，滚轮缩放。圆圈标出真宝鼎、阳朔县城和秧塘机场旧址。</div></div><label class="control">垂直倍率 <input id="exaggeration" type="range" min="0.6" max="8" step="0.1" value="3.2"><strong id="exValue">3.2×</strong></label></div>
    </section>
    <aside class="side">
      <section class="card"><h2>范围</h2><div class="metric"><span>北端</span><strong id="north">读取中</strong></div><div class="metric"><span>南端</span><strong id="south">读取中</strong></div><div class="metric"><span>网页范围面积</span><strong id="area">读取中</strong></div><div class="metric"><span>目标坐标系</span><strong>EPSG:32649</strong></div></section>
      <section class="card"><h2>成果</h2><div class="metric"><span>当前数据源</span><strong id="source">读取中</strong></div><div class="metric"><span>输出像元</span><strong id="spacing">读取中</strong></div><div class="metric"><span>网页高度网格</span><strong id="gridResolution">读取中</strong></div><div class="metric"><span>连续覆盖</span><strong id="coverage">读取中</strong></div><div class="metric"><span>高程范围</span><strong id="elev">读取中</strong></div></section>
      <section class="card"><h2>构建状态</h2><div id="statusLines"></div></section>
      <section class="card"><h2>源片与谱系</h2><div id="sourceDetail" class="sources"></div></section>
    </aside>
  </main>
  <div class="footer">成果登记规则：当前网页使用 2048 级高度网格，全部来自实际下载并拼接的约 30 米 DEM；不使用外推或网页补边。ASF RTC 产品按“12.5 米输出像元参考 DEM”记录，不登记为原生 12.5 米测绘高程。</div>
</div>
<script>
const META=__META_JSON__;
const PROVISIONAL='__PROVISIONAL_DATA__';
const PREVIEW='__PREVIEW_DATA__';
const $=s=>document.querySelector(s);
const fmt=(n,d=2)=>Number.isFinite(Number(n))?Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d}):'待生成';
function setStatus(){
  const t=META.terrain||{}; const s=META.runtimeSource||{}; const ready=!!t.ready;
  $('#statusText').textContent=ready?(s.temporaryFallback?'临时完整范围图已生成':'ASF 完整范围图已生成'):'等待云端构建';
  $('#statusBadge').classList.toggle('good',ready&&!s.temporaryFallback);
  const wb=META.scope?.webContextBounds;
  $('#north').textContent=wb?`北纬 ${fmt(wb[3],2)}°（越过真宝鼎）`:`真宝鼎北 ${fmt(META.scope?.northExtensionMeters/1000,0)} km`;
  $('#south').textContent=wb?`北纬 ${fmt(wb[1],2)}°（阳朔—平乐南侧）`:'阳朔与平乐共享边界';
  $('#area').textContent=`${fmt(META.scope?.areaSquareKilometers,1)} km²`;
  $('#source').textContent=s.productLabel||'等待下载';
  $('#spacing').textContent=t.resolution?`${fmt(t.resolution[0],1)} m`:(s.outputPixelSpacingMeters?`${fmt(s.outputPixelSpacingMeters,1)} m`:'待生成');
  $('#gridResolution').textContent=t.ready?`${fmt(t.gridWidth,0)} × ${fmt(t.gridHeight,0)}（2048级）`:'待生成';
  $('#coverage').textContent=t.ready?`${fmt((t.validFraction||0)*100,3)}%`:'待质检';
  $('#elev').textContent=t.ready?`${fmt(t.minimumElevation,1)} 至 ${fmt(t.maximumElevation,1)} m`:'待生成';
  const lines=[];
  lines.push([META.boundaryExact?'good':'warn',META.boundaryExact?'阳朔平乐共享边界已精确解析':'当前仍使用离线范围预览']);
  lines.push([META.asfPlanCreated?'good':'warn',META.asfPlanCreated?`ASF 新增选片计划已生成，共 ${META.selectedProductCount||0} 项`:'ASF 选片计划等待云端检索']);
  lines.push([ready?'good':'warn',ready?'拼接、裁切、COG 与网页高度网格已生成':'真实 DEM 尚未生成']);
  lines.push([t.sourceCoverageType==='downloaded'?'good':'warn',`真实下载 DEM 覆盖 ${fmt((t.sourceValidFraction||0)*100,3)}%；未使用插值补边`]);
  if(t.landmarks?.length) lines.push(['good','真宝鼎、阳朔县城与秧塘机场旧址地标已校准']);
  if(s.temporaryFallback) lines.push(['warn','当前显示公开约30米临时完整范围图，ASF 下载完成后会替换']);
  $('#statusLines').innerHTML=lines.map(([c,x])=>`<div class="statusline ${c==='warn'?'warn':c==='bad'?'bad':''}"><i></i><span>${x}</span></div>`).join('');
  const detail=[];
  detail.push(`<b>模式</b>：${s.mode||'pending'}`);
  detail.push(`<b>提供方</b>：${s.provider||'等待数据'}`);
  if(META.existingResolvedCount!=null) detail.push(`<b>旧源片复用</b>：${META.existingResolvedCount}/5`);
  if(META.sourceFileCount!=null) detail.push(`<b>实际参与拼接</b>：${META.sourceFileCount} 张`);
  if(s.replacementPolicy) detail.push(`<b>替换规则</b>：${s.replacementPolicy}`);
  $('#sourceDetail').innerHTML=detail.join('<br>');
}
setStatus();
const canvas=$('#gl'),flat=$('#flat'),empty=$('#empty'),scopeImage=$('#scopeImage'),landmarkLayer=$('#landmarks');
flat.src=PREVIEW||PROVISIONAL; scopeImage.src=PROVISIONAL;
let renderer=null;
function showView(view){
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  landmarkLayer.classList.toggle('hidden',view!=='3d');
  if(view==='2d'){canvas.classList.add('hidden');empty.classList.add('hidden');flat.classList.remove('hidden');}
  else{flat.classList.add('hidden');if(META.terrain?.ready){canvas.classList.remove('hidden');empty.classList.add('hidden');renderer?.resize();}else{canvas.classList.add('hidden');empty.classList.remove('hidden');}}
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>showView(b.dataset.view));
$('#reset').onclick=()=>renderer?.reset();
const slider=$('#exaggeration');slider.oninput=()=>{ $('#exValue').textContent=`${Number(slider.value).toFixed(1)}×`; if(renderer) renderer.exaggeration=Number(slider.value); };

function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0])}
function lookAt(e,c,u){let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2],zl=Math.hypot(zx,zy,zz)||1;zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz)||1;xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1])}
class TerrainRenderer{
 constructor(canvas,meta,height,mask){this.canvas=canvas;this.meta=meta;this.height=height;this.mask=mask;this.yaw=.72;this.pitch=.68;this.distance=2.75;this.exaggeration=Number(slider.value);this.drag=false;this.init();this.initLabels();this.bind();this.resize();requestAnimationFrame(()=>this.draw())}
 reset(){this.yaw=.72;this.pitch=.68;this.distance=2.75}
 shader(type,src){const g=this.gl,s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s));return s}
 init(){const g=this.gl=this.canvas.getContext('webgl2',{antialias:true});if(!g)throw new Error('WebGL2 unavailable');
 const vs=`#version 300 es\nin vec3 p;in float h;uniform mat4 vp;uniform float ex;out float vh;out vec3 wp;void main(){vec3 q=vec3(p.x,p.y*ex,p.z);wp=q;vh=h;gl_Position=vp*vec4(q,1.);}`;
 const fs=`#version 300 es\nprecision highp float;in float vh;in vec3 wp;out vec4 o;vec3 pal(float t){vec3 a=mix(vec3(.035,.12,.10),vec3(.20,.38,.19),smoothstep(0.,.38,t));vec3 b=mix(vec3(.20,.38,.19),vec3(.62,.50,.27),smoothstep(.32,.72,t));vec3 c=mix(b,vec3(.90,.88,.78),smoothstep(.68,1.,t));return mix(a,c,smoothstep(.28,.8,t));}void main(){vec3 n=normalize(cross(dFdx(wp),dFdy(wp)));if(!gl_FrontFacing)n=-n;vec3 l=normalize(vec3(-.4,.85,.25));float d=.28+.72*max(dot(n,l),0.);float rim=pow(1.-max(n.y,0.),2.)*.12;vec3 col=pal(vh)*(d+rim);o=vec4(col,1.);}`;
 const pr=g.createProgram();g.attachShader(pr,this.shader(g.VERTEX_SHADER,vs));g.attachShader(pr,this.shader(g.FRAGMENT_SHADER,fs));g.linkProgram(pr);if(!g.getProgramParameter(pr,g.LINK_STATUS))throw new Error(g.getProgramInfoLog(pr));this.program=pr;
 const w=this.meta.gridWidth,H=this.meta.gridHeight,maxDim=Math.max(this.meta.widthMeters,this.meta.heightMeters),verts=new Float32Array(w*H*4);this.maxDim=maxDim;let k=0;for(let r=0;r<H;r++)for(let c=0;c<w;c++){const i=r*w+c,n=this.height[i]/65535,valid=this.mask[i]>0;verts[k++]=(c/(w-1)-.5)*2*this.meta.widthMeters/maxDim;verts[k++]=valid?n*(this.meta.maximumElevation-this.meta.minimumElevation)/maxDim*2:0;verts[k++]=(r/(H-1)-.5)*2*this.meta.heightMeters/maxDim;verts[k++]=n}
 const step=innerWidth<700?4:innerWidth<1100?2:1,quadRows=Math.ceil((H-1)/step),quadCols=Math.ceil((w-1)/step),idx=new Uint32Array(quadRows*quadCols*6);let q=0;for(let r=0;r<H-1;r+=step){const r1=Math.min(r+step,H-1);for(let c=0;c<w-1;c+=step){const c1=Math.min(c+step,w-1),a=r*w+c,b=r*w+c1,d=r1*w+c,e=r1*w+c1;idx[q++]=a;idx[q++]=d;idx[q++]=b;idx[q++]=b;idx[q++]=d;idx[q++]=e}}this.count=q;
 const vao=g.createVertexArray();g.bindVertexArray(vao);const vb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,vb);g.bufferData(g.ARRAY_BUFFER,verts,g.STATIC_DRAW);const pl=g.getAttribLocation(pr,'p'),hl=g.getAttribLocation(pr,'h');g.enableVertexAttribArray(pl);g.vertexAttribPointer(pl,3,g.FLOAT,false,16,0);g.enableVertexAttribArray(hl);g.vertexAttribPointer(hl,1,g.FLOAT,false,16,12);const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,idx,g.STATIC_DRAW);this.vao=vao;this.vp=g.getUniformLocation(pr,'vp');this.ex=g.getUniformLocation(pr,'ex');g.enable(g.DEPTH_TEST);g.enable(g.CULL_FACE);g.cullFace(g.BACK)}
 initLabels(){landmarkLayer.replaceChildren();this.landmarks=(this.meta.landmarks||[]).map(item=>{const el=document.createElement('div');el.className='landmark';el.style.setProperty('--marker',item.color||'#f2bd65');el.innerHTML=`<span class="landmark-ring"></span><span class="landmark-label">${item.name}<small>${item.longitude.toFixed(4)}° E · ${item.latitude.toFixed(4)}° N</small></span>`;landmarkLayer.appendChild(el);return{item,el}})}
 updateLabels(vp){for(const {item,el} of this.landmarks){const x=(item.gridU-.5)*2*this.meta.widthMeters/this.maxDim,z=(item.gridV-.5)*2*this.meta.heightMeters/this.maxDim,n=(item.elevationMeters-this.meta.minimumElevation)/(this.meta.maximumElevation-this.meta.minimumElevation),y=n*(this.meta.maximumElevation-this.meta.minimumElevation)/this.maxDim*2*this.exaggeration+.075;const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],cw=vp[3]*x+vp[7]*y+vp[11]*z+vp[15],nx=cx/cw,ny=cy/cw,visible=cw>0&&nx>-1.08&&nx<1.08&&ny>-1.08&&ny<1.08;el.hidden=!visible;if(visible){el.classList.toggle('flip',nx>.42);el.style.left=`${(nx*.5+.5)*this.canvas.clientWidth}px`;el.style.top=`${(-ny*.5+.5)*this.canvas.clientHeight}px`}}}
 bind(){this.canvas.addEventListener('pointerdown',e=>{this.drag=true;this.x=e.clientX;this.y=e.clientY;this.canvas.setPointerCapture(e.pointerId)});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;this.yaw+=(e.clientX-this.x)*.008;this.pitch=Math.max(.18,Math.min(1.35,this.pitch+(e.clientY-this.y)*.006));this.x=e.clientX;this.y=e.clientY});this.canvas.addEventListener('pointerup',()=>this.drag=false);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.distance=Math.max(1.15,Math.min(5,this.distance*Math.exp(e.deltaY*.001)))},{passive:false});window.addEventListener('resize',()=>this.resize())}
 resize(){const d=Math.min(devicePixelRatio||1,2),w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);if(this.canvas.width!==Math.round(w*d)||this.canvas.height!==Math.round(h*d)){this.canvas.width=Math.round(w*d);this.canvas.height=Math.round(h*d);this.gl?.viewport(0,0,this.canvas.width,this.canvas.height)}}
 draw(){const g=this.gl;this.resize();g.clearColor(.012,.025,.021,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);const cp=Math.cos(this.pitch),eye=[Math.sin(this.yaw)*cp*this.distance,Math.sin(this.pitch)*this.distance+.2,Math.cos(this.yaw)*cp*this.distance],vp=mul(perspective(.78,this.canvas.width/this.canvas.height,.01,20),lookAt(eye,[0,.06,0],[0,1,0]));g.useProgram(this.program);g.bindVertexArray(this.vao);g.uniformMatrix4fv(this.vp,false,vp);g.uniform1f(this.ex,this.exaggeration);g.drawElements(g.TRIANGLES,this.count,g.UNSIGNED_INT,0);this.updateLabels(vp);requestAnimationFrame(()=>this.draw())}
}
async function startTerrain(){if(!META.terrain?.ready){showView('3d');return}try{const [hb,mb]=await Promise.all([fetch(META.terrain.heightBinary).then(r=>r.arrayBuffer()),fetch(META.terrain.maskBinary).then(r=>r.arrayBuffer())]);renderer=new TerrainRenderer(canvas,META.terrain,new Uint16Array(hb),new Uint8Array(mb));showView('3d')}catch(e){console.error(e);showView('2d');$('#hudCopy').textContent='三维高度网格载入失败，已切换二维预览。'}}
startTerrain();
</script>
</body></html>'''
    return (
        template.replace("__META_JSON__", json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
        .replace("__PROVISIONAL_DATA__", provisional_uri)
        .replace("__PREVIEW_DATA__", preview_uri)
    )


def run(config_path: Path, root: Path, site: Path) -> int:
    config = read_json(config_path)
    site.mkdir(parents=True, exist_ok=True)
    assets = site / "assets"
    assets.mkdir(parents=True, exist_ok=True)

    provisional_json = assets / "AOI_PREVIEW_PROVISIONAL.json"
    provisional_png = assets / "AOI_PREVIEW_PROVISIONAL.png"
    resolved_path = root / config["outputs"]["resolvedAoiJson"]
    resolved = json_if_exists(resolved_path, json_if_exists(provisional_json, {}))
    runtime_source = json_if_exists(root / "metadata" / "runtime_source.json", {"mode": "pending", "productLabel": "等待云端下载", "temporaryFallback": False})
    qa = json_if_exists(root / config["outputs"]["qaReport"], {})
    plan = json_if_exists(root / config["outputs"]["downloadPlan"], {})
    existing = json_if_exists(root / config["outputs"]["existingResolved"], {})
    source_manifest = json_if_exists(root / config["outputs"]["sourceManifest"], {})

    context_output = config.get("webContext", {}).get("output")
    dem_path = root / context_output if context_output else root / config["outputs"]["finalDem"]
    terrain: dict[str, Any] = {"ready": False}
    preview_uri = ""
    if dem_path.exists():
        terrain = downsample_height(dem_path, assets)
        attach_waterways(terrain, root / "metadata" / "waterways_osm.geojson")
        if not terrain.get("waterways"):
            attach_lijiang(terrain, root / "metadata" / "lijiang_osm.geojson")
        terrain["verticalScale"] = 1.0
        terrain["fineRegions"] = json_if_exists(root / "metadata" / "fine_regions_1m_plan.json", {}).get("regions", [])
        attach_ecology(terrain, root / "metadata" / "ecology" / "v0.3.1", assets)
        terrain["manifestUrl"] = "assets/terrain-manifest.json"
        write_json(assets / "terrain-manifest.json", terrain)
        preview_uri = "assets/DEM_PREVIEW.png"

    scope = {
        "northExtensionMeters": float(config.get("aoi", {}).get("northExtensionMeters", 15000)),
        "areaSquareKilometers": (
            terrain.get("widthMeters", 0) * terrain.get("heightMeters", 0) / 1_000_000
            if context_output and terrain.get("ready")
            else resolved.get("final", {}).get("areaSquareKilometersProjected")
        ),
        "bounds": config.get("webContext", {}).get("boundsWgs84", resolved.get("final", {}).get("bounds")),
        "webContextBounds": config.get("webContext", {}).get("boundsWgs84"),
    }
    selected = plan.get("selectedNewProducts", []) if isinstance(plan, dict) else []
    source_files = qa.get("sourceLineage", {}).get("files", []) if isinstance(qa, dict) else []
    cloud_status = json_if_exists(root / "reports" / "CLOUD_RUN_STATUS.json", {})
    meta = {
        "generatedAt": utc_now(),
        "project": config["project"],
        "scope": scope,
        "boundaryExact": resolved.get("status") == "exact_boundary_resolved",
        "runtimeSource": runtime_source,
        "terrain": terrain,
        "asfPlanCreated": bool(selected) or bool(cloud_status.get("asfPlanCreated")),
        "selectedProductCount": len(selected),
        "existingResolvedCount": int(existing.get("resolvedCount", 0) or 0),
        "sourceFileCount": (
            len(source_manifest.get("tiles", []))
            if context_output and isinstance(source_manifest, dict)
            else len(source_files) if source_files
            else len(source_manifest.get("tiles", [])) if isinstance(source_manifest, dict) else 0
        ),
        "qaStatus": qa.get("status"),
    }
    write_json(site / "status.json", meta)
    provisional_uri = "assets/AOI_PREVIEW_PROVISIONAL.png" if provisional_png.exists() else ""
    html = build_minimal_html(meta)
    (site / "index.html").write_text(html, encoding="utf-8")
    print(f"网页预览：{site / 'index.html'}")
    return 0


def run_from_manifest(manifest_path: Path, status_path: Path, root: Path, site: Path) -> int:
    """Refresh overlays and HTML when rasterio/numpy are unavailable but the raster package is intact."""
    site.mkdir(parents=True, exist_ok=True)
    assets = site / "assets"
    assets.mkdir(parents=True, exist_ok=True)
    terrain = read_json(manifest_path)
    refresh_landmarks_from_manifest(terrain)
    attach_waterways(terrain, root / "metadata" / "waterways_osm.geojson")
    if not terrain.get("waterways"):
        attach_lijiang(terrain, root / "metadata" / "lijiang_osm.geojson")
    terrain["verticalScale"] = 1.0
    terrain["fineRegions"] = json_if_exists(root / "metadata" / "fine_regions_1m_plan.json", {}).get("regions", [])
    attach_ecology(terrain, root / "metadata" / "ecology" / "v0.3.1", assets)
    write_json(manifest_path, terrain)
    meta = json_if_exists(status_path, {})
    meta["generatedAt"] = utc_now()
    meta["terrain"] = terrain
    meta["waterwayCount"] = terrain.get("waterwayCount", 0)
    meta["ecology"] = terrain.get("ecology", {})
    write_json(status_path, meta)
    (site / "index.html").write_text(build_minimal_html(meta), encoding="utf-8")
    print(f"网页预览：{site / 'index.html'}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the self-contained DEM web preview")
    parser.add_argument("--config", required=True)
    parser.add_argument("--root", required=True)
    parser.add_argument("--site", required=True)
    parser.add_argument("--from-manifest")
    parser.add_argument("--status")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        if args.from_manifest:
            status = Path(args.status).resolve() if args.status else Path(args.site).resolve() / "status.json"
            return run_from_manifest(Path(args.from_manifest).resolve(), status, Path(args.root).resolve(), Path(args.site).resolve())
        return run(Path(args.config).resolve(), Path(args.root).resolve(), Path(args.site).resolve())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
