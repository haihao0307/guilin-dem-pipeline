"""Deterministic runtime corrections. Keep every native DEM sample and vertex.

One outstanding GPU frame prevents the render loop from blocking navigation.
Land and water share identical boundary vertices, including numeric tide motion.
Source-backed water vertices have a valid surface even where DEM is NoData.
"""
from pathlib import Path

def replace_once(text, old, new):
    if old in text:
        assert text.count(old) == 1, ('ambiguous patch', old)
        return text.replace(old, new)
    assert new in text, ('unexpected source', old)
    return text

def patch_site(site):
    site = Path(site)
    p = site / 'runtime.js'
    s = p.read_text(encoding='utf-8')
    s = replace_once(s,
        'f.valid?1:0,f.type===2?',
        '(f.valid||f.type>0)?1:0,f.type===2?')
    s = replace_once(s,
        "async function go(id){const token=(S.loadToken||0)+1;S.loadToken=token;",
        "async function go(id){const token=(S.loadToken||0)+1;S.loadToken=token;S.loading=true;try{")
    s = replace_once(s,
        'mark();draw()}\nfunction wave(',
        'mark();}finally{if(token===S.loadToken)S.loading=false;}pose(0);mark();draw()}\nfunction wave(')
    s = replace_once(s,
        'if(water){if(k<1.5)y=S.tide+wave(V[i],V[i+2],1)*.9;else if(k<2.5)y+=S.tide*Math.exp(-V[i+7]/22000)+wave(V[i],V[i+2],2)*.1}',
        'if(k>.45&&k<1.5)y=S.tide+wave(V[i],V[i+2],1)*.9;else if(k>=1.5&&k<2.5)y+=S.tide*Math.exp(-V[i+7]/22000)+wave(V[i],V[i+2],2)*.1;')
    s = replace_once(s,
        'function draw(){if(!S.gl||!S.overview?.gpu)return;let gl=S.gl,c=gl.canvas,',
        "function draw(){if(!S.gl||!S.overview?.gpu||S.loading)return false;let gl=S.gl;if(S.gpuFence){let wait=gl.clientWaitSync(S.gpuFence,0,0);if(wait===gl.TIMEOUT_EXPIRED)return false;gl.deleteSync(S.gpuFence);S.gpuFence=null;if(wait===gl.WAIT_FAILED)throw Error('GPU frame wait failed');}let now=performance.now();if(now-(S.lastSubmit||0)<33)return false;let c=gl.canvas,")
    s = replace_once(s,
        "let e=gl.getError();if(e)throw Error('WebGL error '+e);mark()}",
        "let e=gl.getError();if(e)throw Error('WebGL error '+e);S.gpuFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();S.lastSubmit=performance.now();S.renderedFrames=(S.renderedFrames||0)+1;S.renderedWindow=S.id;S.renderedWater=$('waterOn').checked;mark();return true;}")
    s = replace_once(s,
        "fullDomainNativeOnline:false,ready:S.ready,webgl2:",
        "fullDomainNativeOnline:false,ready:S.ready,loading:!!S.loading,renderedWindow:S.renderedWindow,renderedWater:S.renderedWater,renderedFrames:S.renderedFrames||0,gpuQueueDepth:S.gpuFence?1:0,webgl2:")
    s = replace_once(s,
        'S.time=now/1000;pose(dt);draw();ticks++;',
        'S.time=now/1000;pose(dt);if(draw())ticks++;mark();')
    p.write_text(s,encoding='utf-8')
    p = site / 'shaders.js'
    s = p.read_text(encoding='utf-8')
    s = replace_once(s,
        'if(uWater==1){if(aField.x<1.5)p.y=uTide+wave*.9;else if(aField.x<2.5)p.y+=uTide*exp(-aField.y/22000.)+wave*.1;}',
        'if(aField.x>.45&&aField.x<1.5)p.y=uTide+wave*.9;else if(aField.x>=1.5&&aField.x<2.5)p.y+=uTide*exp(-aField.y/22000.)+wave*.1;')
    p.write_text(s,encoding='utf-8')
    assert 'precision highp int;' in s
    assert 'sampler2D' not in s and 'TextureLoader' not in s

def patch_checks(path):
    """Wait for a submitted frame of the requested state, not just a UI flag."""
    path=Path(path)
    s=path.read_text(encoding='utf-8')
    s=replace_once(s,
        '(q?.ready && q.activeWindow===name && q.terrainSourceGrid?.[0]===size)',
        '(q?.ready && !q.loading && q.renderedWindow===name && q.activeWindow===name && q.terrainSourceGrid?.[0]===size)')
    s=replace_once(s,
        "page.wait_for_timeout(400);page.screenshot(path=str(out/f'{name}-water-off.png'))",
        "page.wait_for_function('window.__WENZHOU_V7_QA__?.renderedWater===false',timeout=30000);page.wait_for_timeout(100);page.screenshot(path=str(out/f'{name}-water-off.png'))")
    path.write_text(s,encoding='utf-8')

if __name__ == '__main__':
    import sys
    patch_site(sys.argv[1])
