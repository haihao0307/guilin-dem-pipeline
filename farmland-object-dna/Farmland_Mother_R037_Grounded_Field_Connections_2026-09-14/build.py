from pathlib import Path
import re,hashlib,json
root=Path(__file__).resolve().parent
source=root/'source'
world=(source/'world.mjs').read_text(encoding='utf-8')
names=re.findall(r'export\s+(?:const|function)\s+(\w+)',world)
wrapped='const W=(()=>{\n'+world.replace('export ','')+'\nreturn {'+','.join(names)+'};\n})();\n'
scene=(source/'scene.mjs').read_text(encoding='utf-8').replace("import * as W from './world.mjs';",'')
html=(source/'index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="style.css">','<style>\n'+(source/'style.css').read_text(encoding='utf-8')+'\n</style>')
script=wrapped+scene
html=html.replace('<script type="module" src="scene.mjs"></script>','<script type="module">\n'+script+'\n</script>')
out=root/'public';out.mkdir(exist_ok=True)
(out/'index.html').write_text(html,encoding='utf-8',newline='\n')
(root/'qa/bundled-syntax.mjs').write_text(script,encoding='utf-8',newline='\n')
sources={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in source.iterdir() if p.is_file()}
receipt={'version':'FARMLAND_R037_GROUNDED_FIELD_CONNECTIONS_20260914','worldSourceVersion':'FARMLAND_R028_WATERSHED_20260912','runtimeSourceVersion':'FARMLAND_R029_RUNTIME_LIGHT_20260913','sha256':hashlib.sha256((out/'index.html').read_bytes()).hexdigest(),'bytes':(out/'index.html').stat().st_size,'sources':sources}
(root/'qa/build-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print('Built R037',receipt['bytes'],receipt['sha256'])
