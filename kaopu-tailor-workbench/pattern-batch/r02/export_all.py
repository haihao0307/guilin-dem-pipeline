"""Export material triangles and inner stitch paths without moving vertices."""
import gzip,json,pathlib,zipfile,hashlib
ROOT=pathlib.Path(__file__).resolve().parent
report=json.loads((ROOT/'data/BATCH_REPORT.json').read_text(encoding='utf8'))
export=ROOT/'data/obj';export.mkdir(exist_ok=True)
manifest=[]
for row in report['rows']:
    if not row.get('has3D'):continue
    raw=(ROOT/'data'/row['file']).read_bytes();assert hashlib.sha256(raw).hexdigest()==row['sha256']
    packet=json.loads(gzip.decompress(raw));record=packet.get('record');flat=packet.get('checkpoint',{}).get('positionsM')
    points=record['positionsMm'] if record else [[x*1000 for x in flat[i:i+3]] for i in range(0,len(flat),3)]
    lines=[f'# {row["id"]}: {row["name"]}', '# Units: metres; exact cloth material particles, no display deformation.',f'# Sewing complete: {bool(record)}; static accepted: {row["staticPassed"]}',f'# Source result SHA256: {row["sha256"]}']
    lines += ['v '+' '.join(format(x/1000,'.12g') for x in p) for p in points]
    panels={p['id']:p for p in packet['spec']['panels']};offsets={};offset=0
    for p in panels.values():
        offsets[p['id']]=offset;lines.append('g '+p['id'])
        lines+=['f '+' '.join(str(i+offset+1) for i in t) for t in p['triangles']];offset+=len(p['uvMm'])
    assert offset==len(points)
    for seam in packet['spec']['seams']:
        if not seam.get('isInternalReinforcement'):continue
        ref=seam['a'];indices=panels[ref['panelId']]['edges'][ref['edge']]
        lines+=['g inner_stitch_'+seam['id'],'l '+' '.join(str(i+offsets[ref['panelId']]+1) for i in indices)]
    file=export/(row['id']+'.obj');file.write_text('\n'.join(lines)+'\n',encoding='utf8')
    manifest.append({'id':row['id'],'name':row['name'],'file':file.name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'vertices':offset,'triangles':sum(len(p['triangles']) for p in panels.values()),'innerRows':row['reinforcedSeams'],'complete':bool(record),'staticPassed':row['staticPassed']})
(export/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(export/'说明.txt').write_text('全部模型使用米为单位，含实际裁片三角面和内侧补强线分组。模型来自对应的裁片缝合求解结果。请查看 MANIFEST.json 的完成状态；已生成三维不等于材料、碰撞、动态穿着检查通过。补强车缝线参与求解，但抗撕裂参数尚未实物标定。\n',encoding='utf8')
archive=ROOT/'data/60款三维服装_OBJ.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for file in sorted(export.iterdir()):z.write(file,'60款三维服装/'+file.name)
print('EXPORTED',len(manifest),archive.stat().st_size)
