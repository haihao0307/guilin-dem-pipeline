import pathlib,gzip,json,math,hashlib
ROOT=pathlib.Path(__file__).resolve().parent
report=json.loads((ROOT/'data/BATCH_REPORT.json').read_text(encoding='utf8'));checks=[]
for row in report['rows']:
    raw=(ROOT/'data'/row['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
    data=json.loads(gzip.decompress(raw));spec=data['spec'];panels={p['id']:p for p in spec['panels']};seams=spec['seams'];originals=[s for s in seams if not s.get('isInternalReinforcement')];inner=[s for s in seams if s.get('isInternalReinforcement')]
    assert len(originals)==len(inner)==row['reinforcedSeams']==row['primarySeams'];assert len({s['parentSeamId'] for s in inner})==len(originals)
    positions=data.get('record',{}).get('positionsMm') or [data['checkpoint']['positionsM'][i:i+3] for i in range(0,len(data['checkpoint']['positionsM']),3)]
    assert len(positions)==sum(len(p['uvMm']) for p in panels.values());assert all(math.isfinite(x) for v in positions for x in v)
    stages={s['id']:s for s in spec['stages']};active=set(data.get('record',{}).get('activeSeams',[]))
    for seam in inner:
        parent=next(s for s in originals if s['id']==seam['parentSeamId']);assert seam['stageId']==parent['stageId']+'__reinforce';assert parent['stageId'] in stages[seam['stageId']]['requires'];assert len(seam['stitchVertexPairs'])>=2
        for side in ['a','b']:
            ref=seam[side];p=panels[ref['panelId']];assert all(0<=i<len(p['uvMm']) for i in p['edges'][ref['edge']]);assert all(i>=p['reinforcementCut']['originalMaterialVertexCount'] for i in p['edges'][ref['edge']])
    for p in panels.values():
        cut=p['reinforcementCut'];assert not cut['originalCoordinatesScaled'];assert cut['newCutAreaMm2']>cut['originalNetAreaMm2']>0
        area=0
        for tri in p['triangles']:
            assert len(set(tri))==3 and all(0<=i<len(p['uvMm']) for i in tri)
            a,b,c=[p['uvMm'][i] for i in tri];signed=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;assert signed>0;area+=signed
        assert abs(area-cut['newCutAreaMm2'])<max(.01,area*1e-8)
    if data.get('record'):assert all(s['id'] in active for s in seams)
    checks.append({'id':row['id'],'complete':row['complete'],'staticPassed':row['staticPassed'],'materialPanels':len(panels),'primarySeams':len(originals),'innerRows':len(inner),'actual3D':True,'rowsActive':bool(data.get('record')),'warmSourceAnalyticDifferenceMm':data.get('warmStart',{}).get('maxAnalyticDifferenceMm')})
result={'styles':len(checks),'complete':sum(r['complete'] for r in checks),'staticPassed':sum(r['staticPassed'] for r in checks),'originalSeams':sum(r['primarySeams'] for r in checks),'innerRows':sum(r['innerRows'] for r in checks),'checks':checks}
(ROOT/'qa/structural-report.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print({k:v for k,v in result.items() if k!='checks'})
