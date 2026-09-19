from pathlib import Path
import json
HERE=Path(__file__).resolve().parent
BASE=HERE.parents[2]/'releases'/'v0.2.3.0'/'index.html'
CORE=HERE.parent/'fishing_core.cjs'
OUT=HERE/'candidate.html'
LOCATE="function locateFish(time){for(const f of fish){if(s.fish[f.id])continue;if(!f.nav)f.nav=fishNavigation.initialize(f,time);fishNavigation.advance(f,f.nav,time);f.pos=[...f.nav.pos];f.yaw=f.nav.yaw;}}"
LOCATE_PATCH="const HANDLINE_OVERRIDES=new Map();\nfunction locateFish(time){for(const f of fish){if(s.fish[f.id])continue;const o=HANDLINE_OVERRIDES.get(f.id);if(o){f.pos=[...o.pos];f.yaw=o.yaw;continue;}if(!f.nav)f.nav=fishNavigation.initialize(f,time);fishNavigation.advance(f,f.nav,time);f.pos=[...f.nav.pos];f.yaw=f.nav.yaw;}}"
API_PREFIX="const api={tick,cameraFrame,drawWorld,drawHand,getState:"
HOOK="""const api={tick,cameraFrame,drawWorld,drawHand,handlineCandidate:{\n existingFish:()=>fish.filter(f=>fishActive(f)).map(f=>({fishId:f.id,position:[...f.pos],yaw:f.yaw,length:f.length,type:f.type})),\n playerPose:()=>({position:[s.player.x,ground(s.player.x,s.player.z),s.player.z],yaw:s.player.yaw,handHeight:s.player.crouched?.95:1.32,crouched:!!s.player.crouched}),\n surfaceAt:(x,z)=>{const q=host.water(x,z);return {eta:q.eta,normal:[0,1,0],surfaceVelocity:[0,0,0]};},\n setFishPose:(fishId,position,yaw=0)=>{if(!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)||!Number.isFinite(yaw))throw Error('invalid handline pose');const f=fish.find(x=>x.id===fishId);if(!f)throw Error('unknown existing fish '+fishId);const o={pos:[...position],yaw};HANDLINE_OVERRIDES.set(fishId,o);f.pos=[...o.pos];f.yaw=o.yaw;return true;},\n clearFishPose:fishId=>HANDLINE_OVERRIDES.delete(fishId),\n projectWorld:p=>{if(!Array.isArray(p)||p.length!==3)return {visible:false};const v=camera.view,P=camera.proj,x=p[0],y=p[1],z=p[2],vx=v[0]*x+v[4]*y+v[8]*z+v[12],vy=v[1]*x+v[5]*y+v[9]*z+v[13],vz=v[2]*x+v[6]*y+v[10]*z+v[14],vw=v[3]*x+v[7]*y+v[11]*z+v[15],cx=P[0]*vx+P[4]*vy+P[8]*vz+P[12]*vw,cy=P[1]*vx+P[5]*vy+P[9]*vz+P[13]*vw,cw=P[3]*vx+P[7]*vy+P[11]*vz+P[15]*vw;if(!(cw>0))return {visible:false};const nx=cx/cw,ny=cy/cw;return {x:(nx*.5+.5)*innerWidth,y:(1-(ny*.5+.5))*innerHeight,visible:nx>=-1.2&&nx<=1.2&&ny>=-1.2&&ny<=1.2};}\n },getState:"""
def wrap_core(src:str)->str:
    safe=src.replace('</script>','<\\/script>')
    return "<script id=\"smi-existing-fishing-core\">(function(){const module={exports:{}};(function(module,exports){\n"+safe+"\n})(module,module.exports);window.SMIExistingFishingCore=module.exports;})();</script>"
def build(base_text:str,core_text:str,controller_text:str,browser_text:str)->str:
    if base_text.count(LOCATE)!=1: raise RuntimeError(f'locateFish patch point count={base_text.count(LOCATE)}')
    if base_text.count(API_PREFIX)!=1: raise RuntimeError(f'api patch point count={base_text.count(API_PREFIX)}')
    out=base_text.replace(LOCATE,LOCATE_PATCH).replace(API_PREFIX,HOOK)
    bundle='\n'+wrap_core(core_text)+'\n<script id="smi-handline-controller">'+controller_text.replace('</script>','<\\/script>')+'</script>\n<script id="smi-handline-browser">'+browser_text.replace('</script>','<\\/script>')+'</script>\n'
    if out.count('</body>')!=1: raise RuntimeError('expected one </body>')
    return out.replace('</body>',bundle+'</body>')
def main():
    if not BASE.exists(): raise SystemExit(f'missing base: {BASE}')
    out=build(BASE.read_text(),CORE.read_text(),(HERE/'handline_controller.cjs').read_text(),(HERE/'handline_browser.js').read_text())
    OUT.write_text(out)
    print(json.dumps({'out':str(OUT),'bytes':OUT.stat().st_size,'base':str(BASE),'markers':{'runtime':'SMI_HANDLINE_R01_RUNTIME' in out,'hook':'handlineCandidate' in out,'core':'smi-existing-fishing-core' in out}},indent=2))
if __name__=='__main__': main()
