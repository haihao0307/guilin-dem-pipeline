from pathlib import Path
import json,hashlib,math
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
p=Path(__file__).resolve().parents[1]
e=p/'evidence/diagnosis-02'
q=json.loads((e/'qa.json').read_text())
summary={'qaSHA256':hashlib.sha256((e/'qa.json').read_bytes()).hexdigest(),'completed':q['completed'],'tests':len(q['tests']),'frames':len(q['frames']),'failure':q.get('failure'),'errors':{k:len(q[k]) for k in ['pageErrors','consoleErrors','failedRequests','resourceErrors']}}
print(json.dumps(summary,indent=2))
if not q['completed']: raise SystemExit(1)
for name in ['neutral-macro','jaw-macro','jaw-oblique','speak-macro','pucker-oblique']:
 d=json.loads((e/(name+'-envelope-stage.json')).read_text())['lastCompleted']
 print(name,json.dumps({'counts':d['counts'],'delta':d['displacement'],'central':{k:{a:b for a,b in v.items() if a not in ['edges','classification']} for k,v in d['v005CentralRegions'].items()}}))
 g=json.loads((e/(name+'-geometry.json')).read_text())
 print('sections',name,json.dumps({k:{'vertices':g[k]['vertices'],'sections':[{'u':s['u'],'segments':s['totalSegments'],'truncated':s['truncated']} for s in g[k]['sections']]} for k in ['native','draw']}))
for pose in ['jaw-macro','speak-macro']:
 g=json.loads((e/(pose+'-geometry.json')).read_text())
 fig,axes=plt.subplots(2,3,figsize=(12,8),layout='constrained')
 for row,domain in enumerate(['native','draw']):
  d=g[domain]; vertices={v['id']:v for v in d['vertexSemantics']}
  for col,s in enumerate(d['sections']):
   ax=axes[row,col]; skin=[]; oral=[]; hard=[]; mixed=[]
   for seg in s['segments']:
    types=[vertices[i]['csType'][0] for i in seg['vertexIDs']]
    coords=[[h['mouthMM'][2],h['mouthMM'][1]] for h in seg['endpoints']]
    if all(t<.5 for t in types):
     o=sum((h['attributes']['l19Oral'] or [0])[0] for h in seg['endpoints'])/2
     (oral if o>.5 else skin).append(coords)
    elif all(.5<t<3.5 for t in types):hard.append(coords)
    else:mixed.append(coords)
   for lines,color,label in [(skin,'#c76e66','skin / lip (oral <= .5)'),(oral,'#334fa5','oral > .5 (engineering label)'),(hard,'#71787a','teeth / gum / tongue'),(mixed,'#999999','mixed / other')]:
    if lines:ax.add_collection(LineCollection(lines,colors=color,linewidths=.8,label=label))
   ax.set_xlim(-25,20);ax.set_ylim(-35,22);ax.set_aspect('equal');ax.grid(alpha=.18);ax.set_title(f'{domain}, mouth-x u={s["u"]:+.2f}')
   ax.set_xlabel('front position from current mouth center (mm)');ax.set_ylabel('up position (mm)')
   if row==0 and col==0:ax.legend(fontsize=6,loc='lower left')
 fig.suptitle(pose+' | actual indexed triangle-plane sections\nAttribute coordinates before GPU-only transforms; semantic thresholds are not tissue thickness.',fontsize=11)
 out=p/'research'/('diagnosis-02-'+pose+'-sections.png');fig.savefig(out,dpi=150);plt.close(fig);print('PLOT',out)
