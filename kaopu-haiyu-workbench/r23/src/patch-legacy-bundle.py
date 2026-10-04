"""Add observation-only hooks to an emitted copy of the R17 fish bundle.

The original file is never rewritten. Exact single-occurrence checks deliberately
fail the build if the baseline changes, rather than guessing a minified symbol.
No geometry evaluator, coefficient, input, camera, or animation code is replaced.
"""

from pathlib import Path
import argparse


COLOR = (
    's.fillStyle=A==="fish"?'
    '`rgb(${Math.round(116*y)},${Math.round(171*y)},${Math.round(154*y)})`:'
    '`rgb(${Math.round(98*y)},${Math.round(117*y)},${Math.round(110*y)})`'
)
EXPORT = 'window.KaopuExperiment={setActive:c1};'
BRIDGE = (
    'window.HaiyuLegacyFish={'
    'invalidate:()=>{W=!0},'
    'getState:()=>({active:u0,kind:A,time:z,playing:_,yaw:H,pitch:Y,surface:h0}),'
    'setSurface:value=>{h0=!!value;'
    'R("expSurface").setAttribute("aria-pressed",String(h0));W=!0},'
    'snapshot:()=>U?JSON.parse(JSON.stringify(U)):null'
    '};'
)


def patch(text: str) -> str:
    """Return a copy with a face-normal shader callback and observation bridge."""
    assert 'window.HaiyuLegacyFish=' not in text, 'Legacy bundle already patched'
    assert text.count(COLOR) == 1, 'Expected exactly one original fish face shader'
    assert text.count(EXPORT) == 1, 'Expected exactly one original experiment export'
    original_color = COLOR.removeprefix('s.fillStyle=')
    replacement = (
        's.fillStyle=A==="fish"&&window.HaiyuLegacyObservation?.shadeFish?'
        'window.HaiyuLegacyObservation.shadeFish(x,w,H,Y):(' + original_color + ')'
    )
    return text.replace(COLOR, replacement, 1).replace(EXPORT, BRIDGE + EXPORT, 1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.input.resolve() != args.output.resolve(), 'Refuse to overwrite baseline'
    args.output.write_text(patch(args.input.read_text(encoding='utf-8')), encoding='utf-8')
