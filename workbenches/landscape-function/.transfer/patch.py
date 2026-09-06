"""Assemble the exact, locally checked Brick-transfer candidate from readable sources.
The source basis is the user's delivered Surface_Refined HTML, not the separate
rain-wall candidate previously on Pages. Historical incoming HTML is preserved
in the job evidence. No source-identity or staged/public validation is disabled.
"""
from pathlib import Path
import hashlib,re,os
HERE=Path(__file__).parent
EXPECTED={'world.js':'fe4f1ffb8d3593a97bc033cfd13e0a60c4a9e7b1','generate.js':'5e1b32d5d6d0d8964580cd9ac960a7b95b616585','app.js':'989cb846b10b92466a168e49e7c52ec89c0796c0','brickstone.js':'4425f4f2a6375cbce67d420eb46ebc05b5c83f52','shaders.js':'7b762768e8242ae68b1e5488a2b1156f41d535ab','template.html':'41ec28e4bd9deecbbec4ab112507cb7b19a42117'}
def build(incoming,unused):
    out=Path(os.environ.get('LM_EVIDENCE','/tmp/lm-function-evidence'));out.mkdir(parents=True,exist_ok=True)
    (out/'incoming.html').write_text(incoming)
    files={}
    for name,want in EXPECTED.items():
        data=(HERE/name).read_bytes()
        actual=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
        assert actual==want,'Unexpected source blob: '+name
        files[name]=data.decode()
    text=files['template.html']
    for name,file in [('WORLD','world.js'),('GENERATOR','generate.js'),('SHADERS','shaders.js'),('APP','app.js')]:
        code=files[file]
        if name=='WORLD':code+='\n'+files['brickstone.js']
        code=re.sub(r'\A/\*.*?\*/\s*','',code,flags=re.S)
        code='\n'.join(line.strip() for line in code.splitlines() if line.strip() and not line.lstrip().startswith('//'))
        text=text.replace('__'+name+'__',code)
    text=text.replace('__SIZE__',f'{len(text.replace("__SIZE__","00.0").encode())/1000:.1f}')
    return text.encode()
