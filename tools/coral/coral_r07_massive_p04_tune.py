from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit('usage: coral_r07_massive_p04_tune.py <build-dir>')
    root = Path(sys.argv[1])
    index = root / 'index.html'
    build_path = root / 'BUILD_R07_P00.json'
    html = index.read_text(encoding='utf-8')

    html = replace_once(html, 'pit=1-smooth((d-.055)/.190),', 'pit=1-smooth((d-.045)/.235),', 'broaden corallite pit')
    html = replace_once(html, 'wall=1-smooth((edge-.010)/.090),', 'wall=1-smooth((edge-.006)/.125),', 'broaden shared wall')
    html = replace_once(
        html,
        'crown=Math.pow(clamp(1-Math.abs(d-.235)/.095,0,1),1.7),',
        'crown=Math.pow(clamp(1-Math.abs(d-.255)/.115,0,1),1.7),',
        'broaden corallite crown',
    )
    html = replace_once(
        html,
        'corallite=.044*cfg.ridges*wall+.026*crown-.052*pit+grain,',
        'corallite=.060*cfg.ridges*wall+.034*crown-.072*pit+grain,',
        'strengthen pit rim wall relief',
    )
    html = replace_once(
        html,
        'micro=cfg.microDepth*fade*clamp(corallite,-.070,.072);',
        'micro=cfg.microDepth*fade*clamp(corallite,-.095,.105);',
        'expand cellular displacement range',
    )
    html = replace_once(
        html,
        "coralliteTopology:'pit-rim-wall',microscopeGeometry:true,",
        "coralliteTopology:'pit-rim-wall',cellularCoverageTuned:true,microscopeGeometry:true,",
        'runtime tuned coverage marker',
    )
    html = replace_once(
        html,
        "coralliteTopology:'pit-rim-wall',runtimeGLB:0,",
        "coralliteTopology:'pit-rim-wall',cellularCoverageTuned:true,runtimeGLB:0,",
        'build tuned coverage marker',
    )

    index.write_text(html, encoding='utf-8')
    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['bytes'] = len(html.encode('utf-8'))
    build['sha256'] = hashlib.sha256(html.encode('utf-8')).hexdigest()
    build['geometry']['cellularCoverageTuned'] = True
    build['geometry']['cellularDisplacementRange'] = [-0.095, 0.105]
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(build, ensure_ascii=False))


if __name__ == '__main__':
    main()
