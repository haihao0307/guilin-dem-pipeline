import concurrent.futures,gzip,hashlib,json,pathlib,subprocess,time,os
ROOT=pathlib.Path(__file__).resolve().parent
catalogue=json.loads((ROOT/'../r01/data/catalogue.json').read_text(encoding='utf8'))
output=ROOT/'data/results';output.mkdir(parents=True,exist_ok=True)
deadline=time.monotonic()+2.7*3600
def solve(row):
    pid=row['id'];target=output/(pid+'.json.gz');log=output/(pid+'.log')
    if not target.exists():
        if time.monotonic()>deadline:return {'id':pid,'error':'Overall task deadline reached'}
        with log.open('w',encoding='utf8') as f:
            subprocess.run(['node',str(ROOT/'solve_one.mjs'),pid,str(target)],stdout=f,stderr=subprocess.STDOUT,timeout=570)
    if not target.exists():return {'id':pid,'error':log.read_text(encoding='utf8')[-1600:]}
    data=json.loads(gzip.decompress(target.read_bytes()));spec=data.get('spec')
    return {'id':pid,'name':row['name'],'category':row['category'],'file':'results/'+target.name,
        'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'complete':bool(data.get('record')),
        'has3D':bool(data.get('record') or data.get('checkpoint')),'staticPassed':data.get('record',{}).get('staticGate',{}).get('passed',False),
        'failures':data.get('record',{}).get('staticGate',{}).get('failures',[]),'error':data.get('error'),
        'seconds':data.get('seconds'),'primarySeams':spec.get('source',{}).get('internalReinforcement',{}).get('primarySeams') if spec else None,
        'reinforcedSeams':spec.get('source',{}).get('internalReinforcement',{}).get('reinforcedSeams') if spec else None,
        'vertices':sum(len(p['uvMm']) for p in spec['panels']) if spec else 0}
report={'schema':'kaopu-60-garments-3d-batch@1','sourcePatternBatch':'R01','scope':'fresh native source sewing with added allowance and second internal row; no material calibration or dynamic wear certificate','requested':60,'rows':[]}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    futures={pool.submit(solve,row):row for row in catalogue['rows']}
    for future in concurrent.futures.as_completed(futures):
        try:row=future.result()
        except Exception as error:row={'id':futures[future]['id'],'error':str(error),'has3D':False,'complete':False}
        report['rows'].append(row);report['count']=len(report['rows']);report['completeCount']=sum(r.get('complete',False) for r in report['rows']);report['has3DCount']=sum(r.get('has3D',False) for r in report['rows']);report['staticPassedCount']=sum(r.get('staticPassed',False) for r in report['rows'])
        (ROOT/'data/BATCH_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        print(json.dumps({k:v for k,v in row.items() if k not in ['name','category']},ensure_ascii=True),flush=True)
report['rows'].sort(key=lambda r:next(i for i,x in enumerate(catalogue['rows']) if x['id']==r['id']))
(ROOT/'data/BATCH_REPORT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('BATCH FINISHED',report['has3DCount'],report['completeCount'],report['staticPassedCount'],flush=True)
