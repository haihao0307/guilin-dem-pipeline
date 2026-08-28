from __future__ import annotations

from pathlib import Path

PROJECT = Path("projects/guilin-v074-north-up-crop-and-distillation")


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{label} insertion point missing in {path}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def main() -> int:
    css = PROJECT / "web/styles.css"
    text = css.read_text(encoding="utf-8")
    old_font = '"Microsoft JhengHei", "Noto Sans TC", sans-serif'
    new_font = '"Microsoft JhengHei", "Noto Sans CJK TC", "Noto Sans TC", sans-serif'
    if new_font not in text:
        if old_font not in text:
            raise SystemExit("CJK font stack insertion point missing")
        css.write_text(text.replace(old_font, new_font), encoding="utf-8")

    app = PROJECT / "web/app.js"
    old_helper = (
        "  function computedBackgroundIsTransparent(element) {\n"
        "    const value = getComputedStyle(element).backgroundColor.replace(/\\s+/g, '');\n"
        "    return value === 'rgba(0,0,0,0)' || value === 'transparent';\n"
        "  }\n\n"
    )
    new_helper = old_helper + (
        "  function cjkGlyphsRendered() {\n"
        "    const canvas = document.createElement('canvas');\n"
        "    canvas.width = 56;\n"
        "    canvas.height = 56;\n"
        "    const context = canvas.getContext('2d', { willReadFrequently: true });\n"
        "    if (!context) return false;\n"
        "    const family = getComputedStyle(document.documentElement).fontFamily;\n"
        "    const signatures = ['桂', '林', '真', '寶', '鼎'].map(character => {\n"
        "      context.clearRect(0, 0, canvas.width, canvas.height);\n"
        "      context.fillStyle = '#000';\n"
        "      context.textBaseline = 'alphabetic';\n"
        "      context.font = `900 40px ${family}`;\n"
        "      context.fillText(character, 4, 44);\n"
        "      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;\n"
        "      let hash = 2166136261;\n"
        "      let ink = 0;\n"
        "      for (let index = 3; index < pixels.length; index += 4) {\n"
        "        const alpha = pixels[index];\n"
        "        if (alpha > 0) ink += 1;\n"
        "        hash ^= alpha;\n"
        "        hash = Math.imul(hash, 16777619);\n"
        "      }\n"
        "      return `${ink}:${hash >>> 0}`;\n"
        "    });\n"
        "    return signatures.every(signature => Number(signature.split(':')[0]) > 30) && new Set(signatures).size >= 4;\n"
        "  }\n\n"
    )
    replace_once(app, old_helper, new_helper, "CJK glyph helper")
    replace_once(
        app,
        "    checks.default_light = getComputedStyle(document.documentElement).colorScheme.includes('light');\n"
        "    checks.console_errors_zero = runtimeErrors.length === 0;\n",
        "    checks.default_light = getComputedStyle(document.documentElement).colorScheme.includes('light');\n"
        "    checks.cjk_glyphs_rendered = cjkGlyphsRendered();\n"
        "    checks.console_errors_zero = runtimeErrors.length === 0;\n",
        "CJK browser check",
    )

    validator = PROJECT / "tests/validate_browser_dump.py"
    replace_once(
        validator,
        '        "default_light",\n        "console_errors_zero",\n',
        '        "default_light",\n        "cjk_glyphs_rendered",\n        "console_errors_zero",\n',
        "CJK validator requirement",
    )

    static = PROJECT / "tests/static_contract_test.mjs"
    replace_once(
        static,
        "assert.match(css, /\\.landmark-label\\s*\\{[\\s\\S]*background:\\s*transparent\\s*!important/);\n",
        "assert.match(css, /\\.landmark-label\\s*\\{[\\s\\S]*background:\\s*transparent\\s*!important/);\n"
        "assert.match(css, /Noto Sans CJK TC/);\n",
        "CJK static CSS check",
    )
    replace_once(
        static,
        "assert.match(app, /single_active_aoi/);\n",
        "assert.match(app, /single_active_aoi/);\nassert.match(app, /cjk_glyphs_rendered/);\n",
        "CJK static app check",
    )

    browser = PROJECT / "tests/browser_cdp.py"
    ensure_font = '''def ensure_cjk_font() -> str:\n    fontconfig = shutil.which("fc-match")\n    if not fontconfig:\n        return "fontconfig-unavailable; relying on platform CJK fonts"\n    probe = subprocess.run(\n        [fontconfig, "Noto Sans CJK TC"],\n        check=True,\n        capture_output=True,\n        text=True,\n    ).stdout.strip()\n    if "Noto Sans CJK TC" in probe:\n        return probe\n    if os.environ.get("CI", "").lower() != "true":\n        raise SystemExit(f"Rendered CJK QA font unavailable: {probe}")\n    subprocess.run(["sudo", "apt-get", "update"], check=True)\n    subprocess.run(\n        ["sudo", "apt-get", "install", "-y", "--no-install-recommends", "fonts-noto-cjk"],\n        check=True,\n    )\n    probe = subprocess.run(\n        [fontconfig, "Noto Sans CJK TC"],\n        check=True,\n        capture_output=True,\n        text=True,\n    ).stdout.strip()\n    if "Noto Sans CJK TC" not in probe:\n        raise SystemExit(f"Rendered CJK QA font still unavailable: {probe}")\n    return probe\n\n\n'''
    replace_once(browser, "def main() -> int:\n", ensure_font + "def main() -> int:\n", "CJK font installer")
    replace_once(
        browser,
        "    args.evidence_dir.mkdir(parents=True, exist_ok=True)\n    port = free_port()\n",
        "    args.evidence_dir.mkdir(parents=True, exist_ok=True)\n"
        "    font_match = ensure_cjk_font()\n"
        "    (args.evidence_dir / 'cjk-font-match.txt').write_text(font_match + '\\n', encoding='utf-8')\n"
        "    port = free_port()\n",
        "CJK font receipt",
    )

    print("CJK visual QA gate materialized")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
