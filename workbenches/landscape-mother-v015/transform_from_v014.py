#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import numpy as np


VERTEX_DTYPE = np.dtype(
    [
        ("q", "<u2", (3,)),
        ("n", "<i2", (3,)),
        ("f1", "u1", (4,)),
        ("f2", "u1", (4,)),
        ("f3", "u1", (4,)),
        ("f4", "u1", (4,)),
        ("pad", "u1", (4,)),
    ]
)


def smoothstep(value: np.ndarray) -> np.ndarray:
    value = np.clip(value, 0.0, 1.0)
    return value * value * (3.0 - 2.0 * value)


KNOTS = np.array([0.0, 0.10, 0.34, 0.54, 0.72, 0.86, 0.95, 1.0], dtype=np.float64)
PROFILE_VALUES = np.array([1.0, 1.0, 0.965, 0.83, 0.58, 0.34, 0.14, 0.035], dtype=np.float64)


def radius_profile(height01: np.ndarray) -> np.ndarray:
    height01 = np.clip(height01, 0.0, 1.0)
    result = np.empty_like(height01)
    for index in range(len(KNOTS) - 1):
        if index == len(KNOTS) - 2:
            mask = (height01 >= KNOTS[index]) & (height01 <= KNOTS[index + 1])
        else:
            mask = (height01 >= KNOTS[index]) & (height01 < KNOTS[index + 1])
        local = (height01[mask] - KNOTS[index]) / (KNOTS[index + 1] - KNOTS[index])
        blend = smoothstep(local)
        result[mask] = PROFILE_VALUES[index] * (1.0 - blend) + PROFILE_VALUES[index + 1] * blend
    return result


def weighted_quantile(values: np.ndarray, weights: np.ndarray, quantile: float) -> float:
    order = np.argsort(values)
    ordered_values = values[order]
    ordered_weights = weights[order]
    cumulative = np.cumsum(ordered_weights)
    return float(ordered_values[np.searchsorted(cumulative, quantile * cumulative[-1])])


def replace_exact(text: str, old: str, new: str) -> str:
    if old not in text:
        raise RuntimeError(f"Expected runtime token is missing: {old[:96]}")
    return text.replace(old, new, 1)


