"""Read JSON only; never import/run the teacher's Python or Rhino code."""
import json,hashlib,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]; src=Path(sys.argv[1]); lock=json.loads((src/'source-lock.json').read_text()); result=[]
for name in ['barrel','cross']:
 p=src/(name+'-final.json'); blob=p.read_bytes(); d=json.loads(blob); items=[]
 for item in d['scene']['data']['items']:
  data=item['data']; vv=data.get('vertex',{}); defaults=data.get('default_vertex_attributes',{}); vertices=[(k,{**defaults,**v}) for k,v in vv.items()]; supports=[{'id':k,'xyz':[v.get(a,0) for a in 'xyz']} for k,v in vertices if v.get('is_support')]
  bounds={a:[min(v.get(a,0) for _,v in vertices),max(v.get(a,0) for _,v in vertices)] for a in 'xyz'}
  edges=data.get('edgedata',{}); constraints=sorted({(v.get('hmin'),v.get('hmax')) for v in edges.values() if 'hmin' in v or 'hmax' in v},key=str)
  items.append({'type':item['dtype'],'vertices':len(vv),'bounds':bounds,'supports':supports,'horizontalConstraintPairs':constraints,'reactionFieldsPresent':any('_rz'in v for v in vv.values())})
 result.append({'teacher':name,'sha256':hashlib.sha256(blob).hexdigest(),'items':items})
out={'commit':lock['commit'],'readMode':'JSON parsing only; no third-party code executed','examples':result,'authoredRule':{'representation':'vaultSpec(spanX,spanZ,spring,rise,cornerSupports) + groinHeight + archProfile','dimensionsAreOurOwn':True,'reproducesTeacherEquilibrium':False,'comparison':'Preserve explicit support topology and boundary/span/rise inputs; our elliptical envelope is geometric, not a TNA force-equilibrium solver','runtimeImportsOriginalData':False}}
(root/'design/teacher-comparison.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
