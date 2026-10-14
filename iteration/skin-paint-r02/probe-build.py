from pathlib import Path
root=Path('iteration/skin-paint-r02')
p=Path('kaopu-unified-human-workbench/skin-paint-r02/preview.html')
s=p.read_text()
probe=(root/'coordinate-probe.cjs').read_text().replace('module.exports=','window.__PAINT_COORDINATE_READ__=',1)
anchor='/* SSG-01 kernel 2:'
assert s.count(anchor)==1
s=s.replace(anchor,probe+'\n'+anchor,1)
anchor='ready=true;readyAt='
assert s.count(anchor)==1
s=s.replace(anchor,'ready=true;window.__PAINT_COORDINATES__=window.__PAINT_COORDINATE_READ__();readyAt=',1)
anchor='field:fieldReport,shader:'
assert s.count(anchor)==1
s=s.replace(anchor,'coordinates:window.__PAINT_COORDINATES__,field:fieldReport,shader:',1)
p.write_text(s)
print('Temporary read-only coordinate report added; not for publication.')