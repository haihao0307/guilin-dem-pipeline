"""Reproducible Palau V0.1.6.0 adaptation of the frozen V0.1.5.0 entry.
No outside models/textures. The previous release is never overwritten.
"""
from pathlib import Path
import re,json,hashlib,sys
D=Path(__file__).resolve().parent
ROOT=Path.cwd()
BASE=ROOT/'games/survivor-palau/releases/v0.1.5.0/Survivor_Palau_V0.1.5.0_Canoe_Control_Direct_Open.html'
if len(sys.argv)>1:BASE=Path(sys.argv[1])
s=BASE.read_text()
assert "const VERSION='palau-survival-0.1.5.0-canoe-control'" in s
base_hash=hashlib.sha256(s.encode()).hexdigest()
def replace(a,b):
 global s
 assert a in s, a[:130]
 s=s.replace(a,b)
def section(a,b,new):
 global s
 start=s.index(a);end=s.index(b,start);s=s[:start]+new+'\n'+s[end:]
replace('V0.1.5.0','V0.1.6.0')
replace('palau-survival-0.1.5.0-canoe-control','palau-survival-0.1.6.0-reef-islands')
replace('palau-survival-v0150-canoe-control','palau-survival-v0160-reef-islands')
replace("{minX:-260,maxX:260,minZ:-260,maxZ:260,width:520,depth:520}","{minX:-560,maxX:560,minZ:-560,maxZ:560,width:1120,depth:1120}")
section('function addKarstDefinitions(', 'function bindConfig(', '')
replace('function bedHeight(x,z){','function campBedHeight(x,z){')
replace('function rockGeometry(definitions){','function coastRockGeometry(definitions){')
replace('const VERSION=',(D/'world.mjs').read_text()+'\nconst VERSION=')
replace('</body>','</body>')
replace('<script type="module">',(D/'interface.html').read_text()+'<script type="module">')
replace('function frame(now){',(D/'game.mjs').read_text()+'\nfunction frame(now){')
replace('if(updateCanoeGame(elapsed))changed=true;','if(!config.paused && updateCanoeGame(elapsed))changed=true;\n updateFishing(elapsed);')
replace('installCamera();installCanoeGame();','installCamera();installCanoeGame();installPalauHUD();')
replace('rebuildDefinitions(config);','rebuildPalauBed();rebuildDefinitions(config);')
replace('[terrainGeo,rocksGeo,ringGeo,logsGeo,vegetationGeo,canoeGeo]','[terrainGeo,rocksGeo,ringGeo,logsGeo,vegetationGeo,canoeGeo,reefDecorGeo]')
replace('vegetationGeo=vegetationMesh(gl);canoeGeo=canoeMesh(gl);','vegetationGeo=palauForestMesh();reefDecorGeo=buildReefDecor();canoeGeo=canoeMesh(gl);')
replace('drawSolid(canoeGeo,sun,canoeModel());','drawSolid(canoeGeo,sun,canoeModel());if(reefDecorGeo)drawSolid(reefDecorGeo,sun);if(tackleGeo)drawSolid(tackleGeo,sun);')
replace('terrainRes=QA_MODE?96:(mobile?150:220),rockRes=QA_MODE?256:(mobile?480:640)','terrainRes=QA_MODE?128:(mobile?192:256),rockRes=QA_MODE?512:(mobile?768:1024)')
# Same sampled field for seabed geometry, water optics/physics and boat depth.
section('float bedH(vec2 p){','vec2 flowDir(','''uniform highp sampler2D uPalauBed;
uniform vec4 uBedBounds;
float bedH(vec2 p){
 vec2 uv=(p-uBedBounds.xy)/uBedBounds.zw;if(any(lessThan(uv,vec2(0)))||any(greaterThan(uv,vec2(1))))return -80.0;
 ivec2 size=textureSize(uPalauBed,0);vec2 f=clamp(uv,vec2(0),vec2(.999999))*vec2(size-1);ivec2 a=ivec2(f),b=min(a+1,size-1);vec2 t=fract(f);
 return mix(mix(texelFetch(uPalauBed,a,0).r,texelFetch(uPalauBed,ivec2(b.x,a.y),0).r,t.x),mix(texelFetch(uPalauBed,ivec2(a.x,b.y),0).r,texelFetch(uPalauBed,b,0).r,t.x),t.y);
}''')
replace("[...names,'uParams[0]']","[...names,'uParams[0]','uPalauBed','uBedBounds']")
replace("function sendParams(loc){if(loc.paramSize)","function sendParams(loc){if(loc.uPalauBed!==null&&palauBedTexture){gl.activeTexture(gl.TEXTURE6);gl.bindTexture(gl.TEXTURE_2D,palauBedTexture);gl.uniform1i(loc.uPalauBed,6);gl.uniform4f(loc.uBedBounds,DOMAIN.minX,DOMAIN.minZ,DOMAIN.width,DOMAIN.depth);}if(loc.paramSize)")
# Clear blue gaps and cloud cells in world-direction space, instead of an almost-constant gray FBM domain.
section('vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){','vec3 farSeaRadiance(','''vec3 skyRadiance(vec3 rd,vec3 sunDir,int mode,float exposure){
 float sun=max(dot(rd,sunDir),0.0),h=sat(rd.y);
 if(mode==1)return mix(vec3(.5,.55,.57),vec3(.78,.82,.83),sqrt(h))*exposure;
 vec3 c=mix(vec3(.40,.68,.84),vec3(.026,.17,.46),pow(h,.48));
 vec2 p=rd.xz/max(.025,rd.y)*.78+vec2(13.2,-7.7)+vec2(uTime*.0018,-uTime*.0011)*p_cloudSpeed;
 vec2 warp=vec2(fbm(p*.45),fbm(p*.47+8.0))-.5;
 float broad=fbm(p*.85+warp*.72),detail=fbm(p*3.2+warp),body=broad*.80+detail*.20;
 float threshold=mix(.66,.46,clamp(p_cloudiness,0.0,1.0)),edge=smoothstep(threshold,threshold+.07,body);
 float mask=smoothstep(.012,.055,rd.y)*(1.0-smoothstep(.86,.99,rd.y));
 float core=smoothstep(threshold+.05,threshold+.17,body),shade=fbm(p*.85+warp*.72+vec2(.12,.18));
 vec3 cloud=mix(vec3(.55,.65,.71),vec3(1.38,1.36,1.25),sat(.52+(body-shade)*5.0+core*.22));
 c=mix(c,cloud,edge*mask);c+=vec3(1.0,.89,.69)*pow(sun,720.0)*2.2;
 c+=vec3(.34,.25,.13)*pow(sun,24.0)*.15;
 return c*exposure*p_skyLight;
}''')
replace('smoothstep(105.0,225.0,length(vWorld.xz))','smoothstep(1500.0,2350.0,length(vWorld.xz))')
replace('vec3(.016,.075,.112)*exposure','vec3(.004,.054,.145)*exposure')
replace('vec3(.38,.17,.095)*p_absorption','vec3(.30,.13,.065)*p_absorption')
replace('mix(vec3(.024,.255,.275),vec3(.008,.075,.125),smoothstep(.18,4.2,thickness))','mix(vec3(.008,.36,.39),vec3(.003,.047,.125),smoothstep(2.5,22.0,thickness))')
replace('vec3 seaFloor=mix(vec3(.020,.038,.037),vec3(.072,.095,.080),n1);', 'float coralPatch=smoothstep(.45,.68,fbm(vWorld.xz*.17)+.12*noise2(vWorld.xz*.91));vec3 seaFloor=mix(vec3(.69,.70,.51),mix(vec3(.115,.18,.092),vec3(.28,.24,.12),n2),coralPatch*.87);seaFloor*=1.0-.30*smoothstep(9.0,40.0,-vWorld.y);')
replace('vec3 cool=vec3(.040,.050,.055),warm=vec3(.335,.270,.185)','vec3 cool=vec3(.24,.28,.255),warm=vec3(.67,.62,.46)')
replace('base*=.70+.58*mineral','base*=.84+.25*mineral')
replace('float distanceAlong=float(j)*.7','float distanceAlong=float(j)*2.4')
replace('smoothstep(-.08,.24,probe.y-height+.14)','smoothstep(.20,1.65,probe.y-height+1.1)')
replace('mix(.055,1.0,visibility)','mix(.36,1.0,visibility)')
replace('vec3(.018,.105,.035),vec3(.13,.31,.085)','vec3(.017,.090,.022),vec3(.19,.35,.055)')
# Add coral/tackle material classes, preserving all older material meanings.
replace("}else{\n  float wood=", "}else if(vKind>6.5){\n  if(vKind<7.5)base=vec3(.29,.25,.085);else if(vKind<8.5)base=vec3(.16,.29,.22);else if(vKind<9.5)base=vec3(.29,.16,.12);else if(vKind<10.5)base=vec3(.11,.14,.14);else base=vec3(.68,.12,.045);base*=.65+.55*n1;rough=.84;\n }else{\n  float wood=")
# Surface detail follows distance and water depth, not a hard near/far scene switch.
replace('(.014+.028*deepMix)','(.023+.040*deepMix)')
# Reduce transported media and all decorative glass work; do not rebuild terrain per frame.
replace('const MAX_PARTICLES=QA_MODE?2800:(innerWidth<760?5200:9000);','const MAX_PARTICLES=QA_MODE?1200:(innerWidth<760?2200:4000);')
section('function updateGlassRects(){','new ResizeObserver','function updateGlassRects(){glassDirty=false;glassCount=0;glassRects.fill(0);}\n')
# Camera remains fully user-controlled and can frame the entire larger metric archipelago.
replace('4,270','4,1500')
replace('overview:{target:[0,6.5,0],yaw:incomingYaw+.34,pitch:.37,distance:r*6.15}', 'overview:{target:[-15,21,25],yaw:2.82,pitch:.32,distance:760}')
replace('karst:{target:[0,10.5,0],yaw:2.44,pitch:.27,distance:68}', 'karst:{target:[200,18,25],yaw:2.48,pitch:.16,distance:122}')
replace('deepfish:{target:[DEEP_FISH_POS[0],waterLevel(physicalTime,config)+.18,DEEP_FISH_POS[2]],yaw:2.12,pitch:.10,distance:72}', 'deepfish:{target:[370,0,-220],yaw:2.50,pitch:.08,distance:120},\n  reef:{target:[-125,-1,125],yaw:2.65,pitch:.64,distance:280},\n  money:{target:[18,bedHeight(18,10)+1.5,10],yaw:.18,pitch:.14,distance:9}')
replace('top:{target:[0,.2,0],yaw:.22,pitch:1.49,distance:r*5.10}','top:{target:[0,.2,0],yaw:.22,pitch:1.35,distance:940}')
replace('v.distance*=1.05;v.yaw=incomingYaw+.28;v.fov=63*Math.PI/180;','v.distance*=1.15;v.yaw=2.88;v.pitch=.27;v.fov=65*Math.PI/180;')
# Explicit output defaults are saved in the same parameter schema/reset route.
p=json.loads(re.search(r'const PARAMS=(.*);\n',s)[1]);settings={'cloudiness':.46,'skyLight':1.0,'haze':.045,'clarity':2.25,'absorption':.84,'swell':.88,'windWave':.40,'waterRough':.20,'exposure':1.07,'foamThickness':.66,'shoreFoam':.45,'smoke':1.1,'smokeLife':8,'glassFlow':0,'glassSpeed':0,'hour':13.3}
for item in p:
 if item['key'] in settings:item['value']=settings[item['key']]
