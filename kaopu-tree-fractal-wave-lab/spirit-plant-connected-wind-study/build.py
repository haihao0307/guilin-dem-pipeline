from pathlib import Path
import base64,json,re,hashlib
P=Path(__file__).parent
url=lambda s:'data:text/javascript;base64,'+base64.b64encode(s.encode()).decode()
modules={
 'three-core':url((P/'vendor/three.core.js').read_text()),
 'three':url((P/'vendor/three.module.js').read_text().replace("'./three.core.js'","'three-core'")),
 'three/addons/controls/OrbitControls.js':url((P/'vendor/OrbitControls.js').read_text()),
 'connected-wind':url((P/'src/connected-wind.js').read_text())}
for kind in ['baseline','src']:
 html=(P/kind/'index.html').read_text();html=html.replace('<head>', '<head>\n<!-- Bundled Three.js license\n'+(P/'vendor/LICENSE').read_text()+'\n-->');html=re.sub(r'<script type="importmap">.*?</script>','<script type="importmap">'+json.dumps({'imports':{k:v for k,v in modules.items() if kind=='src' or k!='connected-wind'}})+'</script>',html,flags=re.S)
 html=html.replace('<script type="module" src="./runtime.js"></script>','<script type="module" src="'+url((P/kind/'runtime.js').read_text())+'"></script>')
 target=P/('baseline-standalone.html' if kind=='baseline' else 'spirit-r03-connected-wind.html');target.write_text(html)
 print(target.name,len(target.read_bytes()),hashlib.sha256(target.read_bytes()).hexdigest())
