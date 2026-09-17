"""Site-instance relations, not surveyed Palau geometry. CPU and GLSL share one descriptor."""
import json
SHORES=[{'id':'west-sand-ring','x':-83.,'z':34.,'radius':20.,'phase':.6,'kind':'sand-ring'},{'id':'east-sand-cove','x':76.,'z':-53.,'radius':18.,'phase':2.1,'kind':'sand-cove'},{'id':'south-sand-ring','x':38.,'z':106.,'radius':16.,'phase':3.4,'kind':'sand-ring'}]
def apply(html):
 def rep(a,b,count=1):
  nonlocal html
  assert html.count(a)==count,(a[:90],html.count(a),count)
  html=html.replace(a,b)
 defs='const STONE_MONEY_SHORES=Object.freeze('+json.dumps(SHORES,separators=(',',':'))+''');
function smiLocalShore(x,z,q){const a=Math.atan2(z-q.z,x-q.x),shape=1+.10*Math.sin(a*3+q.phase)+.065*Math.sin(a*5-q.phase);const cove=q.kind==='sand-cove'?1-.30*Math.pow(Math.max(0,Math.cos(a-q.phase)),3):1;return Math.hypot(x-q.x,z-q.z)-q.radius*shape*cove;}
function smiSecondaryBed(x,z){let top=-1000;for(const q of STONE_MONEY_SHORES){const s=smiLocalShore(x,z,q);if(s>30)continue;const h=s<0?.85*smooth(0,4,-s)+1.25*smooth(4,12,-s):-.18*Math.min(s,8)-.55*smooth(2,12,s)-30*smooth(12,30,s);top=Math.max(top,h);}return top;}
'''
 rep('function bedHeight(x,z){',defs+'function bedHeight(x,z){')
 rep('return shelf+deep+relief-reef.pit+reef.rim;','return Math.max(shelf+deep+relief-reef.pit+reef.rim,smiSecondaryBed(x,z));')
 rep('return body+ridge+hummock+erosion;','return Math.max(body+ridge+hummock+erosion,smiSecondaryBed(x,z));',2)
 html=html.replace('return Math.max(body+ridge+hummock+erosion,smiSecondaryBed(x,z));\n}\nvec2 flowDir','return max(body+ridge+hummock+erosion,smiSecondaryBedG(p));\n}\nvec2 flowDir')
 gl=''
 for index,q in enumerate(SHORES):
  gl+=f'if(i=={index}){{c=vec2({q["x"]},{q["z"]});R={q["radius"]};phase={q["phase"]};cove={1. if q["kind"]=="sand-cove" else 0.};}}'
 gl='''float smiLocalShoreG(vec2 p,int i){vec2 c=vec2(0);float R=1.,phase=0.,cove=0.;'''+gl+'''float a=atan(p.y-c.y,p.x-c.x),shape=1.+.10*sin(a*3.+phase)+.065*sin(a*5.-phase);return length(p-c)-R*shape*(1.-cove*.30*pow(max(0.,cos(a-phase)),3.));}
float smiSecondaryBedG(vec2 p){float top=-1000.;for(int i=0;i<3;i++){float s=smiLocalShoreG(p,i);if(s>30.)continue;float h=s<0.?.85*smoothstep(0.,4.,-s)+1.25*smoothstep(4.,12.,-s):-.18*min(s,8.)-.55*smoothstep(2.,12.,s)-30.*smoothstep(12.,30.,s);top=max(top,h);}return top;}
float smiShoreDistance(vec2 p){float s=length(p)-islandR(p);for(int i=0;i<3;i++)s=min(s,smiLocalShoreG(p,i));return s;}
'''
 rep('float bedH(vec2 p){',gl+'float bedH(vec2 p){')
 rep('vec2 reef=reefBed(p);return shelf+deep+relief-reef.x+reef.y;','vec2 reef=reefBed(p);return max(shelf+deep+relief-reef.x+reef.y,smiSecondaryBedG(p));')
 html=html.replace('shoreDistance=length(vWorld.xz)-islandR(vWorld.xz)','shoreDistance=smiShoreDistance(vWorld.xz)')
 rep('vec3(.40,.285,.155),vec3(.84,.735,.535)','vec3(.71,.695,.64),vec3(.98,.965,.91)')
 rep('vec3(.93,.84,.66),shell*.12','vec3(.995,.985,.94),shell*.12')
 rep('base*=mix(1.0,.50,wet*(1.0-deepFloor))','base*=mix(1.0,.73,wet*(1.0-deepFloor))')
 rep('vec3 seaFloor=mix(vec3(.020,.038,.037),vec3(.072,.095,.080),n1);','float reefPatch=smoothstep(.42,.66,fbm(vWorld.xz*.093)+.12*noise2(vWorld.xz*.27));vec3 seaFloor=mix(vec3(.65,.68,.57),mix(vec3(.11,.20,.15),vec3(.31,.35,.22),n1),reefPatch);')
 html=html.replace('cy=bedHeight(cx,cz)+sy*.45','cy=(Math.hypot(cx,cz)>60?0:bedHeight(cx,cz))+sy*.45')
 html=html.replace('KARST_ROCKS.slice(0,5)','KARST_ROCKS')
 marker=' // A large banyan-like fig mass with multiple trunks and a broad crown.'
 forest=''' for(const rock of KARST_ROCKS){const [x,z,sx,sy,sz]=rock;if(Math.hypot(x,z)<60)continue;for(let k=0;k<38;k++){const a=rng.next()*TAU,r=Math.sqrt(rng.next())*.72,px=x+Math.cos(a)*r*sx,pz=z+Math.sin(a)*r*sz,y=karstApproxTop(px,pz);if(y>-100)broadleafAt(px,pz,y,.65+rng.next()*.50);}}
'''
 rep(marker,forest+marker)
 rep('window.PalauSurvivalGame={',"window.StoneMoneyIslandGame=window.PalauSurvivalGame={shoreInstances:STONE_MONEY_SHORES,shoreEvidence:'authored-candidate-not-survey',")
 return html
