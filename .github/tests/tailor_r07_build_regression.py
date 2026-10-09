"""Regression for the ambiguous anchors that blocked R07 generation.
Runs the real builder twice, checks syntax and preserves reference bytes.
This is a build test, not a browser or garment-quality certificate.
"""
from pathlib import Path
import hashlib, json, subprocess, sys
R = Path(__file__).resolve().parents[2] / 'kaopu-tailor-workbench'

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

references = [R / 'catalogue' / name for name in
              ('r06-worker.bundle.mjs', 'r06-workbench-app.mjs',
               'workbench-worker.bundle.mjs', 'workbench-app.mjs')]
references += [R / 'unified/physics/kernel.ts', R / 'unified/physics/kernel.wasm',
               R / 'garments-r04/assets/body-anny-adult.json']
before = {str(p.relative_to(R)): digest(p) for p in references}
source = (R / 'catalogue/r06-worker.bundle.mjs').read_text()
source_ui = (R / 'catalogue/r06-workbench-app.mjs').read_text()
assert source.count('this.elapsed / 4') == 2
assert source_ui.count("preferredView='paper';") == 3
outputs = [R / 'catalogue/r07-worker.bundle.mjs', R / 'catalogue/r07-workbench-app.mjs']
snapshots = []
for _ in range(2):
    subprocess.run([sys.executable, str(R/'r07/build.py')], check=True)
    for p in outputs:
        subprocess.run(['node', '--check', str(p)], check=True)
    snapshots.append([digest(p) for p in outputs])
assert snapshots[0] == snapshots[1], 'Non-deterministic generation'
assert before == {str(p.relative_to(R)): digest(p) for p in references}, 'Reference bytes changed'
out = outputs[0].read_text()
base, fast = out.split('var GarmentLab2 = class extends GarmentLab {', 1)
assert base.count('this.elapsed / 4') == 1
assert 'this.elapsed / .75' not in base
assert fast.count('this.elapsed / .75') == 1
ui = outputs[1].read_text()
assert ui.count("solverMode='fast',workerMode=null;") == 1
assert ui.count("preferredView='paper';") == 2
report = {'buildPassed': True, 'javascriptSyntaxPassed': True,
          'deterministicGeneration': True, 'referenceFilesUnchanged': before,
          'declaredTarget': 'GarmentLab2.step only',
          'browserTested': False, 'garmentFitAccepted': False}
Path('tailor-r07-build-regression.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
