from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one replacement, got {count}")
    return updated


PIPELINE_BLOCK = r'''
MAJOR_MAINSTEM_PATTERNS = {
    1: ("漓江", "漓水", "li river", "li jiang", "lijiang river", "li-jiang"),
    2: ("湘江", "湘水", "xiang river", "xiang jiang", "xiangjiang"),
    3: ("资江", "資江", "资水", "資水", "zi river", "zi jiang", "zijiang", "zi shui", "zishui"),
}
MAJOR_MAINSTEM_KEYS = {1: "li", 2: "xiang", 3: "zi"}
MAJOR_MAINSTEM_MIN_METRIC = {1: 150.0, 2: 175.0, 3: 160.0}


def feature_name_blob(properties: dict[str, Any]) -> str:
    values: list[str] = []
    for key, value in properties.items():
        lowered = str(key).lower()
        if lowered == "name" or lowered.startswith("name:") or lowered in {
            "alt_name", "official_name", "short_name", "local_name", "old_name",
            "name_zh", "name_en", "river_name",
        }:
            if value not in (None, ""):
                values.append(str(value))
    return " | ".join(values).lower()


def mainstem_code(properties: dict[str, Any]) -> int:
    text = feature_name_blob(properties)
    for code, patterns in MAJOR_MAINSTEM_PATTERNS.items():
        if any(pattern.lower() in text for pattern in patterns):
            return code
    marker = str(properties.get("mainstem") or properties.get("is_mainstem") or "").strip().lower()
    system = str(properties.get("system") or "").strip().lower()
    if marker in {"1", "true", "yes", "main", "mainstem"}:
        if system in {"li", "lijiang", "li-jiang"}:
            return 1
        if system in {"xiang", "xiangjiang", "xiang-jiang"}:
            return 2
        if system in {"zi", "zijiang", "zi-jiang", "zishui"}:
            return 3
    return 0


def node_rank(key: tuple[float, float], nodes: dict[tuple[float, float], dict[str, Any]]) -> tuple[float, float, float]:
    record = nodes[key]
    return float(record["elevation"]), float(key[1]), float(key[0])


def style_metric(waterway: str, source_width_m: float, flow_quantile: float, major_code: int) -> float:
    q = float(np.clip(flow_quantile, 0.0, 1.0))
    if major_code:
        minimum = MAJOR_MAINSTEM_MIN_METRIC[major_code]
        return float(np.clip(max(minimum, 112.0 + 92.0 * q + 0.28 * source_width_m), minimum, 230.0))
    if waterway == "river":
        return float(np.clip(5.0 + 72.0 * q ** 1.55 + 0.16 * source_width_m, 5.0, 92.0))
    if waterway == "stream":
        return float(np.clip(1.5 + 15.5 * q ** 1.55 + 0.05 * source_width_m, 1.5, 20.0))
    return float(np.clip(2.0 + 16.0 * q ** 1.35 + 0.07 * source_width_m, 2.0, 22.0))


def build_hydrology(
    dataset: rasterio.io.DatasetReader,
    native_manifest: dict[str, Any],
    hydrology_path: Path,
    output_dir: Path,
) -> dict[str, Any]:
    collection = json.loads(hydrology_path.read_text(encoding="utf-8"))
    if collection.get("type") != "FeatureCollection":
        raise RuntimeError("hydrology source must be a FeatureCollection")

    source_sha = sha256_file(hydrology_path)
    bounds = [float(value) for value in native_manifest["aoi"]["native_sample_center_bounds_epsg32649"]]
    west, south, east, north = bounds
    world_center_e = (west + east) * 0.5
    world_center_n = (south + north) * 0.5
    domain = box(west, south, east, north)
    transformer = Transformer.from_crs("EPSG:4326", SOURCE_CRS, always_xy=True)

    node_records: dict[tuple[float, float], dict[str, Any]] = {}
    raw_segments: list[dict[str, Any]] = []
    record_counts = {"river": 0, "stream": 0, "canal": 0}
    mainstem_feature_counts = {"li": 0, "xiang": 0, "zi": 0}
    source_feature_count = 0
    rendered_feature_count = 0
    clipped_part_count = 0
    named_rivers_seen: set[str] = set()

    for feature_index, feature in enumerate(collection.get("features", [])):
        properties = feature.get("properties") or {}
        waterway = str(properties.get("waterway") or "").strip().lower()
        if waterway not in ALLOWED_WATERWAYS:
            continue
        source_feature_count += 1
        class_value = ALLOWED_WATERWAYS[waterway]
        source_width = parse_width(properties, waterway)
        major_code = mainstem_code(properties) if waterway == "river" else 0
        name_blob = feature_name_blob(properties)
        if waterway == "river" and name_blob:
            named_rivers_seen.add(name_blob[:160])
        feature_rendered = False
        for line in projected_line_parts(feature, transformer, domain):
            coordinates = list(line.coords)
            if len(coordinates) < 2:
                continue
            part_rendered = False
            for start, end in zip(coordinates[:-1], coordinates[1:]):
                start_key = (round(float(start[0]), 3), round(float(start[1]), 3))
                end_key = (round(float(end[0]), 3), round(float(end[1]), 3))
                if start_key == end_key:
                    continue
                raw_segments.append({
                    "feature_index": feature_index,
                    "start": start_key,
                    "end": end_key,
                    "waterway": waterway,
                    "class": class_value,
                    "source_width_m": source_width,
                    "major_code": major_code,
                })
                for key in (start_key, end_key):
                    if key not in node_records:
                        node_records[key] = {"e": key[0], "n": key[1]}
                part_rendered = True
            if part_rendered:
                clipped_part_count += 1
                feature_rendered = True
        if feature_rendered:
            rendered_feature_count += 1
            record_counts[waterway] += 1
            if major_code:
                mainstem_feature_counts[MAJOR_MAINSTEM_KEYS[major_code]] += 1

    if not raw_segments or not node_records:
        raise RuntimeError("no OSM linear waterways were rendered")

    ordered_keys = list(node_records.keys())
    coordinates = [(node_records[key]["e"], node_records[key]["n"]) for key in ordered_keys]
    valid_node_data: dict[tuple[float, float], dict[str, Any]] = {}
    missing_keys: list[tuple[float, float]] = []
    for key, sample in zip(ordered_keys, dataset.sample(coordinates, indexes=1, masked=True), strict=True):
        raw = sample[0]
        if np.ma.is_masked(raw):
            missing_keys.append(key)
            continue
        elevation = float(raw)
        if not math.isfinite(elevation) or elevation == SOURCE_NODATA:
            missing_keys.append(key)
            continue
        valid_node_data[key] = {"e": key[0], "n": key[1], "elevation": elevation}

    fallback_node_count = 0
    fallback_max_distance_m = 0.0
    unresolved_keys: list[tuple[float, float]] = []
    for key in missing_keys:
        fallback = nearest_valid_native_elevation(dataset, key[0], key[1])
        if fallback is None:
            unresolved_keys.append(key)
            continue
        elevation, distance_m = fallback
        valid_node_data[key] = {
            "e": key[0], "n": key[1], "elevation": elevation,
            "display_elevation_fallback": True,
            "display_elevation_fallback_distance_m": distance_m,
        }
        fallback_node_count += 1
        fallback_max_distance_m = max(fallback_max_distance_m, distance_m)

    if unresolved_keys:
        raise RuntimeError(f"unable to drape {len(unresolved_keys)} waterway nodes onto the native DEM")

    outgoing: dict[tuple[float, float], list[int]] = {}
    adjacent: dict[tuple[float, float], list[int]] = {}
    directed_edges: list[dict[str, Any]] = []
    for source in raw_segments:
        start_key = source["start"]
        end_key = source["end"]
        start_rank = node_rank(start_key, valid_node_data)
        end_rank = node_rank(end_key, valid_node_data)
        if start_rank >= end_rank:
            upstream, downstream = start_key, end_key
        else:
            upstream, downstream = end_key, start_key
        length_m = float(math.hypot(downstream[0] - upstream[0], downstream[1] - upstream[1]))
        edge = dict(source)
        edge.update({"upstream": upstream, "downstream": downstream, "length_m": max(length_m, 0.01), "flow_length_m": 0.0})
        edge_index = len(directed_edges)
        directed_edges.append(edge)
        outgoing.setdefault(upstream, []).append(edge_index)
        adjacent.setdefault(start_key, []).append(edge_index)
        adjacent.setdefault(end_key, []).append(edge_index)

    accumulated = {key: 0.0 for key in valid_node_data}
    for key in sorted(valid_node_data, key=lambda item: node_rank(item, valid_node_data), reverse=True):
        edge_indices = outgoing.get(key, [])
        if not edge_indices:
            continue
        shared_upstream = accumulated[key] / max(1, len(edge_indices))
        for edge_index in edge_indices:
            edge = directed_edges[edge_index]
            flow_length = shared_upstream + edge["length_m"]
            edge["flow_length_m"] = flow_length
            accumulated[edge["downstream"]] += flow_length

    log_flow = np.log1p(np.asarray([edge["flow_length_m"] for edge in directed_edges], dtype=np.float64))
    low = float(np.percentile(log_flow, 5.0))
    high = float(np.percentile(log_flow, 99.5))
    span = max(1e-9, high - low)
    for edge, value in zip(directed_edges, log_flow, strict=True):
        edge["flow_quantile"] = float(np.clip((float(value) - low) / span, 0.0, 1.0))

    # Extend named main-stem styling across short unnamed OSM way breaks. This changes style only.
    # Centerline coordinates and segment membership remain untouched.
    queue: list[int] = [index for index, edge in enumerate(directed_edges) if edge["major_code"]]
    visited = set(queue)
    while queue:
        current_index = queue.pop(0)
        current = directed_edges[current_index]
        major_code = int(current["major_code"])
        for node in (current["upstream"], current["downstream"]):
            candidates = [
                index for index in adjacent.get(node, [])
                if index not in visited
                and directed_edges[index]["waterway"] == "river"
                and not directed_edges[index]["major_code"]
            ]
            if not candidates:
                continue
            candidates.sort(key=lambda index: (
                directed_edges[index]["flow_quantile"],
                directed_edges[index]["source_width_m"],
                directed_edges[index]["length_m"],
            ), reverse=True)
            chosen = candidates[0]
            candidate = directed_edges[chosen]
            if candidate["flow_quantile"] < 0.72 and candidate["source_width_m"] < 30.0:
                continue
            candidate["major_code"] = major_code
            candidate["mainstem_style_propagated"] = True
            visited.add(chosen)
            queue.append(chosen)

    mainstem_segment_counts = {"li": 0, "xiang": 0, "zi": 0}
    segment_values: list[float] = []
    used_keys: set[tuple[float, float]] = set()
    node_style: dict[tuple[float, float], dict[str, float]] = {}
    for edge in directed_edges:
        major_code = int(edge["major_code"])
        metric = style_metric(edge["waterway"], float(edge["source_width_m"]), float(edge["flow_quantile"]), major_code)
        edge["display_hierarchy_metric"] = metric
        if major_code:
            mainstem_segment_counts[MAJOR_MAINSTEM_KEYS[major_code]] += 1
        start_key = edge["upstream"]
        end_key = edge["downstream"]
        start = valid_node_data[start_key]
        end = valid_node_data[end_key]
        segment_values.extend((
            float(start["e"] - world_center_e),
            float(start["elevation"]),
            float(world_center_n - start["n"]),
            float(end["e"] - world_center_e),
            float(end["elevation"]),
            float(world_center_n - end["n"]),
            float(edge["class"]),
            metric,
        ))
        for key in (start_key, end_key):
            existing = node_style.get(key)
            if existing is None:
                node_style[key] = {"class": float(edge["class"]), "metric": metric}
            else:
                existing["class"] = min(existing["class"], float(edge["class"]))
                existing["metric"] = max(existing["metric"], metric)
        used_keys.add(start_key)
        used_keys.add(end_key)

    missing_mainstems = [name for name, count in mainstem_segment_counts.items() if count <= 0]
    if missing_mainstems:
        examples = sorted(named_rivers_seen)[:80]
        raise RuntimeError(f"missing named main-stem systems {missing_mainstems}; named rivers seen: {examples}")

    node_values: list[float] = []
    for key in sorted(used_keys):
        record = valid_node_data[key]
        style = node_style[key]
        node_values.extend((
            float(record["e"] - world_center_e),
            float(record["elevation"]),
            float(world_center_n - record["n"]),
            float(style["class"]),
            float(style["metric"]),
        ))

    source_segment_count = len(raw_segments)
    valid_segment_count = len(directed_edges)
    dropped_segment_count = source_segment_count - valid_segment_count
    if dropped_segment_count != 0:
        raise RuntimeError(f"waterway segment loss: {dropped_segment_count}")

    segment_output = output_dir / "osm-waterway-segments.f32.bin"
    node_output = output_dir / "osm-waterway-nodes.f32.bin"
    np.asarray(segment_values, dtype="<f4").tofile(segment_output)
    np.asarray(node_values, dtype="<f4").tofile(node_output)

    return {
        "schema": "guilin-osm-linear-waterways-render-asset/v1",
        "status": "review_asset",
        "source": {
            "file": hydrology_path.name,
            "bytes": hydrology_path.stat().st_size,
            "sha256": source_sha,
            "source_crs": "EPSG:4326",
            "render_crs": SOURCE_CRS,
            "centerline_coordinates_mutated": False,
            "manual_centerline_added": False,
            "synthetic_gap_line_added": False,
            "projection_only": True,
            "aoi_boundary_clipping_only": True,
            "display_elevation_fallback_changes_planimetry": False,
            "display_elevation_fallback_changes_source_dem": False,
        },
        "filter": {
            "allowed_waterways": ["river", "stream", "canal"],
            "polygon_waterbodies_allowed": False,
            "reservoir_relations_allowed": False,
            "lake_surface_asset_emitted": False,
            "reservoir_surface_asset_emitted": False,
            "synthetic_surface_asset_emitted": False,
        },
        "topology": {
            "record_counts": record_counts,
            "record_count_total": int(sum(record_counts.values())),
            "source_feature_count": source_feature_count,
            "rendered_feature_count": rendered_feature_count,
            "clipped_part_count": clipped_part_count,
            "source_segment_count": source_segment_count,
            "segment_count": valid_segment_count,
            "dropped_segment_count": dropped_segment_count,
            "unresolved_node_count": 0,
            "display_elevation_fallback_node_count": fallback_node_count,
            "display_elevation_fallback_max_distance_m": fallback_max_distance_m,
            "display_elevation_fallback_method": "nearest-valid-native-dem-cell",
            "node_count": len(node_values) // 5,
            "source_route_coverage": 1.0,
            "upstream_to_downstream_continuity_required": True,
        },
        "styling": {
            "profile": "basin-hierarchy-mainstem-gradient-v3",
            "mainstem_names": ["漓江", "湘江", "资江"],
            "mainstem_feature_counts": mainstem_feature_counts,
            "mainstem_segment_counts": mainstem_segment_counts,
            "hierarchy_metric": "DEM-downhill accumulated upstream network length with source-width support",
            "gradient_direction": "lighter-and-thinner-upstream_to_darker-and-wider-downstream",
            "mainstem_minimum_metrics": {MAJOR_MAINSTEM_KEYS[key]: value for key, value in MAJOR_MAINSTEM_MIN_METRIC.items()},
            "style_only_mainstem_gap_propagation": True,
            "planimetry_unchanged": True,
        },
        "segments": {
            "file": segment_output.name,
            "bytes": segment_output.stat().st_size,
            "sha256": sha256_file(segment_output),
            "dtype": "float32-little-endian",
            "layout": ["start_x", "start_elevation", "start_z", "end_x", "end_elevation", "end_z", "class", "display_hierarchy_metric"],
            "count": valid_segment_count,
            "compression": "none",
        },
        "nodes": {
            "file": node_output.name,
            "bytes": node_output.stat().st_size,
            "sha256": sha256_file(node_output),
            "dtype": "float32-little-endian",
            "layout": ["x", "elevation", "z", "class", "display_hierarchy_metric"],
            "count": len(node_values) // 5,
            "compression": "none",
        },
    }
'''.strip("\n")


