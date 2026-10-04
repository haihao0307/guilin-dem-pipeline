"""Add observation-only hooks to an emitted copy of the R17 fish bundle.

The original file is never rewritten. Exact single-occurrence checks deliberately
fail the build if the baseline changes, rather than guessing a minified symbol.
No geometry evaluator, coefficient, input, or animation code is replaced. A
separate zoom multiplier is applied only by the observation projector.
"""

from pathlib import Path
import argparse


COLOR = (
    's.fillStyle=A==="fish"?'
    '`rgb(${Math.round(116*y)},${Math.round(171*y)},${Math.round(154*y)})`:'
    '`rgb(${Math.round(98*y)},${Math.round(117*y)},${Math.round(110*y)})`'
)
EXPORT = 'window.KaopuExperiment={setActive:c1};'
SCALE = 'let o=Math.min(s*.8,n*(w==="orbit"?1.65:1.35));'
CAMERA_STATE = 'A="feather",z=0,u0=!1,_=!1,w0=!0,h0=!1,H=.4,Y=.3,l0=0,U=null,W=!0,G=null'
BRIDGE = (
    'var haiyuFishZoom=1;'
    'window.HaiyuLegacyFish=Object.freeze({'
    'invalidate:()=>{W=!0},'
    'getState:()=>({active:u0,kind:A,time:z,playing:_,yaw:H,pitch:Y,zoom:haiyuFishZoom,surface:h0}),'
    'getCamera:()=>({yaw:H,pitch:Y,zoom:haiyuFishZoom}),'
    'setCamera:camera=>{'
    'if(Number.isFinite(camera?.yaw))H=camera.yaw;'
    'if(Number.isFinite(camera?.pitch))Y=Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch));'
    'if(Number.isFinite(camera?.zoom))haiyuFishZoom=Math.max(.62,Math.min(2.25,camera.zoom));'
    'W=!0},'
    'cancelDrag:()=>{G=null},'
    'setSurface:value=>{h0=!!value;'
    'R("expSurface").setAttribute("aria-pressed",String(h0));W=!0},'
    'snapshot:()=>U?JSON.parse(JSON.stringify(U)):null'
    '});'
)


def patch(text: str) -> str:
    """Return a copy with a face-normal shader callback and observation bridge."""
    assert 'window.HaiyuLegacyFish=' not in text, 'Legacy bundle already patched'
    assert text.count(COLOR) == 1, 'Expected exactly one original fish face shader'
    assert text.count(EXPORT) == 1, 'Expected exactly one original experiment export'
    assert text.count(SCALE) == 1, 'Expected exactly one original observation scale'
    assert text.count(CAMERA_STATE) == 1, 'Expected exactly one original fish camera state'
    original_color = COLOR.removeprefix('s.fillStyle=')
    replacement = (
        's.fillStyle=A==="fish"&&window.HaiyuLegacyObservation?.shadeFish?'
        'window.HaiyuLegacyObservation.shadeFish(x,w,H,Y):(' + original_color + ')'
    )
    return (text.replace(COLOR, replacement, 1)
            .replace(SCALE, SCALE[:-1] + '*(w==="orbit"?haiyuFishZoom:1);', 1)
            .replace(EXPORT, BRIDGE + EXPORT, 1))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.input.resolve() != args.output.resolve(), 'Refuse to overwrite baseline'
    args.output.write_text(patch(args.input.read_text(encoding='utf-8')), encoding='utf-8')
