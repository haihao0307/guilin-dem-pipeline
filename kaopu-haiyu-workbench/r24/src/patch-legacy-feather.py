"""Expose an observation-only camera bridge in an emitted R18 feather copy.

The original file is immutable. No evaluator, animation clock, or input changes:
the sole insertion exports existing camera fields and a render invalidation flag.
"""

from pathlib import Path
import argparse


EXPORT = "window.KaopuExperiment={setActive(value,next){"
CAMERA_STATE = "neutral:false,yaw:.58,pitch:.25,zoom:1,last:0,dirty:true,drag:null,packet:null,packetKey:''"
PROJECTOR = "scale=Math.min(w*.80/dx,h*.82/dy)*state.zoom"
BRIDGE = (
    'window.HaiyuLegacyFeather=Object.freeze({'
    'invalidate:()=>{state.dirty=true},'
    'getState:()=>({active:state.active,kind:"feather",time:state.t,playing:state.playing,'
    'yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,neutral:state.neutral}),'
    'getCamera:()=>({yaw:state.yaw,pitch:state.pitch,zoom:state.zoom}),'
    'setCamera:camera=>{'
    'if(Number.isFinite(camera?.yaw))state.yaw=camera.yaw;'
    'if(Number.isFinite(camera?.pitch))state.pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,camera.pitch));'
    'if(Number.isFinite(camera?.zoom))state.zoom=Math.max(.62,Math.min(2.25,camera.zoom));'
    'state.dirty=true},'
    'cancelDrag:()=>{state.drag=null},'
    'snapshot:()=>state.packet?JSON.parse(JSON.stringify(state.packet)):null'
    '});\n'
)


def patch(text: str) -> str:
    assert 'window.HaiyuLegacyFeather=' not in text, 'Legacy feather already patched'
    assert text.count(EXPORT) == 1, 'Expected exactly one feather experiment export'
    assert text.count(CAMERA_STATE) == 1, 'Expected exactly one original camera state'
    assert text.count(PROJECTOR) == 1, 'Expected exactly one original zoom projector'
    return text.replace(EXPORT, BRIDGE + EXPORT, 1)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    assert args.input.resolve() != args.output.resolve(), 'Refuse to overwrite baseline'
    args.output.write_text(patch(args.input.read_text(encoding='utf-8')), encoding='utf-8')
