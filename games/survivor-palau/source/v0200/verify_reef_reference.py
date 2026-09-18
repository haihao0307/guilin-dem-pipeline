"""Bounded source/numeric check. Does not compile or execute GLSL on a GPU."""
from pathlib import Path
import json
import re
import subprocess
from reef_reference import patch_reef_reference, CPU_PATTERN, GPU_PATTERN


def check():
    base = Path(__file__).resolve().parents[2] / 'releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html'
    before = base.read_text()
    after = patch_reef_reference(before)
    extract = lambda text, pattern: re.search(pattern, text, re.S).group(0)
    old_cpu, old_gpu = extract(before, CPU_PATTERN), extract(before, GPU_PATTERN)
    cpu, gpu = extract(after, CPU_PATTERN), extract(after, GPU_PATTERN)
    # Everything outside the two intended regions must stay byte-for-byte equal:
    # includes frozen sea/sky/worker, bedHeight, terrain quality and vegetation.
    strip = lambda text: re.sub(GPU_PATTERN, '<GPU>', re.sub(CPU_PATTERN, '<CPU>', text, flags=re.S), flags=re.S)
    assert strip(before) == strip(after), 'Unrelated source changed'
    assert '.70+.30*noise2(p*.075+seed)' in old_gpu
    assert 'noise2' not in gpu

    # Inspect emitted output rather than compare templates to themselves.
    js_layout = json.loads(re.search(r'Object.freeze\((\[.*?\])\)', cpu).group(1))
    gl_layout = [[float(v) for v in row.split(',')] for row in
                 re.findall(r'q=reefOne\(p,([^)]*)\)', gpu)]
    keys = ('angle', 'offset', 'radial', 'tangent', 'depth', 'rim', 'seed')
    assert [[p[k] for k in keys] for p in js_layout] == gl_layout
    assert len(js_layout) == 5
    for name in ('irregular', 'core', 'ring'):
        js = re.search(r'const '+name+r'=([^;]+);', cpu).group(1)
        gl = re.search(r'float '+name+r'=([^;]+);', gpu).group(1)
        normalized = js.replace('Math.', '').replace('q.seed', 'seed').replace('smooth(', 'smoothstep(')
        assert normalized == gl, f'{name} expression diverged'
    assert 'Math.abs(radial)>1.24||Math.abs(tangent)>1.24' in cpu
    assert 'abs(radial)>1.24||abs(tangent)>1.24' in gpu

    # Execute the actual old/new CPU source on the island, not a hand-written
    # copy of its formula. This protects the existing bed from accidental edits.
    island = before[before.index('function islandShape('):before.index('function beachWidthAt(')]
    program = r'''
const assert=require('node:assert/strict');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const SURFACE={radius:27,roundness:.43,shelfWidth:22};
''' + island + '\n'
    program += 'const oldQuery=(()=>{'+old_cpu+'return reefBathymetry})();\n'
    program += 'const newQuery=(()=>{'+cpu+'return reefBathymetry})();\n'
    program += r'''
let samples=0,active=0;
for(let x=-90;x<=90;x+=1.25)for(let z=-90;z<=90;z+=1.25){
 const a=oldQuery(x,z),b=newQuery(x,z);assert.deepEqual(a,b);samples++;if(a.pit>0)active++;
}
console.log(JSON.stringify({samples,active,oldCpuExactlyPreserved:true}));
'''
    result = subprocess.run(['node', '-e', program], text=True, capture_output=True, check=True)
    report = json.loads(result.stdout)
    report.update(sharedEmittedParameters=True, sharedEmittedShapeExpressions=True,
                  unchangedOutsideTwoReefRegions=True, gpuExecuted=False,
                  limitation='CPU double precision and GPU floats are not claimed bit-identical; rendered-grid interpolation remains separate.')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    check()