SHADER_BLOCK = r'''  const SEGMENT_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aStart;
layout(location=2) in vec3 aEnd;
layout(location=3) in float aClass;
layout(location=4) in float aHierarchy;
uniform mat4 uViewProjection;
uniform vec2 uViewport;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vTone;
out float vMainstem;
out float vAcross;
float hierarchyTone(float classValue,float metric){
  if(classValue<0.5)return smoothstep(5.0,92.0,metric);
  if(classValue<1.5)return smoothstep(1.5,20.0,metric);
  return smoothstep(2.0,22.0,metric);
}
float halfWidthPixels(float classValue,float metric){
  float tone=hierarchyTone(classValue,metric);
  float mainstem=step(120.0,metric);
  float riverHalf=mix(0.25,0.72,tone);
  float streamHalf=mix(0.11,0.34,tone);
  float canalHalf=mix(0.13,0.38,tone);
  float ordinary=classValue<0.5?riverHalf:(classValue<1.5?streamHalf:canalHalf);
  float mainHalf=mix(1.80,2.18,smoothstep(145.0,220.0,metric));
  float cssHalf=mix(ordinary,mainHalf,mainstem);
  return max(0.10*uPixelRatio,cssHalf*uEmphasis*uZoomScale*uPixelRatio);
}
void main(){
  vec3 startPosition=vec3(aStart.x,aStart.y-uVerticalOrigin+uSurfaceOffset,aStart.z);
  vec3 endPosition=vec3(aEnd.x,aEnd.y-uVerticalOrigin+uSurfaceOffset,aEnd.z);
  vec4 clipStart=uViewProjection*vec4(startPosition,1.0);
  vec4 clipEnd=uViewProjection*vec4(endPosition,1.0);
  vClass=aClass;
  vTone=hierarchyTone(aClass,aHierarchy);
  vMainstem=step(120.0,aHierarchy);
  vAcross=aCorner.y;
  if(clipStart.w<=0.0||clipEnd.w<=0.0){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
  vec2 ndcStart=clipStart.xy/max(0.00001,clipStart.w);
  vec2 ndcEnd=clipEnd.xy/max(0.00001,clipEnd.w);
  vec2 pixelDelta=(ndcEnd-ndcStart)*uViewport*0.5;
  float pixelLength=max(length(pixelDelta),0.001);
  vec2 direction=pixelDelta/pixelLength;
  vec2 perpendicular=vec2(-direction.y,direction.x);
  float halfWidth=halfWidthPixels(aClass,aHierarchy);
  float overlap=halfWidth+0.28*uPixelRatio;
  vec4 clipPosition=mix(clipStart,clipEnd,aCorner.x);
  vec2 pixelOffset=perpendicular*aCorner.y*halfWidth+direction*mix(-overlap,overlap,aCorner.x);
  clipPosition.xy+=pixelOffset*2.0/uViewport*clipPosition.w;
  gl_Position=clipPosition;
}`;

  const SEGMENT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vClass;
in float vTone;
in float vMainstem;
in float vAcross;
out vec4 outColor;
void main(){
  float edge=abs(vAcross);
  float aa=max(fwidth(edge)*1.25,0.02);
  float coverage=1.0-smoothstep(1.0-aa,1.0,edge);
  vec3 mainstem=vec3(0.025,0.245,0.43);
  vec3 riverUp=vec3(0.30,0.66,0.72);
  vec3 riverDown=vec3(0.055,0.35,0.57);
  vec3 streamUp=vec3(0.50,0.76,0.79);
  vec3 streamDown=vec3(0.16,0.52,0.65);
  vec3 canalUp=vec3(0.36,0.61,0.66);
  vec3 canalDown=vec3(0.12,0.42,0.55);
  vec3 ordinary=vClass<0.5?mix(riverUp,riverDown,vTone):(vClass<1.5?mix(streamUp,streamDown,vTone):mix(canalUp,canalDown,vTone));
  vec3 color=mix(ordinary,mainstem,vMainstem);
  float ordinaryAlpha=vClass<0.5?mix(0.52,0.82,vTone):(vClass<1.5?mix(0.25,0.58,vTone):mix(0.34,0.62,vTone));
  float alpha=mix(ordinaryAlpha,0.94,vMainstem);
  outColor=vec4(color,coverage*alpha);
}`;

  const NODE_VERTEX_SHADER = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aClass;
layout(location=2) in float aHierarchy;
layout(location=3) in float aDegree;
uniform mat4 uViewProjection;
uniform float uVerticalOrigin;
uniform float uEmphasis;
uniform float uZoomScale;
uniform float uPixelRatio;
uniform float uSurfaceOffset;
out float vClass;
out float vTone;
out float vMainstem;
float hierarchyTone(float classValue,float metric){
  if(classValue<0.5)return smoothstep(5.0,92.0,metric);
  if(classValue<1.5)return smoothstep(1.5,20.0,metric);
  return smoothstep(2.0,22.0,metric);
}
float halfWidthPixels(float classValue,float metric){
  float tone=hierarchyTone(classValue,metric);
  float mainstem=step(120.0,metric);
  float riverHalf=mix(0.25,0.72,tone);
  float streamHalf=mix(0.11,0.34,tone);
  float canalHalf=mix(0.13,0.38,tone);
  float ordinary=classValue<0.5?riverHalf:(classValue<1.5?streamHalf:canalHalf);
  float mainHalf=mix(1.80,2.18,smoothstep(145.0,220.0,metric));
  return max(0.10*uPixelRatio,mix(ordinary,mainHalf,mainstem)*uEmphasis*uZoomScale*uPixelRatio);
}
void main(){
  vec3 position=vec3(aPosition.x,aPosition.y-uVerticalOrigin+uSurfaceOffset+0.04,aPosition.z);
  gl_Position=uViewProjection*vec4(position,1.0);
  float halfWidth=halfWidthPixels(aClass,aHierarchy);
  float multiplier=aDegree>2.5?2.35:(aDegree>1.5?2.20:1.82);
  gl_PointSize=max(0.72*uPixelRatio,halfWidth*multiplier+0.22*uPixelRatio);
  vClass=aClass;
  vTone=hierarchyTone(aClass,aHierarchy);
  vMainstem=step(120.0,aHierarchy);
}`;

  const NODE_FRAGMENT_SHADER = `#version 300 es
precision highp float;
in float vClass;
in float vTone;
in float vMainstem;
out vec4 outColor;
void main(){
  vec2 q=gl_PointCoord*2.0-1.0;
  float radius=length(q);
  float aa=max(fwidth(radius)*1.35,0.025);
  float coverage=1.0-smoothstep(1.0-aa,1.0,radius);
  if(coverage<=0.0)discard;
  vec3 mainstem=vec3(0.025,0.245,0.43);
  vec3 river=mix(vec3(0.30,0.66,0.72),vec3(0.055,0.35,0.57),vTone);
  vec3 stream=mix(vec3(0.50,0.76,0.79),vec3(0.16,0.52,0.65),vTone);
  vec3 canal=mix(vec3(0.36,0.61,0.66),vec3(0.12,0.42,0.55),vTone);
  vec3 ordinary=vClass<0.5?river:(vClass<1.5?stream:canal);
  vec3 color=mix(ordinary,mainstem,vMainstem);
  float ordinaryAlpha=vClass<0.5?mix(0.52,0.82,vTone):(vClass<1.5?mix(0.25,0.58,vTone):mix(0.34,0.62,vTone));
  outColor=vec4(color,coverage*mix(ordinaryAlpha,0.94,vMainstem));
}`;

  function assert(condition, message) {'''


