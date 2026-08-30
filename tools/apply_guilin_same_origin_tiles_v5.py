from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one match, found {count}: {old[:120]!r}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


app = Path('viewer/app.js')
replace_once(
    app,
    "  const TILE_RELEASE_BASE_URL = 'https://github.com/haihao0307/guilin-dem-pipeline/releases/download/guilin-native-12p5m-single-truth-v001/';\n",
    "  const NATIVE_TILE_RUNTIME_BASE_URL = '../guilin-truth-data/native/';\n",
)
replace_once(
    app,
    "      const buffer = await fetchBinary(`${TILE_RELEASE_BASE_URL}${tile.file}`);",
    "      const buffer = await fetchBinary(`${NATIVE_TILE_RUNTIME_BASE_URL}${tile.file}`);",
)
replace_once(
    app,
    "      native_tile_delivery: 'release-on-demand',",
    "      native_tile_delivery: 'same-origin-on-demand',",
)

qa = Path('tests/browser_full_map_cdp.py')
replace_once(
    qa,
    '        "native_tile_delivery": "release-on-demand",',
    '        "native_tile_delivery": "same-origin-on-demand",',
)

builder = Path('pipeline/distill_online_runtime.py')
text = builder.read_text(encoding='utf-8')
old_constant = '''TILE_RELEASE_BASE_URL = (
    "https://github.com/haihao0307/guilin-dem-pipeline/releases/download/"
    "guilin-native-12p5m-single-truth-v001/"
)
'''
new_constant = '''CANONICAL_TILE_RELEASE_BASE_URL = (
    "https://github.com/haihao0307/guilin-dem-pipeline/releases/download/"
    "guilin-native-12p5m-single-truth-v001/"
)
RUNTIME_TILE_BASE_URL = "../guilin-truth-data/native/"
'''
if text.count(old_constant) != 1:
    raise RuntimeError('unexpected canonical tile constant block')
text = text.replace(old_constant, new_constant, 1)
text = text.replace(
    '            "native_tile_delivery": "release-on-demand",\n'
    '            "native_tile_release_base_url": TILE_RELEASE_BASE_URL,\n',
    '            "native_tile_delivery": "same-origin-on-demand",\n'
    '            "canonical_native_tile_store": "GitHub Release guilin-native-12p5m-single-truth-v001",\n'
    '            "canonical_native_tile_release_base_url": CANONICAL_TILE_RELEASE_BASE_URL,\n'
    '            "runtime_native_tile_store": "GitHub Pages /guilin-truth-data/native/",\n'
    '            "native_tile_runtime_base_url": RUNTIME_TILE_BASE_URL,\n',
    1,
)
builder.write_text(text, encoding='utf-8')

print('Applied same-origin on-demand native tile runtime migration')
