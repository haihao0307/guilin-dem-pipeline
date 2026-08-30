from __future__ import annotations

from pathlib import Path


def replace_exact(text: str, old: str, new: str, expected: int, label: str) -> str:
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{label}: expected {expected}, found {count}")
    return text.replace(old, new)


def main() -> int:
    path = Path("viewer/app.js")
    text = path.read_text(encoding="utf-8")
    text = replace_exact(
        text,
        "float minimumHalfWidth=(aMainstemCode>0.5?0.10:(aClass<0.5?0.075:(aClass<1.5?0.055:0.06)))*uPixelRatio;",
        "float minimumHalfWidth=(aMainstemCode>0.5?0.35:(aClass<0.5?0.24:(aClass<1.5?0.18:0.18)))*uPixelRatio;",
        1,
        "segment minimum width",
    )
    text = replace_exact(
        text,
        "float minimumHalfWidth=(aMainstemCode>0.5?0.10:(aClass<0.5?0.075:0.055))*uPixelRatio;",
        "float minimumHalfWidth=(aMainstemCode>0.5?0.35:(aClass<0.5?0.24:0.18))*uPixelRatio;",
        1,
        "node minimum width",
    )
    text = replace_exact(
        text,
        "float halfWidth=max(minimumHalfWidth,projectedHalfWidth);",
        "float halfWidth=max(minimumHalfWidth,projectedHalfWidth*uZoomScale);",
        1,
        "segment cartographic boost",
    )
    text = replace_exact(
        text,
        "halfWidthPx=max(minimumHalfWidth,halfWidthPx);",
        "halfWidthPx=max(minimumHalfWidth,halfWidthPx*uZoomScale);",
        1,
        "node cartographic boost",
    )
    text = replace_exact(
        text,
        "float ordinaryAlpha=vClass<0.5?mix(0.43,0.79,p):(vClass<1.5?mix(0.22,0.54,p):mix(0.28,0.58,p));\n  float mainAlpha=mix(0.38,0.94,pow(p,0.88));",
        "float ordinaryAlpha=vClass<0.5?mix(0.56,0.86,p):(vClass<1.5?mix(0.42,0.68,p):mix(0.44,0.70,p));\n  float mainAlpha=mix(0.66,0.97,pow(p,0.88));",
        1,
        "waterway alpha",
    )
    text = replace_exact(
        text,
        "  function waterwayZoomScale() {\n    return 1;\n  }",
        "  function waterwayZoomScale() {\n    return clamp(approximateMetersPerCssPixel() / 95, 1, 2.4);\n  }",
        1,
        "zoom scale",
    )
    text = replace_exact(
        text,
        "    const minimum = mainstemCode > 0 ? 0.20 : (classIndex === 0 ? 0.15 : 0.11);\n    return Math.max(minimum, physical / approximateMetersPerCssPixel());",
        "    const minimum = mainstemCode > 0 ? 0.70 : (classIndex === 0 ? 0.48 : 0.36);\n    return Math.max(minimum, physical / approximateMetersPerCssPixel() * waterwayZoomScale());",
        1,
        "metric visibility floor",
    )
    text = replace_exact(
        text,
        "      emphasis: Number(state.waterwayEmphasis.toFixed(3)),\n      approximate_meters_per_css_pixel:",
        "      emphasis: Number(state.waterwayEmphasis.toFixed(3)),\n      cartographic_visibility_boost: Number(waterwayZoomScale().toFixed(3)),\n      approximate_meters_per_css_pixel:",
        1,
        "metric boost field",
    )
    path.write_text(text, encoding="utf-8")
    print("applied Guilin hydrology visibility V6.1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
