"""R13C.3 recovery: compact whorl sampling and shared, low-emergence spiral guides.
Run after prepare.py and refine.py. No cap, extra strands, root relocation,
framebuffer opacity change, or edits outside this new candidate directory.
"""
from pathlib import Path
p=Path(__file__).resolve().parent

def change(s,a,b):
    if b in s:return s
    assert a in s,'Missing R13C.2 anchor '+a[:100]
    return s.replace(a,b)

# Keep the preceding @2 migration idempotent on already-published @3 topology.
f=p/'refine.py';r=f.read_text()
line=next((x for x in r.splitlines() if x.startswith("s=patch(s,'dx=root")),None)
if line and 'if "R13C-topology@3" not in s:' not in r:
 r=r.replace(line,'if "R13C-topology@3" not in s:\n '+line);f.write_text(r)

f=p/'src/GroomTopology.js';s=f.read_text()
s=change(s,'turn=.32+1.15*Math.exp(-Math.pow(rad/.021,2))', 'turn=.32+1.20*Math.exp(-Math.pow(rad/.038,4))*Math.exp(-Math.pow(Math.hypot(p[0]-root[0],p[2]-root[2])/.030,2))')
s=change(s,'if(rad<.0015){x+=.10;z+=.08;}', 'const core=1-smooth(.0003,.0018,rad);x+=.06*core;z+=.04*core;')
s=s.replace('R13C-topology@2','R13C-topology@3')
if 'export function crownWeight' not in s:s+='''
// Adaptive guide sampling resolves a high-curvature flow without changing roots.
export function crownWeight(p){return Math.exp(-Math.pow(Math.hypot(p[0]+.008,p[2]-.005)/.038,4))*smooth(.350,.380,p[1]);}
export function guideSpacingAt(p){const r=Math.hypot(p[0]+.008,p[2]-.005);return mix(.008,mix(.003,.008,smooth(.018,.055,r)),smooth(.350,.380,p[1]));}
'''
f.write_text(s)

f=p/'src/LengthKernel.js';s=f.read_text()
s=change(s,'import {partSign,canInterpolate,','import {crownWeight,guideSpacingAt,partSign,canInterpolate,')
s=change(s,'const ids=[],bins=new Map(),key=', 'const ids=[],guideRadii=[],bins=new Map(),key=')
s=change(s,'c=Array.from(p,v=>Math.floor(v/spacing));let near=false;', 'c=Array.from(p,v=>Math.floor(v/spacing)),localSpacing=Math.min(spacing,guideSpacingAt(p));let near=false;')
s=change(s,'if(Math.hypot(...sub(p,q))<spacing)', 'if(Math.hypot(...sub(p,q))<Math.max(localSpacing,guideRadii[id]))')
s=change(s,'if(!near){ids.push(i);const k=', 'if(!near){ids.push(i);guideRadii[i]=localSpacing;const k=')
s=change(s,'direction=unit(add(tan,mul(n,.35)));','direction=unit(add(tan,mul(n,.35-.24*crownWeight(root))));')
s=change(s,'1-.45*Math.exp(-Math.pow(Math.hypot(root[0]+.008,root[2]-.005)/.022,2))','1-.78*crownWeight(root)')
s=change(s,'requestedLength:length};', 'requestedLength:length,rootFlow:fieldDirection(root,root,d)};')
s=change(s,'side=partSide(root,d);for(let i=0;i<gs.length;i++)', 'side=partSide(root,d),cw=crownWeight(root),flow=fieldDirection(root,root,d);for(let i=0;i<gs.length;i++)')
s=change(s,'dist=dot(delta,delta);if(dist>=ds[2])continue;if(!canInterpolate', 'dist=dot(delta,delta)*(1+5*cw*Math.pow(1-clamp(dot(flow,g.rootFlow),-1,1),2));if(dist>=ds[2])continue;if(!canInterpolate')
f.write_text(s)

for rel in ['src/app.js','index.html','package.py']:
 f=p/rel;s=f.read_text().replace('R13C.2','R13C.3');f.write_text(s)
f=p/'tests/browser.mjs';s=f.read_text()
s=change(s,"const styles=publicMode?['textured-fringe','side-flow']:['textured-fringe','side-flow','curtain-layer'];", "const styles=['textured-fringe','side-flow','curtain-layer'];")
s=change(s,"publicMode?['left']:['front','left','back','top']", "publicMode?['left','top']:['front','left','back','top']")
s=change(s,"check('style buttons produce distinct geometries',", "check('compact crown flow and adaptive guides are really running',d.topology.version==='R13C-topology@3'&&d.guideCount>675,{version:d.topology.version,guides:d.guideCount});\n check('style buttons produce distinct geometries',")
f.write_text(s)
f=p/'README.md';s=f.read_text()
if '## R13C.3 recovery' not in s:s+='''
## R13C.3 recovery

R13C.2 build e8bd818726cdfb2c85abe1366c229816314178ab and run 38129669156 finished successfully while the conversation was interrupted. Actual top-view inspection still showed an overly wide radial crown exposure. Do not confuse browser success with visual acceptance.

The new crown uses a near-tangential root direction that relaxes along the guide instead of radial spokes and excessive root puff. Adaptive 3–8 mm guide spacing and local orientation-aware guide selection resolve the curved region; the same potential roots and single dense strand mesh are retained. Crown-root emergence and lift are reduced in that same local field, not hidden by a scalp cap, black material or cloned lower layer.

The existing public browser matrix now also opens all three styles and their top views; prior versions and original workbenches remain unchanged. Local Node tests can execute. The recovery container blocks browser navigation with ERR_BLOCKED_BY_ADMINISTRATOR, so actual browser rendering remains in the existing GitHub Actions runner. No local render claim is made.

References checked on 2026-10-11: SideFX Guide Groom and Fur workflow (localized masks, compatible guide interpolation, no deletion at group labels), and AMD GPUOpen TressFX (high-quality coverage and simulation are distinct systems). This is our bounded static adaptation, not an embedded Houdini, TressFX, Perm or CUDA solver.
'''
f.write_text(s)
print('R13C.3 compact whorl refinement applied')
