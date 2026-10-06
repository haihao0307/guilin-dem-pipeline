"""Additional official v0.6.1 boundary, root, and pose-convention checks."""
from pathlib import Path
import json
import math
import os
import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault('ANNY_CACHE_DIR', str(ROOT.parent / 'cache'))
import anny
torch.set_num_threads(2)
model = anny.Anny(local_changes='default', facial_actions='none', phenotypes='default', skinning_method='lbs').float().eval()

def rotation(values):
    x, y, z = (math.radians(v) for v in values)
    cx, sx, cy, sy, cz, sz = math.cos(x), math.sin(x), math.cos(y), math.sin(y), math.cos(z), math.sin(z)
    return torch.tensor([[cy * cz, -cy * sz, sy], [cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy], [sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy]])

def parse_pose(values):
    out = torch.eye(4).reshape(1, 1, 4, 4).repeat(1, model.bone_count, 1, 1)
    for label, value in values.items():
        bone = model.bone_labels.index(label)
        if isinstance(value, dict) and 'matrix' in value:
            out[0, bone] = torch.tensor(value['matrix']).reshape(4, 4)
        else:
            out[0, bone, :3, :3] = rotation(value.get('rotation', [0, 0, 0]) if isinstance(value, dict) else value)
            if isinstance(value, dict):
                out[0, bone, :3, 3] = torch.tensor(value.get('translation', [0, 0, 0]))
    return out

cases = []
for i, age in enumerate([-1 / 3, 0, 1 / 3, 2 / 3, 1, -0.9, 1.8]):
    cases.append((f'age-boundary-{i}', {'phenotypes': {'age': age}}))
for gender in [0, 1]:
    for age in [-1 / 3, 0, 2 / 3, 1]:
        cases.append((f'gender-age-{gender}-{age}', {'phenotypes': {'gender': gender, 'age': age}}))
for label in ['gender', 'muscle', 'weight', 'height', 'proportions']:
    for value in [0, 1]:
        cases.append((f'{label}-endpoint-{value}', {'phenotypes': {label: value}}))
cases.append(('root-translation', {'pose': {'root': {'rotation': [0, 0, 0], 'translation': [.24, -.17, .33]}}}))
cases.append(('root-rotation-translation', {'pose': {'root': {'rotation': [21, -13, 34], 'translation': [.24, -.17, .33]}, 'neck01': [12, 16, -8]}}))
locals_to_check = ['measure-upperarm-length-incr', 'head-angle-out', 'measure-lowerleg-height-incr', 'measure-shoulder-dist-incr', 'measure-hips-circ-incr', 'measure-waist-circ-incr']
assert all(x in model.local_change_labels for x in locals_to_check)
for sign in [-1, 1]:
    cases.append((f'local-combination-{sign}', {'phenotypes': {'age': .18, 'gender': .72}, 'localChanges': {label: sign * (.23 + .06 * i) for i, label in enumerate(locals_to_check)}}))
phenotypes = {'gender': .3, 'age': .45, 'height': .63, 'weight': .22}
base_inputs = {'root': {'rotation': [15, -7, 20], 'translation': [.13, -.08, .21]}, 'upperarm01.L': [23, -32, 17], 'upperleg01.R': [-14, 18, 24]}
with torch.no_grad():
    base = model(phenotype_kwargs=phenotypes, pose_parameters=parse_pose(base_inputs))
    for mode in ['local-ref', 'local-bone', 'local-bone-world', 'world', 'world-orient']:
        converted = model.get_pose_parameterization(base, mode)[0]
        pose = {label: {'matrix': converted[i].reshape(-1).tolist()} for i, label in enumerate(model.bone_labels)}
        cases.append((f'pose-mode-{mode}', {'phenotypes': phenotypes, 'pose': pose, 'poseParameterization': mode}))

blob = bytearray()
def store(tensor):
    arr = np.asarray(tensor.cpu().numpy(), dtype='<f4')
    offset = len(blob)
    blob.extend(arr.tobytes())
    return {'byteOffset': offset, 'length': arr.size, 'shape': list(arr.shape)}

fixtures = []
with torch.no_grad():
    for name, inputs in cases:
        output = model(phenotype_kwargs=inputs.get('phenotypes', {}), local_changes_kwargs=inputs.get('localChanges', {}), pose_parameters=parse_pose(inputs.get('pose', {})), pose_parameterization=inputs.get('poseParameterization', 'local-ref'))
        fixture = {'name': name, 'inputs': inputs}
        for key, source in [('vertices', 'vertices'), ('restBonePoses', 'rest_bone_poses'), ('bonePoses', 'bone_poses')]:
            fixture[key] = store(output[source][0])
        fixtures.append(fixture)
(ROOT / 'tests/extended-fixtures.bin').write_bytes(blob)
(ROOT / 'tests/extended-fixtures.json').write_text(json.dumps({'source_commit': 'd6fc027ced5c17b6b0775dee944096ade7a9ef80', 'tolerance_max_metres': 2e-5, 'cases': fixtures}, indent=2))
print(f'Saved {len(fixtures)} extended official cases, {len(blob)} bytes')
