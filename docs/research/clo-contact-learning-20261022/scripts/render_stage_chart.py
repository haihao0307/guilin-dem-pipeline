"""Render the recorded local experiment, not simulated illustrative values."""
from pathlib import Path
import json
import os
os.environ.setdefault('MPLCONFIGDIR', '/tmp/clo-contact-learning-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'evidence/local/TRACE_REVIEW.json').read_text())
rows = [r for r in data['checkpointSummary'] if r['label'] != 'done']
labels = ['Initial arrangement', 'Darts', 'Waist seams', 'Side seams', 'Shell',
          'Seam relaxation', 'Seam finishing', 'Release', 'Refinement', 'Joint refinement']
assert len(labels) == len(rows)
counts = [r['clothPairs'] for r in rows]
colors = ['#417b83'] * len(rows)
first = next((i for i, n in enumerate(counts) if n), None)
if first is not None:
    colors[first] = '#b87432'
colors[-1] = '#a7413c'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 11})
fig, ax = plt.subplots(figsize=(11.5, 7.6), dpi=160)
fig.patch.set_facecolor('#faf9f5'); ax.set_facecolor('#faf9f5')
ax.barh(range(len(rows)), counts, color=colors, height=.54)
ax.set_yticks(range(len(rows)), labels); ax.invert_yaxis()
ax.set_xlim(0, max(counts) * 1.16)
ax.set_xlabel('Intersecting triangle pairs at the saved checkpoint', labelpad=13)
for i, n in enumerate(counts):
    ax.text(n + max(counts) * .015, i, str(n), va='center', fontweight='bold', color='#20383d')
for side in ('top', 'right', 'left'):
    ax.spines[side].set_visible(False)
ax.spines['bottom'].set_color('#aeb9b8'); ax.tick_params(axis='y', length=0, pad=12)
ax.xaxis.grid(True, color='#dde3e0', linewidth=.6); ax.set_axisbelow(True)
fig.text(.055, .95, 'Where intersections are observed', fontsize=23, fontweight='bold', color='#1c343b')
fig.text(.055, .908, 'One frozen browser material mesh  /  original solver unchanged  /  stage endpoints only', fontsize=10.5, color='#52666a')
fig.text(.055, .063, 'First nonzero saved checkpoint: waist seams. Final result: 14 pairs, retained as a failure.', fontsize=10.5, color='#243f45')
fig.text(.055, .031, 'Counts do not identify the exact first collision time or prove a cause. Diagnostic time is not a performance benchmark.', fontsize=9.5, color='#627375')
fig.subplots_adjust(left=.22, right=.955, top=.855, bottom=.16)
fig.savefig(ROOT / 'STAGE_CONTACTS.png', facecolor=fig.get_facecolor())
print(ROOT / 'STAGE_CONTACTS.png')
