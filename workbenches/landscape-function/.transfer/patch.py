from pathlib import Path
import re,hashlib,json
HERE=Path(__file__).parent

def compact(s):
 s=re.sub(r'\A/\*.*?\*/\s*','',s,flags=re.S)
 return '\n'.join(x.strip() for x in s.splitlines() if x.strip() and not x.lstrip().startswith('//'))

def build(html,files):
 def block(name):return re.search(r'<script id="'+name+r'" type="text/plain">(.*?)</script>',html,re.S).group(1)
 world=block('worldSource')
 assert hashlib.sha256(world.encode()).hexdigest()=='0aa9aaeab9062485fae772053016ab1e6795d74c25f175db710234d269b6241a','Unreviewed World source'
 world=world.replace("core:'rock-soil-2'","core:'brick-limestone-1'")+'\n'+files['brickstone.js']
 gen=block('generateSource');a=gen.index('const gravelP=');b=gen.index("progress(.55,",a)
 gen=gen[:a]+compact(files['placement.js'])+'\n'+gen[b:]
 a=gen.index('if(config.stage===4){let P=[],I=[],V=[],count=0;');b=gen.index('let unpackedBytes=',a);gen=gen[:a]+gen[b:]
 gen=gen.replace('p.pocket?.12:w.ground(x,z)-y,p.pocket?.45:w.soilThickness(x,z)','p.kind<3?(p.stoneShader||1):(p.pocket?.12:w.ground(x,z)-y),p.pocket?.45:w.soilThickness(x,z)')
 gen=gen.replace('statisticalGravel:accepted,','statisticalGravel:accepted,brickStoneTransfer:stoneRecords,materialSource:{repo:"haihao0307/HOUSE",commit:"53a4b0728678e31ba4ebf2a9267a213597d8f226",path:"experiments/atelier-r4/src/renderer.js",interpretation:"user-selected limestone-look candidate; source categories retain their original names"},')
 tail=html[html.index('</script>',html.index('<script id="generateSource"'))+9:]
 app=tail[tail.index("'use strict';\n(()=>{"):tail.rindex('</script>')]
 app=app.replace("core:'rock-soil-2'","core:'brick-limestone-1'").replace('section:[[48,9,62],[16,-1.0,0]]','section:[[48,9,62],[16,-1.0,0]],stone:[[-7,8,43],[-10,1.3,25]]')
 a=app.index('const titles=');b=app.index('function toast(',a);app=app[:a]+app[b:]
 app=app.replace("$('#viewtitle').textContent=titles[v];$('#viewnote').innerHTML=notes[v];",'').replace("if(innerWidth<640)state.radius*=v==='cliff'?1.18:1.48;","if(innerWidth<640)state.radius*=v==='cliff'?1.18:v==='stone'?1.25:1.48;")
 app=app.replace('window.__LM__={bufferFingerprint',"window.__LM__={release:'brick-limestone-1',source:'HOUSE@53a4b072',bufferFingerprint")
 a=app.index('if(cache.has(key(recipe)))');b=app.index('const code=',a);app=app[:a]+'\n'+app[b:]
 out=files['template.html']
 for name,code in [('WORLD',world),('GENERATOR',gen),('SHADERS',files['shaders.js']),('APP',app)]:out=out.replace('__'+name+'__',compact(code))
 out=out.replace('__SIZE__',f'{len(out.replace("__SIZE__","00.0").encode())/1000:.1f}')
 return out.encode()

if __name__=='__main__':
 import sys
 parent=HERE.parent
 files={n:(HERE/n).read_text() for n in ('brickstone.js','placement.js','shaders.js','template.html')}
 out=build((parent/'index.html').read_text(),files)
 Path(sys.argv[1]).write_bytes(out)
 print(json.dumps({'htmlBytes':len(out),'htmlSHA256':hashlib.sha256(out).hexdigest(),'source':'HOUSE@53a4b072','productionReady':False}))