STYLE_FUNCTIONS = r'''  function waterwayZoomScale() {
    const span = Math.max(state.worldWidth, state.worldDepth, 1);
    const ratio = span / Math.max(1, state.camera.distance);
    return clamp(Math.pow(ratio, 0.28), 0.85, 2.15);
  }

  function waterwayHierarchyTone(classIndex, hierarchyMetric) {
    if (classIndex === 0) return smoothstep(5, 92, hierarchyMetric);
    if (classIndex === 1) return smoothstep(1.5, 20, hierarchyMetric);
    return smoothstep(2, 22, hierarchyMetric);
  }

  function waterwayHalfWidthCssPx(classIndex, hierarchyMetric) {
    const tone = waterwayHierarchyTone(classIndex, hierarchyMetric);
    const mainstem = hierarchyMetric >= 120;
    const ordinary = classIndex === 0
      ? 0.25 + (0.72 - 0.25) * tone
      : classIndex === 1
        ? 0.11 + (0.34 - 0.11) * tone
        : 0.13 + (0.38 - 0.13) * tone;
    const main = 1.80 + (2.18 - 1.80) * smoothstep(145, 220, hierarchyMetric);
    return Math.max(0.10, (mainstem ? main : ordinary) * state.waterwayEmphasis * waterwayZoomScale());
  }

  function waterwayStyleMetrics() {
    const riverMetric = Math.min(92, Math.max(5, state.maxSourceWidthByClass[0] || 5));
    const streamMetric = Math.min(20, Math.max(1.5, state.maxSourceWidthByClass[1] || 1.5));
    const canalMetric = Math.min(22, Math.max(2, state.maxSourceWidthByClass[2] || 2));
    const mainstemMetric = Math.max(150, state.maxSourceWidthByClass[0] || 150);
    const secondaryRiver = Number((waterwayHalfWidthCssPx(0, riverMetric) * 2).toFixed(3));
    const stream = Number((waterwayHalfWidthCssPx(1, streamMetric) * 2).toFixed(3));
    const canal = Number((waterwayHalfWidthCssPx(2, canalMetric) * 2).toFixed(3));
    const mainstem = Number((waterwayHalfWidthCssPx(0, mainstemMetric) * 2).toFixed(3));
    return {
      profile: WATERWAY_STYLE_PROFILE,
      emphasis: Number(state.waterwayEmphasis.toFixed(3)),
      zoom_scale: Number(waterwayZoomScale().toFixed(3)),
      mainstem_full_width_css_px: mainstem,
      secondary_river_max_full_width_css_px: secondaryRiver,
      stream_max_full_width_css_px: stream,
      canal_max_full_width_css_px: canal,
      max_full_width_css_px: Math.max(secondaryRiver, stream, canal),
      mainstem_names: ['漓江', '湘江', '资江'],
      mainstem_segment_counts: state.hydrologyManifest?.styling?.mainstem_segment_counts || null,
      hierarchy_metric: state.hydrologyManifest?.styling?.hierarchy_metric || null,
      color_gradient: 'lighter-and-thinner-upstream_to_darker-and-wider-downstream',
      mainstem_color: 'deep-blue',
      ordinary_stream_color: 'light-desaturated-blue',
      source_width_influence: 'network-accumulation-with-source-width-support',
      overview_secondary_target_max_css_px: 1.8,
      overview_mainstem_target_css_px: [2.2, 4.2],
      native_detail_mainstem_target_css_px: [4.2, 9.0],
    };
  }

  function buildOverviewGeometry() {'''


