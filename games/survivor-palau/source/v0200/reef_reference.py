"""Generate shared authored reef-pit parameters and scalar shape expressions.

Photo G05 motivates connected shore/reef geometry; it supplies no surveyed depths.
This bounded patch retains the five existing pits and the CPU bed shape. Future
reef morphology belongs in REEF_PITS / SHAPE, not a second shader-only layout.
It does not unify rendered-triangle interpolation or implement water flow.
"""
import json
import re


REEF_PITS = (
    dict(angle=.30, offset=.72, radial=.29, tangent=.48, depth=5.2, rim=.48, seed=11),
    dict(angle=1.92, offset=.88, radial=.33, tangent=.42, depth=4.4, rim=.40, seed=23),
    dict(angle=-1.02, offset=1.05, radial=.37, tangent=.31, depth=5.8, rim=.52, seed=37),
    dict(angle=-2.28, offset=.78, radial=.27, tangent=.46, depth=3.9, rim=.36, seed=49),
    dict(angle=2.88, offset=1.18, radial=.34, tangent=.28, depth=4.8, rim=.45, seed=61),
)
# Scalar expressions have one source. Decimal literals are valid in both languages.
SHAPE = {
    'irregular': '.76+.14*sin(x*.19+seed)*sin(z*.17-seed)+.10*sin((x+z)*.31+seed*.37)',
    'core': '(1.0-smoothstep(.18,1.02,d))*irregular',
    'ring': 'exp(-pow((d-.92)/.115,2.0))*(.78+.22*sin(x*.43-z*.37+seed))',
}
CUTOFF = '1.24'
CPU_PATTERN = r'const REEF_PITS=Object\.freeze\(\[.*?\n\}\n(?=function reefPitCenters)'
GPU_PATTERN = r'vec2 reefOne\(vec2 p,.*?\n\}\n(?=float breakerWarpG)'


def _expression(name, language):
    value = SHAPE[name]
    if language == 'js':
        for source, target in [('sin', 'Math.sin'), ('exp', 'Math.exp'),
                               ('pow', 'Math.pow'), ('smoothstep', 'smooth'),
                               ('seed', 'q.seed')]:
            value = re.sub(r'\b' + source + r'\b', target, value)
    return value


def _blocks():
    layout = json.dumps(REEF_PITS, separators=(',', ':'))
    cpu = f'''const REEF_PITS=Object.freeze({layout});
function reefBathymetry(x,z,c=SURFACE){{
 let pit=0,rim=0;
 for(const q of REEF_PITS){{
  const ca=Math.cos(q.angle),sa=Math.sin(q.angle),centerR=islandRadius(q.angle,c)+c.shelfWidth*q.offset;
  const dx=x-ca*centerR,dz=z-sa*centerR;
  const radial=(dx*ca+dz*sa)/(c.shelfWidth*q.radial),tangent=(-dx*sa+dz*ca)/(c.shelfWidth*q.tangent);
  if(Math.abs(radial)>{CUTOFF}||Math.abs(tangent)>{CUTOFF})continue;
  const d=Math.hypot(radial,tangent);
  const irregular={_expression('irregular', 'js')};
  const core={_expression('core', 'js')};
  const ring={_expression('ring', 'js')};
  pit=Math.max(pit,q.depth*core);rim=Math.max(rim,q.rim*ring);
 }}
 return {{pit,rim}};
}}
'''
    gpu = f'''vec2 reefOne(vec2 p,float angle,float off,float rr,float tr,float depth,float rim,float seed){{
 float ca=cos(angle),sa=sin(angle),centerR=islandR(vec2(ca,sa))+p_shelfWidth*off;
 float x=p.x,z=p.y,dx=x-ca*centerR,dz=z-sa*centerR;
 float radial=(dx*ca+dz*sa)/(p_shelfWidth*rr),tangent=(-dx*sa+dz*ca)/(p_shelfWidth*tr);
 if(abs(radial)>{CUTOFF}||abs(tangent)>{CUTOFF})return vec2(0.0);
 float d=length(vec2(radial,tangent));
 float irregular={_expression('irregular', 'glsl')};
 float core={_expression('core', 'glsl')};
 float ring={_expression('ring', 'glsl')};
 return vec2(depth*core,rim*ring);
}}
vec2 reefBed(vec2 p){{
 vec2 v=vec2(0.0);vec2 q;
'''
    for pit in REEF_PITS:
        arguments = ','.join(str(float(pit[key])) for key in
                             ('angle', 'offset', 'radial', 'tangent', 'depth', 'rim', 'seed'))
        gpu += f' q=reefOne(p,{arguments});v=max(v,q);\n'
    gpu += ' return v;\n}\n'
    return cpu, gpu


def patch_reef_reference(html):
    """Patch only CPU pit definition/query and the non-frozen nearshore pit query.

    Reject unknown/duplicate anchors. The frozen __OM_TEXT__ is never a target.
    Apply once to the known baseline before the chapter is attached.
    """
    for pattern, block in zip((CPU_PATTERN, GPU_PATTERN), _blocks()):
        html, count = re.subn(pattern, lambda _: block, html, flags=re.S)
        if count != 1:
            raise ValueError(f'Expected one reef anchor, found {count}')
    return html