def patch_runtime(root: Path) -> None:
    app_path = root / "app.js"
    app = app_path.read_text(encoding="utf-8")
    replacements = {
        "tour:true,vivid:1.08,clarity:1.04,rockLight:1.02,plainLight:1.00,":
            "tour:true,vivid:1.03,clarity:1.02,rockLight:1.08,plainLight:.92,",
        "limestone:1.00,warmth:.52,fresh:.70,micro:.44,":
            "limestone:1.02,warmth:.46,fresh:.78,micro:.52,",
        "vegetation:1.02,moss:.72,lichen:.60,plainGreen:1.06,":
            "vegetation:.82,moss:.68,lichen:.56,plainGreen:.88,",
        "waterStain:.92,iron:.62,wet:.24,cavity:.78,":
            "waterStain:1.08,iron:.58,wet:.20,cavity:.84,",
        "sun:3.80,sky:.72,inspect:.34,exposure:1.00,mode:0":
            "sun:4.10,sky:.80,inspect:.40,exposure:1.04,mode:0",
        "vec3 grassDeep=s2l(vec3(.050,.205,.052));":
            "vec3 grassDeep=s2l(vec3(.035,.105,.032));",
        "vec3 grassMid=s2l(vec3(.125,.405,.090));":
            "vec3 grassMid=s2l(vec3(.080,.255,.055));",
        "vec3 grassSun=s2l(vec3(.285,.555,.130));":
            "vec3 grassSun=s2l(vec3(.190,.410,.085));",
        "vec3 earth=s2l(vec3(.315,.255,.135));":
            "vec3 earth=s2l(vec3(.330,.245,.125));",
        "vec3 limestoneCool=s2l(vec3(.355,.390,.382));":
            "vec3 limestoneCool=s2l(vec3(.385,.405,.397));",
        "vec3 limestoneWarm=s2l(vec3(.535,.505,.420));":
            "vec3 limestoneWarm=s2l(vec3(.525,.492,.402));",
        "vec3 limestonePale=s2l(vec3(.700,.704,.645));":
            "vec3 limestonePale=s2l(vec3(.675,.690,.642));",
        "vec3 weathered=s2l(vec3(.445,.405,.315));":
            "vec3 weathered=s2l(vec3(.405,.380,.315));",
        "vec3 calcite=s2l(vec3(.770,.775,.715));":
            "vec3 calcite=s2l(vec3(.760,.770,.725));",
        "veg*=1.0-verticality*.70;":
            "veg*=1.0-verticality*.84;",
        "veg=clamp(veg*(.48+.70*vegPatch),0.0,.94);":
            "veg=clamp(veg*(.42+.62*vegPatch),0.0,.82);",
        "vec3 foliageDeep=s2l(vec3(.025,.145,.035));":
            "vec3 foliageDeep=s2l(vec3(.018,.105,.028));",
        "vec3 foliageMid=s2l(vec3(.055,.315,.052));":
            "vec3 foliageMid=s2l(vec3(.042,.245,.042));",
        "vec3 foliageBright=s2l(vec3(.155,.465,.075));":
            "vec3 foliageBright=s2l(vec3(.120,.355,.060));",
        "vec3 lichenColor=s2l(vec3(.435,.485,.245));":
            "vec3 lichenColor=s2l(vec3(.405,.445,.235));",
        "vec3 mossColor=s2l(vec3(.035,.225,.036));":
            "vec3 mossColor=s2l(vec3(.025,.175,.030));",
        "vec3 ironColor=s2l(vec3(.455,.245,.085));":
            "vec3 ironColor=s2l(vec3(.435,.225,.075));",
        "vec3 waterBlack=s2l(vec3(.022,.034,.029));":
            "vec3 waterBlack=s2l(vec3(.010,.016,.013));",
        "stats={\n    version:'V014'":
            "stats={\n    version:'V015P1'",
        "subtitle.textContent='已完成 · '+m.scene.towerCount+' 座真值约束塔峰 · '+m.scene.areaWeightedMeanSlopeDeg.toFixed(1)+'° 平均坡度';":
            "subtitle.textContent='V015 进展版 · '+m.scene.towerCount+' 座收束塔峰 · 峰冠与崖壁已重构';",
        "showToast('<b>桂林葡萄峰林 V014</b> · 真实尺度、孤立基座和近垂直岩壁已载入');":
            "showToast('<b>桂林葡萄峰林 V015 进展版</b> · 峰冠、陡壁与综合色彩已重构');",
        "let views={},camera={yaw:.78,pitch:.29,dist:5200,target:[0,130,0]},activeView='hero';":
            "let views={},camera={yaw:.78,pitch:.18,dist:3900,target:[0,160,0]},activeView='hero';",
        "hero:{yaw:.80,pitch:.30,dist:width*1.42,target:[0,125,0]},":
            "hero:{yaw:.82,pitch:.18,dist:width*.92,target:[0,158,0]},",
        "forest:{yaw:1.10,pitch:.25,dist:width*.88,target:[0,125,0]},":
            "forest:{yaw:1.08,pitch:.14,dist:width*.62,target:[-120,158,-260]},",
        "cliff:{yaw:1.48,pitch:.15,dist:Math.max(520,tallest.renderRelativeHeightM*3.7),":
            "cliff:{yaw:1.48,pitch:.10,dist:Math.max(430,tallest.renderRelativeHeightM*3.1),",
        "top:{yaw:.70,pitch:1.29,dist:width*1.40,target:[0,80,0]}":
            "top:{yaw:.70,pitch:1.29,dist:width*1.22,target:[0,90,0]}",
        "const fov=innerWidth<720?1.02:.78;":
            "const fov=innerWidth<720?.92:.70;",
    }
    for old, new in replacements.items():
        app = replace_exact(app, old, new)
    app_path.write_text(app, encoding="utf-8")

    index_path = root / "index.html"
    index = index_path.read_text(encoding="utf-8")
    index = index.replace("桂林葡萄峰林 V014", "桂林葡萄峰林 V015 进展版")
    index = index.replace(
        "当前只推进桂林塔状峰林。先固定真实尺度、平原和孤立峰体，再逐层完成洞穴、水蚀、植被和石灰岩材质。",
        "当前只推进桂林葡萄乡型塔状峰林。峰冠、近垂直岩壁、峰间平原和水蚀材料同步收敛。",
    )
    index = index.replace(
        "4 公里真实尺度 · 12.5 米高程真值 · 孤立塔峰 · 垂直崖壁",
        "4 公里真实尺度 · 12.5 米高程真值 · 收束峰冠 · 连续陡壁",
    )
    index_path.write_text(index, encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: transform_from_v014.py <runtime-directory>")
    root = Path(sys.argv[1]).resolve()
    scene_path = root / "scene.bin"
    meta_path = root / "SCENE_META.json"
    if not scene_path.is_file() or not meta_path.is_file():
        raise SystemExit("runtime directory is missing scene.bin or SCENE_META.json")

    data = bytearray(scene_path.read_bytes())
    if bytes(data[:4]) != b"LMF5":
        raise RuntimeError("unexpected scene binary magic")
    version, stride, vertex_count, index_count = struct.unpack_from("<4I", data, 4)
    minimum = np.array(struct.unpack_from("<3f", data, 20), dtype=np.float64)
    maximum = np.array(struct.unpack_from("<3f", data, 32), dtype=np.float64)
    vertex_offset, index_offset, tower_count = struct.unpack_from("<3I", data, 44)
    if version != 5 or stride != 32 or vertex_offset != 128:
        raise RuntimeError("unsupported scene format")

    vertices = np.frombuffer(data, dtype=VERTEX_DTYPE, count=vertex_count, offset=vertex_offset)
    indices = np.frombuffer(data, dtype="<u4", count=index_count, offset=index_offset)
    position = minimum + vertices["q"].astype(np.float64) / 65535.0 * (maximum - minimum)
    tower_ids = vertices["f4"][:, 3].astype(np.int32)
    material = vertices["f1"][:, 0]
    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    tower_receipt = []
    for tower in meta["towers"]:
        tower_id = int(tower["id"])
        mask = tower_ids == tower_id
        points = position[mask]
        if not np.any(mask):
            raise RuntimeError(f"tower {tower_id} has no vertices")

        center = np.array(tower["sourcePeakPositionM"], dtype=np.float64)
        base = float(tower["sourceBaseElevationM"])
        declared_height = float(tower["renderRelativeHeightM"])
        old_top = float(points[:, 1].max())
        old_height = max(1.0, old_top - base)
        height01 = np.clip((points[:, 1] - base) / old_height, 0.0, 1.0)

        delta_x = points[:, 0] - center[0]
        delta_z = points[:, 2] - center[1]
        radius = np.hypot(delta_x, delta_z)
        angle = np.arctan2(delta_z, delta_x)
        source_radius = float(tower["sourceMaximumInteriorDistanceM"])

        base_radius = min(source_radius * 0.72, max(46.0, declared_height * 0.84))
        phase = (tower_id * 2.399963229728653) % (2.0 * math.pi)
        asymmetry = (
            1.0
            + (0.09 + 0.05 * height01) * np.sin(3.0 * angle + phase)
            + (0.04 + 0.04 * height01) * np.sin(7.0 * angle - phase * 0.57)
        )
        envelope = base_radius * radius_profile(height01) * asymmetry
        new_radius = np.minimum(radius * 0.94, envelope)
        new_radius = np.maximum(
            new_radius,
            np.where(height01 > 0.985, 0.9 + 0.7 * np.sin(angle * 5.0 + phase) ** 2, 0.0),
        )
        radial_scale = np.divide(new_radius, radius, out=np.zeros_like(new_radius), where=radius > 1e-6)

        tilt = min(18.0, base_radius * 0.12) * height01**1.55
        points[:, 0] = center[0] + delta_x * radial_scale + math.cos(phase) * tilt
        points[:, 2] = center[1] + delta_z * radial_scale + math.sin(phase) * tilt

        crown = smoothstep((height01 - 0.79) / 0.21)
        crown_radius = new_radius / max(base_radius * 0.36, 1.0)
        edge_drop = declared_height * 0.075 * crown * np.clip(crown_radius, 0.0, 1.4) ** 1.35
        angular_drop = (
            declared_height
            * 0.018
            * crown
            * (0.5 + 0.5 * np.sin(angle * 4.0 + phase))
            * (0.5 - 0.5 * np.cos(angle - (phase + 0.55)))
        )
        points[:, 1] -= edge_drop + angular_drop
        points[:, 1] += (
            declared_height
            * 0.028
            * smoothstep((height01 - 0.45) / 0.35)
            * (1.0 - crown)
        )
        points[:, 1] = np.minimum(points[:, 1], old_top)
        position[mask] = points

        tower["renderRelativeHeightM"] = float(points[:, 1].max() - base)
        tower_receipt.append(
            {
                "id": tower_id,
                "baseRadiusM": float(base_radius),
                "apexEnvelopeRadiusM": float(base_radius * PROFILE_VALUES[-1]),
                "renderHeightM": tower["renderRelativeHeightM"],
                "tiltAmplitudeM": float(min(18.0, base_radius * 0.12)),
            }
        )

    quantized = np.rint((position - minimum) / (maximum - minimum) * 65535.0)
    quantized = np.clip(quantized, 0, 65535).astype(np.uint16)
    vertices["q"][:] = quantized
    reconstructed = minimum + quantized.astype(np.float64) / 65535.0 * (maximum - minimum)

    triangles = indices.reshape(-1, 3)
    p0 = reconstructed[triangles[:, 0]]
    p1 = reconstructed[triangles[:, 1]]
    p2 = reconstructed[triangles[:, 2]]
    face_cross = np.cross(p1 - p0, p2 - p0)
    doubled_area = np.linalg.norm(face_cross, axis=1)
    face_normal = np.divide(
        face_cross,
        doubled_area[:, None],
        out=np.zeros_like(face_cross),
        where=doubled_area[:, None] > 1e-12,
    )
    accumulated = np.zeros((vertex_count, 3), dtype=np.float64)
    np.add.at(accumulated, triangles[:, 0], face_normal)
    np.add.at(accumulated, triangles[:, 1], face_normal)
    np.add.at(accumulated, triangles[:, 2], face_normal)
    lengths = np.linalg.norm(accumulated, axis=1)
    accumulated[lengths > 0] /= lengths[lengths > 0, None]
    vertices["n"][:] = np.clip(np.rint(accumulated * 32767.0), -32767, 32767).astype(np.int16)

    scene_path.write_bytes(data)
    digest = hashlib.sha256(scene_path.read_bytes()).hexdigest()

    areas = doubled_area * 0.5
    face_slope = np.degrees(np.arccos(np.clip(np.abs(face_normal[:, 1]), 0.0, 1.0)))
    tower_face = np.all(material[triangles] == 1, axis=1)
    valid = tower_face & (areas > 1e-10)
    slope = face_slope[valid]
    weights = areas[valid]
    total = float(weights.sum())

    def ratio(threshold: float) -> float:
        return float(weights[slope >= threshold].sum() / total)

    high = slope >= 45.0
    scene = meta["scene"]
    scene["binarySha256"] = digest
    scene["binaryBytes"] = scene_path.stat().st_size
    scene["boundsM"] = [minimum.tolist(), maximum.tolist()]
    heights = [float(item["renderRelativeHeightM"]) for item in meta["towers"]]
    scene["renderRelativeHeightRangeM"] = [min(heights), max(heights)]
    scene["areaWeightedMeanSlopeDeg"] = float(np.sum(slope * weights) / total)
    scene["areaWeightedMeanSlope45PlusDeg"] = float(
        np.sum(slope[high] * weights[high]) / weights[high].sum()
    )
    scene["areaWeightedP50SlopeDeg"] = weighted_quantile(slope, weights, 0.50)
    scene["areaWeightedP90SlopeDeg"] = weighted_quantile(slope, weights, 0.90)
    for threshold in (45, 60, 75, 80, 87, 89):
        scene[f"areaRatioSlope{threshold}Plus"] = ratio(float(threshold))
    scene["tinyFaceCountLt1e8"] = int(np.sum(areas < 1e-8))
    scene["slopeStatisticsScope"] = "tower surfaces only; ground excluded"

    meta["schema"] = "landscape-mother-guilin-putao-fenglin-v015-progress/1"
    meta["version"] = "V015P1"
    meta["prototype"] = "Guilin Putao tower-forest crown contraction progress"
    meta["visualRevision"] = {
        "status": "progress candidate",
        "changes": [
            "source-supported peak positions and base elevations retained",
            "tower bases narrowed inside source footprint envelopes",
            "lower wall radius held nearly constant for continuous steep walls",
            "upper profiles contracted into narrow asymmetric crowns",
            "broad caps converted into broken crown silhouettes",
            "plain and limestone palette moved away from neon green and brown plastic response",
            "default camera lowered and moved closer",
        ],
        "towerEnvelopeReceipt": tower_receipt,
    }
    meta["approvals"] = {
        "visualApproved": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    patch_runtime(root)
    (root / "PROGRESS_NOTES.md").write_text(
        "# Landscape Mother 桂林葡萄峰林 V015 进展版\n\n"
        "本版保留 12.5 米权威高程裁剪给出的峰位、峰顶高程、局部基准面和区域平原。\n"
        "程序化重建聚焦峰脚收紧、连续陡壁、中上部收束、破碎峰冠、综合色彩与低机位观察。\n\n"
        "当前仍为视觉进展候选，visualApproved=false，visualAcceptance=false，productionReady=false。\n",
        encoding="utf-8",
    )
    print(json.dumps({
        "version": meta["version"],
        "vertices": vertex_count,
        "triangles": index_count // 3,
        "towerCount": tower_count,
        "heightRangeM": scene["renderRelativeHeightRangeM"],
        "towerMeanSlopeDeg": scene["areaWeightedMeanSlopeDeg"],
        "towerSlope87Plus": scene["areaRatioSlope87Plus"],
        "sceneSha256": digest,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