def patch_pipeline() -> None:
    path = ROOT / "pipeline" / "build_online_assets.py"
    text = path.read_text(encoding="utf-8")
    pattern = r"\ndef build_hydrology\(\n.*?\n\ndef main\(\) -> int:"
    replacement = "\n" + PIPELINE_BLOCK + "\n\ndef main() -> int:"
    text = replace_once(text, pattern, replacement, "pipeline hydrology function", re.S)
    path.write_text(text, encoding="utf-8")


def patch_viewer() -> None:
    path = ROOT / "viewer" / "app.js"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "const WATERWAY_STYLE_PROFILE = 'thin-hierarchical-continuous-v2';",
        "const WATERWAY_STYLE_PROFILE = 'basin-hierarchy-mainstem-gradient-v3';",
    )
    text = replace_once(
        text,
        r"  const SEGMENT_VERTEX_SHADER = `#version 300 es.*?  function assert\(condition, message\) \{",
        SHADER_BLOCK,
        "waterway shader block",
        re.S,
    )
    text = replace_once(
        text,
        r"  function waterwayZoomScale\(\) \{.*?  function buildOverviewGeometry\(\) \{",
        STYLE_FUNCTIONS,
        "waterway style functions",
        re.S,
    )
    validation_anchor = "    assert(hydrology.nodes?.compression === 'none', '水系节点资产出现压缩');"
    if validation_anchor not in text:
        raise RuntimeError("viewer manifest validation anchor missing")
    text = text.replace(
        validation_anchor,
        validation_anchor + "\n" +
        "    assert(hydrology.styling?.profile === WATERWAY_STYLE_PROFILE, '水系层级样式版本不正确');\n" +
        "    for (const name of ['li', 'xiang', 'zi']) {\n" +
        "      assert((hydrology.styling?.mainstem_segment_counts?.[name] || 0) > 0, `${name} 主河道样式为空`);\n" +
        "    }",
        1,
    )
    old_status = "    $('waterwayWidthStatus').textContent = `${style.max_full_width_css_px.toFixed(1)} px · 随缩放分级`;"
    new_status = "    $('waterwayWidthStatus').textContent = `主河 ${style.mainstem_full_width_css_px.toFixed(1)} px · 支流 ${style.secondary_river_max_full_width_css_px.toFixed(1)} px · 小溪 ${style.stream_max_full_width_css_px.toFixed(1)} px`;"
    if old_status not in text:
        raise RuntimeError("viewer width status anchor missing")
    text = text.replace(old_status, new_status, 1)
    path.write_text(text, encoding="utf-8")