s=re.sub(r'const PARAMS=.*;\n','const PARAMS='+json.dumps(p,ensure_ascii=False,separators=(',',':'))+';\n',s,count=1)
replace("cloudModel:'high-contrast broken cumulus cells with shaded bases and explicit blue-sky gaps'","cloudModel:'angular projected broken cumulus shader; not volumetric clouds'")
OUT=ROOT/'games/survivor-palau/releases/v0.1.6.0'
if len(sys.argv)>2:OUT=Path(sys.argv[2])
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'index.html').write_text(s)
meta={'version':'0.1.6.0','sourceBaseSHA256':base_hash,'outputSHA256':hashlib.sha256(s.encode()).hexdigest(),'sourceModified':True,'interactive3D':True,'staticImageSubstitute':False,'islandCount':10,'surveyTruth':False,'visualAcceptancePending':True,'productionReady':False,'browserPassed':False,'shareAllowed':False,'externalModels':0,'externalTextures':0,'landscapeReuse':'periodic profile/solution-channel adaptation, NOT an accepted R5 mesh transplant','pending':['device GPU frame pacing','visual acceptance','detailed ecological validation','cooking/survival/patrol/rescue','volumetric clouds and accurate island reflections']}
(OUT/'BUILD.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False))
print(str(OUT/'index.html'),len(s.encode()),meta['outputSHA256'])
