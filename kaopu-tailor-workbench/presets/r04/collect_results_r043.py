"""Adopt exact worker outcomes; incomplete states never enter the completed-result table."""
from pathlib import Path
import gzip,json,hashlib,os
P=Path(__file__).parent;A=P/'assets';I=A/'results/index.json';old=json.loads(I.read_text());index=json.loads(I.read_text());readiness=json.loads((A/'readiness.json').read_text());cat=json.loads((A/'catalogue.json').read_text())['rows'];index.setdefault('checkpoints',{})
sha=lambda b:hashlib.sha256(b).hexdigest();summary=[];preserved={id:r['sha256'] for id,r in old['rows'].items() if r['qualityPassed']}
for r in cat:
 id=r['id'];path=P/'batch-r043'/(id+'.json.gz')
 if id in preserved:
  assert sha((A/'results'/old['rows'][id]['file']).read_bytes())==preserved[id];continue
 if not path.exists():
  index['rows'].pop(id,None);index['failed'][id]={'phase':'audit-timeout','reason':'审计计算未完成。没有把旧结果或不存在的新图标为当前成衣。'};continue
 d=json.loads(gzip.decompress(path.read_bytes()));spec=d.get('spec');summary.append({'id':id,'complete':bool(d.get('record')),'reason':d.get('error'),'stages':d.get('stages',[]),'seconds':d.get('elapsedSeconds')})
 if spec:
  readiness['rows'][id]={'status':'native-material-ready','vertices':sum(len(p['uvMm']) for p in spec['panels']),'reason':None,'budget':spec['source']['meshing'].get('budgetPolicy')}
 else:readiness['rows'][id]={'status':'native-material-rejected','reason':d.get('error')}
 if d.get('record'):
  assert d['record'].get('nativeBinding')==d['binding'],'native worker record lost its binding'
  packet={k:d[k] for k in ['binding','spec','record']};packet.update(sourceRun=os.environ.get('GITHUB_SHA'),complete=True)
  raw=gzip.compress(json.dumps(packet,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)
  (A/'results'/(id+'.json.gz')).write_bytes(raw);index['rows'][id]={'file':id+'.json.gz','sha256':sha(raw),'qualityPassed':bool(d['record']['staticGate']['passed']),'thumb':id+'.png','thumbReady':False,'kind':'NATIVE_R043_SOLVER_OUTPUT','person':d['binding']['person']};index['failed'].pop(id,None);index['checkpoints'].pop(id,None)
 else:
  index['rows'].pop(id,None);index['failed'][id]={'phase':d.get('phase','solve-aborted'),'reason':d.get('error','未完成'),'kind':'UNFINISHED_NOT_A_GARMENT'}
  if d.get('checkpoint'):
   cp=d['checkpoint'];cp['reason']=d.get('error');raw=gzip.compress(json.dumps(cp,ensure_ascii=False,separators=(',',':')).encode(),mtime=0);name=id+'-checkpoint.json.gz';(A/'results'/name).write_bytes(raw);index['checkpoints'][id]={'file':name,'sha256':sha(raw),'thumb':id+'-checkpoint.png','thumbReady':False,'complete':False,'qualityPassed':False}
index['sourceCommit']=os.environ.get('GITHUB_SHA');index['source']='native-r043-original-patterns-and-material-circuit';I.write_text(json.dumps(index,ensure_ascii=False,indent=2))
readiness['summary']={'originalPapers':60,'nativeMaterialsReady':sum(r['status']=='native-material-ready' for r in readiness['rows'].values()),'nativeMaterialRejected':sum(r['status']!='native-material-ready' for r in readiness['rows'].values()),'actualSolverRecords':len(index['rows']),'staticGatePassedRecords':sum(r['qualityPassed'] for r in index['rows'].values()),'finiteCheckpoints':len(index['checkpoints']),'all60GarmentsAccepted':False};(A/'readiness.json').write_text(json.dumps(readiness,ensure_ascii=False,indent=2))
report={'sourceCommit':os.environ.get('GITHUB_SHA'),'previousSummary':{'records':len(old['rows']),'passed':len(preserved)},'summary':readiness['summary'],'priorPassingRecordSHA256Preserved':preserved,'newStaticPassIds':[i for i,r in index['rows'].items() if r['qualityPassed'] and i not in preserved],'trials':summary,'allSourcePaperSHA256':{r['id']:sha((P/r['nativePaper']).read_bytes()) for r in cat},'fullPhysicalCertification':False}
(P/'FITTING_SWEEP_R043.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('SUMMARY',readiness['summary'],flush=True)
