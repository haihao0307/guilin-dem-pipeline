from __future__ import annotations

from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


app = Path("viewer/app.js")
replace_once(
    app,
    "  const HYDROLOGY_MANIFEST_URL = 'data/osm-waterways-manifest.json';\n",
    "  const HYDROLOGY_MANIFEST_URL = 'data/osm-waterways-manifest.json';\n"
    "  const TILE_RELEASE_BASE_URL = 'https://github.com/haihao0307/guilin-dem-pipeline/releases/download/guilin-native-12p5m-single-truth-v001/';\n"
    "  const DISTILLED_KNOWLEDGE_RUNTIME = true;\n",
)
replace_once(
    app,
    "      const buffer = await fetchBinary(`data/${tile.file}`);",
    "      const buffer = await fetchBinary(`${TILE_RELEASE_BASE_URL}${tile.file}`);",
)
replace_once(
    app,
    "      tile_picker_required: false,\n",
    "      tile_picker_required: false,\n"
    "      distilled_knowledge_runtime: DISTILLED_KNOWLEDGE_RUNTIME,\n"
    "      native_tile_delivery: 'release-on-demand',\n"
    "      full_truth_downloaded_on_page_open: false,\n"
    "      stale_public_assets_allowed: false,\n",
)

index = Path("viewer/index.html")
replace_once(
    index,
    "一张总图连续缩放 · 原生数值几何 · OSM 线状水系 · 水库与湖泊面为零",
    "一张总图连续缩放 · 蒸馏知识索引 · 原生数据按需读取 · 水库与湖泊面为零",
)
replace_once(index, "<span>全域总图</span>", "<span>知识蒸馏运行版</span>")
replace_once(
    index,
    "          <div><dt>观察方式</dt><dd>一张总图连续缩放</dd></div>\n",
    "          <div><dt>观察方式</dt><dd>一张总图连续缩放</dd></div>\n"
    "          <div><dt>运行架构</dt><dd>知识索引 + 按需原生数据</dd></div>\n",
)

qa = Path("tests/browser_full_map_cdp.py")
replace_once(
    qa,
    '        "tile_picker_required": False,\n',
    '        "tile_picker_required": False,\n'
    '        "distilled_knowledge_runtime": True,\n'
    '        "native_tile_delivery": "release-on-demand",\n'
    '        "full_truth_downloaded_on_page_open": False,\n'
    '        "stale_public_assets_allowed": False,\n',
)

print("Applied Guilin distilled knowledge runtime v5 viewer migration")