def patch_tests() -> None:
    path = ROOT / "tests" / "browser_full_map_cdp.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        'if style.get("profile") != "thin-hierarchical-continuous-v2":',
        'if style.get("profile") != "basin-hierarchy-mainstem-gradient-v3":',
    )
    anchor = '''    maximum_width = float(style.get("max_full_width_css_px") or 999)
    width_limit = 4.0 if require_detail else 1.8
    if maximum_width > width_limit + 1e-6:
        failures.append(f"waterway width {maximum_width:.3f}px exceeds {width_limit:.1f}px")
'''
    replacement = '''    maximum_width = float(style.get("max_full_width_css_px") or 999)
    width_limit = 3.0 if require_detail else 1.8
    if maximum_width > width_limit + 1e-6:
        failures.append(f"secondary waterway width {maximum_width:.3f}px exceeds {width_limit:.1f}px")
    mainstem_width = float(style.get("mainstem_full_width_css_px") or 0)
    mainstem_minimum, mainstem_maximum = ((4.2, 9.0) if require_detail else (2.2, 4.2))
    if not mainstem_minimum <= mainstem_width <= mainstem_maximum:
        failures.append(
            f"mainstem width {mainstem_width:.3f}px outside {mainstem_minimum:.1f}-{mainstem_maximum:.1f}px"
        )
    secondary_width = float(style.get("secondary_river_max_full_width_css_px") or 999)
    stream_width = float(style.get("stream_max_full_width_css_px") or 999)
    canal_width = float(style.get("canal_max_full_width_css_px") or 999)
    if not require_detail and secondary_width > 1.8:
        failures.append(f"secondary river too wide: {secondary_width:.3f}px")
    if not require_detail and stream_width > 0.9:
        failures.append(f"stream too wide: {stream_width:.3f}px")
    if not require_detail and canal_width > 1.0:
        failures.append(f"canal too wide: {canal_width:.3f}px")
    if mainstem_width <= secondary_width * 1.8:
        failures.append(
            f"mainstem hierarchy too weak: main {mainstem_width:.3f}px secondary {secondary_width:.3f}px"
        )
    if style.get("color_gradient") != "lighter-and-thinner-upstream_to_darker-and-wider-downstream":
        failures.append(f"waterway color gradient: {style.get('color_gradient')}")
    mainstem_counts = style.get("mainstem_segment_counts") or {}
    for name in ("li", "xiang", "zi"):
        if int(mainstem_counts.get(name, 0)) <= 0:
            failures.append(f"missing {name} mainstem segments")
'''
    if anchor not in text:
        raise RuntimeError("browser width validation anchor missing")
    text = text.replace(anchor, replacement, 1)
    pixel_anchor = '''    core_fraction = float(metrics.get("core_after_two_fraction", 1.0))
    if core_fraction > 0.06:
        failures.append(f"waterway two-pixel core fraction too large: {core_fraction:.4f}")
'''
    pixel_replacement = '''    core_fraction = float(metrics.get("core_after_two_fraction", 1.0))
    if core_fraction > 0.12:
        failures.append(f"waterway two-pixel core fraction too large: {core_fraction:.4f}")
    coverage = water_pixels / max(1, int(metrics.get("width", 1)) * int(metrics.get("height", 1)))
    if coverage > 0.025:
        failures.append(f"waterway screen coverage too large: {coverage:.4f}")
'''
    if pixel_anchor not in text:
        raise RuntimeError("browser pixel gate anchor missing")
    text = text.replace(pixel_anchor, pixel_replacement, 1)
    path.write_text(text, encoding="utf-8")


