from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def main() -> None:
    pages = Path(sys.argv[1] if len(sys.argv) > 1 else "pages")
    src = pages / "coral-mother-r06-pocillopora-t03-hard-surface-color" / "index.html"
    if not src.exists():
        raise FileNotFoundError(src)
    html = src.read_text(encoding="utf-8")

    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal html
        if old not in html:
            raise AssertionError(old[:180])
        html = html.replace(old, new, count)

    rep("<title>Coral Mother R06 · Hard Surface + Live Color T03</title>", "<title>Coral Mother R06 · Microscope Surface + Vivid Color T04</title>")
    rep("PROCEDURAL · R06-T03", "PROCEDURAL · R06-T04")
    rep("Coral Mother R06 · Pocillopora 硬珊瑚表面 T03", "Coral Mother R06 · Pocillopora Microscope 表面 T04")
    rep("HARD SURFACE / LIVE COLOR · visualAcceptance=false", "MICROSCOPE / VIVID LIVE COLOR · visualAcceptance=false")
    rep("标本拟合枝图 → 轻量珊瑚杯波场 + 活组织色；0 GLB / 0 texture", "三频 Microscope 波场 + 高饱和活组织色；0 GLB / 0 texture")
    rep(
        "继续保持标本／函数 A/B。大形体仍由枝图生成；硬珊瑚的珊瑚杯、细脊和骨骼颗粒改用轻量解析波场表达，不增加贴图与重几何。活体色是视觉候选，不冒充 NOAA 分类色。",
        "继续保持标本／函数 A/B。大形体不变；硬珊瑚表面改为三频 Microscope 解析波场，强化珊瑚杯、杯缘、细脊和骨骼颗粒，同时不增加贴图与重几何。",
    )

    pattern = re.compile(
        r'<section id="stage"><canvas id="gl"></canvas><div id="divider"></div>(?P<meta>.*?)</section>\s*<section id="controls">',
        re.S,
    )
    match = pattern.search(html)
    if not match:
        raise AssertionError("stage block not found")
    meta = match.group("meta")
    replacement = (
        '<section id="stage"><canvas id="gl"></canvas><div id="divider"></div></section>'
        '<section id="stageInfo">'
        + meta
        + '</section><section id="controls">'
    )
    html = html[: match.start()] + replacement + html[match.end() :]

    css = r"""
#stageInfo{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:15px;background:#071914;display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:center;box-shadow:0 12px 34px #0004}
#stageInfo .label,#stageInfo #hud,#stageInfo #status{position:static;inset:auto;max-width:none;pointer-events:none;margin:0;background:#061815;border:1px solid #ffffff12;box-shadow:none;backdrop-filter:none}
#stageInfo .label{padding:7px 10px;border-radius:10px}#stageInfo .label b{font-size:10px}
#stageInfo #hud{padding:7px 10px;border-radius:10px;text-align:right;white-space:nowrap}
#stageInfo #status{grid-column:1/-1;display:flex;gap:6px;flex-wrap:wrap;padding:0;border:0;background:transparent}
#stageInfo .chip{padding:5px 8px;font-size:8px;background:#041512;border-color:#ffffff10}
#stage>.label,#stage>#hud,#stage>#status{display:none!important}
@media(max-width:720px){#stageInfo{grid-template-columns:1fr 1fr;padding:8px}#stageInfo #hud{grid-column:1/-1;text-align:left}#stageInfo #status{grid-column:1/-1}.label small{display:none}}
"""
    rep("</style>", css + "\n</style>")

    rep(
        '<button data-view="top">顶面</button><button id="reset">重置镜头</button>',
        '<button data-view="top">顶面</button><button id="microscope">Microscope 近镜</button><button id="reset">重置镜头</button>',
    )

    palette_pattern = re.compile(
        r'<div class="sectionTitle">Living color / 活组织视觉候选</div>.*?<div class="sectionTitle">Reconstruction / 复刻参数</div>',
        re.S,
    )
    palette_html = (
        '<div class="sectionTitle">Living color / 高饱和活组织视觉候选</div>'
        '<div class="buttons" id="palette">'
        '<button data-palette="magenta" class="on">电光玫红</button>'
        '<button data-palette="sunset">日落橙金</button>'
        '<button data-palette="violet">荧光紫</button>'
        '<button data-palette="cyan">孔雀青</button>'
        '<button data-palette="lime">酸绿黄</button>'
        '<button data-palette="bleached">白化存活</button>'
        '<button data-palette="skeleton">裸露骨骼</button>'
        '</div>'
        '<div class="note"><strong>显示边界：</strong>高饱和色用于活组织视觉候选，白化与裸骨独立。它们不是 NOAA 分类颜色，也不替代后续物种和水下光谱校准。</div>'
        '<div class="sectionTitle">Reconstruction / 复刻参数</div>'
    )
    html, count = palette_pattern.subn(palette_html, html, count=1)
    if count != 1:
        raise AssertionError("palette block")

    html = html.replace('id="roughO">0.42', 'id="roughO">0.58').replace(
        'id="rough" type="range" min="0" max="1" step="0.01" value="0.42"',
        'id="rough" type="range" min="0" max="1" step="0.01" value="0.58"',
    )
    html = html.replace('id="cupScaleO">18.0', 'id="cupScaleO">24.0').replace(
        'id="cupScale" type="range" min="8" max="34" step="0.5" value="18"',
        'id="cupScale" type="range" min="8" max="42" step="0.5" value="24"',
    )
    html = html.replace('id="cupDepthO">0.68', 'id="cupDepthO">0.90').replace(
        'id="cupDepth" type="range" min="0" max="1" step="0.01" value="0.68"',
        'id="cupDepth" type="range" min="0" max="1" step="0.01" value="0.90"',
    )
    html = html.replace('id="grainO">0.34', 'id="grainO">0.55').replace(
        'id="grain" type="range" min="0" max="1" step="0.01" value="0.34"',
        'id="grain" type="range" min="0" max="1" step="0.01" value="0.55"',
    )
    grain = '<label class="param"><span class="paramHead"><b>骨骼颗粒</b><output id="grainO">0.55</output></span><input id="grain" type="range" min="0" max="1" step="0.01" value="0.55"><small>高频粗糙；仅着色器计算</small></label>'
    if grain not in html:
        raise AssertionError("grain control")
    controls = grain + (
        '<label class="param"><span class="paramHead"><b>Microscope 强度</b><output id="microO">0.84</output></span><input id="micro" type="range" min="0" max="1" step="0.01" value="0.84"><small>三频杯缘、细脊与凹陷；0 贴图</small></label>'
        '<label class="param"><span class="paramHead"><b>活组织荧光</b><output id="glowO">0.68</output></span><input id="glow" type="range" min="0" max="1" step="0.01" value="0.68"><small>提高水下鲜艳度，不改变分类</small></label>'
        '<label class="param"><span class="paramHead"><b>色彩饱和</b><output id="saturationO">1.22</output></span><input id="saturation" type="range" min="0.65" max="1.55" step="0.01" value="1.22"><small>活体色域控制；骨骼模式不受影响</small></label>'
    )
    html = html.replace(grain, controls, 1)

    fragment_shader = r"""const FS=`precision highp float;varying vec3 vWorld,vNormal;varying vec4 vColor;uniform float uPointPass,uSilhouette,uRoughness,uCupScale,uCupDepth,uGrain,uMicro,uGlow,uSaturation;float wf(vec2 p){return .5+.25*sin(p.x+sin(p.y*.61))+.25*sin(p.y*1.17+sin(p.x*.53));}float field(vec3 p,vec3 n){vec3 w=pow(abs(n),vec3(4.));w/=max(dot(w,vec3(1.)),.001);return wf(p.xy)*w.z+wf(p.yz)*w.x+wf(p.zx)*w.y;}vec3 satc(vec3 c,float s){float l=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(l),c,s);}void main(){if(uPointPass>.5){vec2 q=gl_PointCoord-.5;if(dot(q,q)>.25)discard;gl_FragColor=vColor;return;}vec3 bn=normalize(vNormal);vec3 p=vWorld*uCupScale;float f1=field(p,bn),f2=field(p*2.73+vec3(2.1,5.7,1.3),bn),f3=field(p*7.9+vec3(7.3,1.9,4.7),bn);float cup=smoothstep(.64,.91,f1);float rim=smoothstep(.38,.58,f1)-smoothstep(.64,.86,f1);float ridge=smoothstep(.57,.89,f2);vec3 g=vec3(cos(p.y+p.z*.37)+cos(p.z*2.31),cos(p.z+p.x*.43)+cos(p.x*2.17),cos(p.x+p.y*.31)+cos(p.y*2.43));g-=bn*dot(g,bn);vec3 n=normalize(bn+g*(.025+.19*uMicro)*(.55+.55*rim));vec3 L=normalize(vec3(.42,.82,.34));float d=.18+.82*max(dot(n,L),0.);float cupShade=mix(1.,.42+.48*rim+.13*ridge,uCupDepth*cup);float grain=1.+uGrain*(.09*(f3-.5)+.045*sin(dot(vWorld,vec3(123.7,97.1,81.9))));float broad=1.+uRoughness*.065*sin(dot(vWorld,vec3(29.3,17.1,23.7))+sin(vWorld.y*41.));vec3 base=satc(vColor.rgb,uSaturation);vec3 c=uSilhouette>.5?vec3(.94):base*d*cupShade*grain*broad;c+=base*uGlow*(.10+.34*rim+.17*ridge+.10*f3);c+=vec3(1.,.26,.42)*uGlow*.08*rim;c=pow(max(c,vec3(0.)),vec3(.84));gl_FragColor=vec4(c,vColor.a);}`;"""
    html, count = re.subn(r"const FS=`.*?`;\nfunction shader", fragment_shader + "\nfunction shader", html, count=1, flags=re.S)
    if count != 1:
        raise AssertionError("fragment shader")

    html, count = re.subn(
        r"const U=\{view:.*?\};",
        "const U={view:gl.getUniformLocation(prog,'uView'),proj:gl.getUniformLocation(prog,'uProj'),point:gl.getUniformLocation(prog,'uPointSize'),pass:gl.getUniformLocation(prog,'uPointPass'),sil:gl.getUniformLocation(prog,'uSilhouette'),rough:gl.getUniformLocation(prog,'uRoughness'),cupScale:gl.getUniformLocation(prog,'uCupScale'),cupDepth:gl.getUniformLocation(prog,'uCupDepth'),grain:gl.getUniformLocation(prog,'uGrain'),micro:gl.getUniformLocation(prog,'uMicro'),glow:gl.getUniformLocation(prog,'uGlow'),saturation:gl.getUniformLocation(prog,'uSaturation')};",
        html,
        count=1,
    )
    if count != 1:
        raise AssertionError("uniform map")

    palette_js = r"""const livePalettes={magenta:[[.34,.002,.10,1],[.86,.005,.34,1],[1.,.12,.67,1],[1.,.76,.16,1]],sunset:[[.42,.025,.002,1],[1.,.08,.005,1],[1.,.35,.015,1],[1.,.92,.10,1]],violet:[[.16,.004,.42,1],[.56,.005,.96,1],[1.,.06,.92,1],[.26,.86,1.,1]],cyan:[[.0,.10,.20,1],[.0,.70,.74,1],[.0,1.,.88,1],[.65,1.,.10,1]],lime:[[.08,.19,.0,1],[.30,.78,.0,1],[.78,1.,.02,1],[1.,.48,.0,1]],bleached:[[.76,.72,.65,1],[.86,.82,.72,1],[.95,.90,.80,1],[1.,.97,.89,1]],skeleton:[[.61,.59,.53,1],[.72,.68,.60,1],[.82,.78,.69,1],[.92,.88,.79,1]]};
const cfg={view:'persp',compare:'split',diag:'neutral',palette:'magenta',thickness:1.15,fine:0,tip:1,rough:.58,point:1.55,verrucae:.55,cupScale:24,cupDepth:.90,grain:.55,micro:.84,glow:.68,saturation:1.22};
function colorFor(o){if(cfg.diag==='order'){if(o<2)return colors.primary;if(o<4)return colors.secondary;if(o<6)return colors.tertiary;return colors.fine}if(cfg.diag==='void')return colors.muted;if(cfg.diag==='tips')return colors.neutral;const p=livePalettes[cfg.palette]||livePalettes.magenta;if(o<2)return p[0];if(o<4)return p[1];if(o<6)return p[2];return p[3]}
function h01"""
    html, count = re.subn(r"const livePalettes=.*?\nfunction h01", palette_js, html, count=1, flags=re.S)
    if count != 1:
        raise AssertionError("palette js")

    rep(
        "gl.uniform1f(U.sil,0);gl.uniform1f(U.rough,0);gl.uniform1f(U.cupScale,1);gl.uniform1f(U.cupDepth,0);gl.uniform1f(U.grain,0);gl.enable(gl.BLEND);",
        "gl.uniform1f(U.sil,0);gl.uniform1f(U.rough,0);gl.uniform1f(U.cupScale,1);gl.uniform1f(U.cupDepth,0);gl.uniform1f(U.grain,0);gl.uniform1f(U.micro,0);gl.uniform1f(U.glow,0);gl.uniform1f(U.saturation,1);gl.enable(gl.BLEND);",
    )
    rep(
        "gl.uniform1f(U.sil,cfg.diag==='silhouette'?1:0);gl.uniform1f(U.rough,cfg.rough);gl.uniform1f(U.cupScale,cfg.cupScale);gl.uniform1f(U.cupDepth,cfg.cupDepth);gl.uniform1f(U.grain,cfg.grain);gl.drawArrays(gl.TRIANGLES,0,genGpu.count);",
        "gl.uniform1f(U.sil,cfg.diag==='silhouette'?1:0);gl.uniform1f(U.rough,cfg.rough);gl.uniform1f(U.cupScale,cfg.cupScale);gl.uniform1f(U.cupDepth,cfg.cupDepth);gl.uniform1f(U.grain,cfg.grain);gl.uniform1f(U.micro,cfg.micro);gl.uniform1f(U.glow,cfg.glow);gl.uniform1f(U.saturation,cfg.saturation);gl.drawArrays(gl.TRIANGLES,0,genGpu.count);",
    )

    rep(
        "['thickness','fine','tip','rough','point','verrucae','cupScale','cupDepth','grain']",
        "['thickness','fine','tip','rough','point','verrucae','cupScale','cupDepth','grain','micro','glow','saturation']",
    )
    rep(
        "$('reset').onclick=()=>setView(cfg.view);",
        "$('microscope').onclick=()=>{camera.yaw=.76;camera.pitch=.18;camera.dist=4.25;cfg.compare='gen';document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('on',x.dataset.mode==='gen'));$('viewName').textContent='MICROSCOPE CLOSE';};$('reset').onclick=()=>setView(cfg.view);",
    )
    rep(
        "networkFetches:0,visualAcceptance:false}",
        "networkFetches:0,microscopeMode:'3-band analytic wave',activePalette:cfg.palette,visualAcceptance:false}",
    )

    contract = {
        "ready": True,
        "version": "R06-T04",
        "surface": "3-band analytic microscope wave",
        "surfaceTextureBytes": 0,
        "defaultPalette": "magenta",
        "paletteCount": 7,
        "stageOverlayText": 0,
        "customClassesAllowed": False,
        "visualAcceptance": False,
    }
    rep("</body>", '<script>window.__CORAL_R06_T04__=' + json.dumps(contract, separators=(",", ":")) + ";</script></body>")

    low = html.lower()
    assert "fetch(" not in html and ".glb" not in low
    assert 'id="stageinfo"' in low and 'id="microscope"' in low
    assert "3-band analytic wave" in low

    out = pages / "coral-mother-r06-pocillopora-t04-microscope-color"
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(html, encoding="utf-8")
    qa = {
        "schema": "CORAL_MOTHER_R06_T04_MICROSCOPE_COLOR_QA",
        "bytes": len(html.encode()),
        "sha256": hashlib.sha256(html.encode()).hexdigest(),
        "directSingleFile": True,
        "runtimeGLB": 0,
        "runtimeTextures": 0,
        "surfaceTextureBytes": 0,
        "networkFetchCalls": 0,
        "microDetailMode": "3-band analytic microscope wave",
        "defaultPalette": "magenta",
        "paletteCount": 7,
        "stageOverlayText": 0,
        "desktopBrowserQA": False,
        "mobile390x844QA": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (out / "QA_DIRECT.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False))


if __name__ == "__main__":
    main()
