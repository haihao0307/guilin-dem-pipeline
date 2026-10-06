"""Regenerate deterministic SO(3) parity fixtures with official Anny's roma dependency."""
from pathlib import Path
import json
import numpy as np
import torch
import roma

out = Path(__file__).with_name('procrustes-fixtures.json')
rng = np.random.default_rng(610461)
matrices = [np.eye(3), np.zeros((3, 3)), np.diag([3., 2., -1.]), np.diag([1., 1., -1.])]
names = ['identity', 'zero-nonunique', 'negative-determinant', 'reflection-nonunique']
for i in range(160):
    matrix = rng.normal(size=(3, 3))
    if i >= 96:
        u, _, v = np.linalg.svd(matrix)
        singular = np.array([1., 10 ** rng.uniform(-10, -2), 10 ** rng.uniform(-12, -6)])
        if i % 2: singular[-1] *= -1
        matrix = u @ np.diag(singular) @ v
    matrices.append(matrix)
    names.append(f'random-{i}')
cases = []
for name, matrix in zip(names, matrices):
    rotation = roma.special_procrustes(torch.tensor(matrix, dtype=torch.float64)).numpy()
    cases.append({'name': name, 'matrix': matrix.reshape(-1).tolist(), 'rotation': rotation.reshape(-1).tolist(), 'objective': float(np.sum(matrix * rotation))})
out.write_text(json.dumps({'generator': 'roma.special_procrustes, torch.float64', 'cases': cases}, indent=2))
print(f'Saved {len(cases)} Procrustes fixtures to {out.name}')