def write_profile() -> None:
    payload = {
        "schema": "guilin-hydrology-render-profile/v3",
        "profile": "basin-hierarchy-mainstem-gradient-v3",
        "mainstem_names": ["漓江", "湘江", "资江"],
        "mainstem_visual_role": "wide-deep-blue",
        "secondary_gradient": "lighter-and-thinner-upstream_to_darker-and-wider-downstream",
        "stream_visual_role": "very-thin-light-desaturated-blue",
        "source_centerlines_mutated": False,
        "manual_centerline_added": False,
        "synthetic_gap_line_added": False,
        "source_segment_loss_allowed": False,
        "expected_dropped_segment_count": 0,
        "overview_secondary_max_width_css_px": 1.8,
        "overview_stream_max_width_css_px": 0.9,
        "overview_mainstem_width_css_px": [2.2, 4.2],
        "detail_mainstem_width_css_px": [4.2, 9.0],
        "join_policy": "overlapped-segments-and-degree-caps",
        "drape_policy": "overview-mesh-for-overview-native-dem-for-detail",
        "display_elevation_fallback": "nearest-valid-native-dem-cell-with-planimetry-unchanged",
        "lake_surface_asset_count": 0,
        "reservoir_surface_asset_count": 0,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (ROOT / "viewer" / "HYDROLOGY_RENDER_V2.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    patch_pipeline()
    patch_viewer()
    patch_tests()
    write_profile()
    print("Applied Guilin basin hierarchy mainstem gradient v3")


if __name__ == "__main__":
    main()
