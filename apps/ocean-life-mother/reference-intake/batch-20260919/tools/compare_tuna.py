"""Compare two provided source variants by semantics and every decoded accessor.
Equal source identities are not evidence for two different species.
"""
import json
import numpy as np
from audit_glb_batch import glb,accessor,ROOT,INPUT_DIR
A=glb(INPUT_DIR/'tuna_fish.glb')[:2]
B=glb(INPUT_DIR/'tuna_fish (1)(1).glb')[:2]
checks={k:A[0].get(k)==B[0].get(k)for k in ['asset','nodes','meshes','skins','animations','materials','textures','samplers','scenes','accessors']}
checks['accessorValuesExact']=len(A[0]['accessors'])==len(B[0]['accessors'])and all(np.array_equal(accessor(*A,i),accessor(*B,i))for i in range(len(A[0]['accessors'])))
checks['count']=len(A[0]['accessors'])
(ROOT/'qa').mkdir(parents=True,exist_ok=True)
(ROOT/'qa/TUNA_COMPARISON.json').write_text(json.dumps(checks,indent=2))
print(json.dumps(checks,indent=2))
