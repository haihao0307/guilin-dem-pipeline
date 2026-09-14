from __future__ import annotations

from pathlib import Path
import hashlib, json, re

ROOT = Path(__file__).resolve().parents[3]
BASE = ROOT / 'ocean-mother/recovery/r0189-1/Ocean_Mother_R018.9.1_Nearshore_Candidate.html'
OUT_DIR = ROOT / 'ocean-mother/recovery/r0189-2'
OUT = OUT_DIR / 'Ocean_Mother_R018.9.2_Shore_Contact_Candidate.html'
REPORT = OUT_DIR / 'R0189_2_BUILD_REPORT.json'
EXPECTED_SHA = 'ef13d439afe7ab3bf6f8d763c8ceaa04e356f1854431f06d1ea558e1ca99f613'


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, got {count}')
    return text.replace(old, new, 1)


def block(text: str, pattern: str, label: str) -> str:
    m = re.search(pattern, text, re.S)
    if not m:
        raise RuntimeError(f'missing protected block {label}')
    return m.group(0)


def main() -> None:
    raw = BASE.read_bytes()
    if sha(raw) != EXPECTED_SHA:
        raise RuntimeError('R018.9.1 source SHA mismatch')
    source = raw.decode('utf-8')

    protected = {
        'deep': r'const ORIGINAL_DEEP_HTML=.*?;\nconst deepFrame=',
        'shoreDistance': r'float shoreDistance\(vec2 p\)\{.*?\n\}',
        'rockField': r'float rockField\(vec2 p\)\{.*?\n\}',
        'terrainHeight': r'float terrainHeight\(vec2 p\)\{.*?\n\}',
        'waterHeight': r'float waterHeight\(vec2 p\)\{.*?\n\}',
        'foamField': r'float foamFilament\(vec2 p,float scale,vec2 drift,float phase\)\{.*?\n\}\nfloat foamField\(vec2 p\)\{.*?\n\}',
        'curlDensity': r'float curlDensity\(vec3 p\)\{.*?\n\}',
        'sprayDensity': r'float sprayDensity\(vec3 p\)\{.*?\n\}',
        'smokeDensityAt': r'float smokeDensityAt\(vec3 p\)\{.*?\n\}',
        'setView': r'function setView\(name\)\{.*?\n\}',
    }
    before = {k: sha(block(source, p, k).encode()) for k, p in protected.items()}
    s = source

    # Narrow wet-sand response and remove the broad dark ring.
    s = one(s,
        '  float wet=beach*(1.-smoothstep(.45,4.6,inland));',
        '  float damp=beach*(1.-smoothstep(.20,2.72,inland));\n  float swash=beach*exp(-pow((sd+.08)/1.36,2.));\n  float wetPatch=.62+.38*fbm(p.xz*.18+vec2(1.8,-3.1));\n  float wet=sat(damp*wetPatch+swash*.34);',
        'wet sand band')
    s = one(s,
        '  vec3 drySand=mix(vec3(.62,.54,.40),vec3(.88,.80,.62),sat(grain*.72+.18));',
        '  vec3 drySand=mix(vec3(.56,.53,.45),vec3(.82,.76,.63),sat(grain*.68+.18));',
        'dry sand colour')
    s = one(s,
        '  vec3 wetSand=mix(vec3(.20,.185,.155),vec3(.34,.29,.22),grain*.34);',
        '  vec3 wetSand=mix(vec3(.145,.185,.185),vec3(.30,.29,.255),grain*.31);',
        'wet sand colour')
    s = one(s,
        '  vec3 scrub=mix(vec3(.10,.18,.075),vec3(.31,.36,.15),sat(macro*.92));',
        '  vec3 scrub=mix(vec3(.075,.145,.068),vec3(.245,.315,.145),sat(macro*.90));',
        'scrub colour')
    s = one(s,
        '  scrub=mix(scrub,vec3(.22,.27,.11),drainage*.24);',
        '  scrub=mix(scrub,vec3(.185,.245,.105),drainage*.20);',
        'scrub drainage')
    s = one(s,
        '  vec3 earth=mix(vec3(.25,.18,.115),vec3(.42,.31,.18),grain*.55);',
        '  vec3 earth=mix(vec3(.205,.175,.125),vec3(.36,.30,.205),grain*.50);',
        'earth colour')

    # Keep rock geometry unchanged; only neutralise colour and constrain the wet line.
    s = one(s,
        '  vec3 rockCol=mix(vec3(.205,.215,.195),vec3(.43,.39,.31),sat(rockMacro*.72+rockMicro*.22));',
        '  vec3 rockCol=mix(vec3(.19,.22,.215),vec3(.42,.405,.355),sat(rockMacro*.70+rockMicro*.20));',
        'rock colour')
    s = one(s,
        '  float wetRock=rock*(1.-smoothstep(1.0,6.2,h))*(.45+.55*wet);\n  rockCol=mix(rockCol,vec3(.075,.096,.098),wetRock*.72);\n  rockCol=mix(vec3(.24),rockCol,sat(.55+uRocks.y*.34));',
        '  float nearShore=1.-smoothstep(2.0,12.0,abs(sd));\n  float waterline=exp(-pow((h-.28)/1.42,2.));\n  float wetRock=rock*nearShore*waterline*(.66+.34*noise2(p.xz*.62+2.8));\n  rockCol=mix(rockCol,vec3(.055,.083,.090),wetRock*.84);\n  float lichen=rock*(1.-wetRock)*smoothstep(.54,.78,fbm(p.xz*.31+9.3));\n  rockCol=mix(rockCol,vec3(.25,.285,.205),lichen*.16);\n  rockCol=mix(vec3(.235),rockCol,sat(.48+uRocks.y*.28));',
        'wet rock line')
    s = one(s,
        '  float skyFill=.32+.15*n.y;\n  float diff=skyFill+.68*ndl;',
        '  float skyFill=.40+.17*n.y;\n  float diff=skyFill+.60*ndl;',
        'terrain lighting')
    s = one(s,
        '  col+=col*back*.08;',
        '  col+=col*back*.055;',
        'terrain backlight')
    s = one(s,
        '  col+=rim*mix(vec3(.025,.045,.05),vec3(.085,.115,.105),rock)*(.35+.65*ndl);\n  col+=rock*vec3(.025,.030,.027)*(1.-ndl);',
        '  col+=rim*mix(vec3(.018,.032,.036),vec3(.060,.082,.080),rock)*(.30+.70*ndl);\n  col+=rock*vec3(.014,.019,.019)*(1.-ndl);',
        'terrain rim')
    s = one(s,
        '  col+=vec3(.32,.35,.33)*spec*(wet*.25+wetRock*.72);',
        '  col+=vec3(.24,.28,.28)*spec*(wet*.20+wetRock*.74);',
        'wet specular')

    # Cooler, less toy-like shallow water and thinner foam blending.
    s = one(s,
        '  vec3 deep=vec3(.008,.105,.165);\n  vec3 shelf=vec3(.025,.30,.35);\n  vec3 lagoon=vec3(.105,.47,.43);\n  vec3 seabed=vec3(.48,.39,.25);',
        '  vec3 deep=vec3(.007,.088,.145);\n  vec3 shelf=vec3(.022,.245,.292);\n  vec3 lagoon=vec3(.070,.365,.348);\n  vec3 seabed=vec3(.39,.36,.29);',
        'water palette')
    s = one(s,
        '  body=mix(body,lagoon,pow(shallow,1.8)*.54);\n  body=mix(body,seabed,pow(shallow,3.2)*.19*uOptics.x);',
        '  body=mix(body,lagoon,pow(shallow,1.9)*.46);\n  body=mix(body,seabed,pow(shallow,3.35)*.13*uOptics.x);',
        'shallow water mix')
    s = one(s,
        '  float foamBody=smoothstep(.16,.78,foam);\n  float foamThread=smoothstep(.028,.22,foam)*(1.-smoothstep(.58,.92,foam));',
        '  float shoreContact=exp(-pow(shoreDistance(p.xz)/4.8,2.))*pow(shallow,1.55);\n  col+=vec3(.012,.075,.074)*shoreContact*(.30+.70*max(dot(n,sunDir),0.));\n  float foamBody=smoothstep(.22,.82,foam);\n  float foamThread=smoothstep(.031,.19,foam)*(1.-smoothstep(.52,.88,foam));',
        'shore contact')
    s = one(s,
        '  vec3 foamCol=mix(vec3(.78,.90,.90),vec3(.95,.94,.88),foamWarm*.18);\n  col=mix(col,foamCol,foamBody*.58);\n  col+=foamThread*vec3(.13,.18,.17)*(.30+.70*max(dot(n,sunDir),0.));',
        '  vec3 foamCol=mix(vec3(.79,.90,.90),vec3(.94,.935,.89),foamWarm*.13);\n  col=mix(col,foamCol,foamBody*.46);\n  col+=foamThread*vec3(.105,.145,.14)*(.28+.72*max(dot(n,sunDir),0.));',
        'foam shading')

    # Review defaults: coast visible first, smoke/fire remain available as toggles.
    replacements = [
        ('Ocean Mother | R018.9.1 近岸泡沫与水线候选','Ocean Mother | R018.9.2 岸线接触与湿岩候选','title'),
        ('ISLAND GOLD COAST / R018.9.1','ISLAND GOLD COAST / R018.9.2','brand'),
        ('R018.9.1 · 近岸泡沫与水线候选','R018.9.2 · 岸线接触与湿岩候选','footer'),
        ("version:'0.3.9.1-r0189-nearshore-conservative'","version:'0.3.9.2-r0189-shore-contact'",'qa version'),
        ("buildId:'r0189.1-nearshore-conservative-v001-deep-frozen'","buildId:'r0189.2-shore-contact-v001-deep-frozen'",'build id'),
        ('foamWall:1.14,foamNoise:1.42,runup:1.10,spray:.98,','foamWall:.88,foamNoise:1.22,runup:.78,spray:.72,','nearshore defaults'),
        ('smokeDensity:2.54,smokeHeight:47,wind:1.04,fire:1.06,','smokeDensity:1.65,smokeHeight:42,wind:.92,fire:.80,','smoke defaults'),
        ('waterClarity:.76,sunAngle:-.50,exposure:1.12,rockSharpness:1.18,rockContrast:1.24','waterClarity:.74,sunAngle:-.50,exposure:1.08,rockSharpness:1.06,rockContrast:1.06','material defaults'),
        ('const effects={foamWall:true,waveWall:true,curl:true,runup:true,spray:true,smoke:true,fire:true};','const effects={foamWall:true,waveWall:true,curl:true,runup:true,spray:true,smoke:false,fire:false};','review effects'),
    ]
    for old, new, label in replacements:
        s = one(s, old, new, label)

    after = {k: sha(block(s, p, k).encode()) for k, p in protected.items()}
    changed = [k for k in before if before[k] != after[k]]
    if changed:
        raise RuntimeError('protected blocks changed: ' + ', '.join(changed))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    OUT.write_text(s, encoding='utf-8')
    report = {
        'baseline': 'R018.9.1 cumulative candidate from exact R018.9',
        'baselineSha256': EXPECTED_SHA,
        'candidate': 'R018.9.2',
        'candidateSha256': sha(s.encode()),
        'scope': ['wet sand band','terrain palette/lighting','rock material/waterline only','shallow-water palette','foam blend/default review state'],
        'protected': sorted(protected),
        'protectedHashesUnchanged': True,
        'deepOceanByteIdentityInsideCandidate': before['deep'] == after['deep'],
        'rockGeometryAndDistributionUnchanged': before['rockField'] == after['rockField'],
        'smokeAndFireDefaultOffForCoastReview': True,
        'visualApproved': False,
        'productionApproved': False,
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
