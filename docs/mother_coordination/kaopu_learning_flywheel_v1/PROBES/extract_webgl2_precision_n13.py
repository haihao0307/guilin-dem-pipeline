#!/usr/bin/env python3
import html, json, pathlib, re, sys
source = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
m = re.search(r'<pre id="result">(.*?)</pre>', source, re.DOTALL)
if not m:
    e = re.search(r'<pre id="error">(.*?)</pre>', source, re.DOTALL)
    raise SystemExit(html.unescape(e.group(1)) if e else 'result node missing')
r = json.loads(html.unescape(m.group(1)))
fm, fh = r['fragment']['medium'], r['fragment']['high']
m = r['runtimeMatrix']['mediump']
h = r['runtimeMatrix']['highp']
checks = {
    'webgl2-context': 'WebGL 2.0' in r['runtime']['webglVersion'],
    'glsl-300-profile': '3.00' in r['runtime']['shadingLanguageVersion'],
    'fragment-mediump-present': fm is not None,
    'fragment-mediump-min-range': fm['rangeMin'] >= 14 and fm['rangeMax'] >= 14,
    'fragment-mediump-min-precision': fm['precision'] >= 10,
    'fragment-highp-present': fh is not None,
    'highp-retains-large-offset-phase': h['8192']['uniquePhases'] >= 128 and h['8192']['phaseRmse'] < 1e-6,
    'reported-mediump-below-highp': fm['precision'] < fh['precision'] and fm['rangeMax'] < fh['rangeMax'],
    'swiftshader-mediump-keeps-large-phase': m['8192']['uniquePhases'] >= 128 and m['8192']['phaseRmse'] < 1e-6,
    'declared-mediump-matrix-equals-highp': m == h,
}
r['checks'] = [{'id':k,'pass':v} for k,v in checks.items()]
r['summary'] = {'checks':len(checks),'passed':sum(checks.values()),'failed':len(checks)-sum(checks.values()),'status':'pass' if all(checks.values()) else 'fail'}
pathlib.Path(sys.argv[2]).write_text(json.dumps(r, indent=2)+'\n', encoding='utf-8')
if not all(checks.values()): raise SystemExit(r['summary'])
