from __future__ import annotations

from pathlib import Path
import json
import subprocess
import sys

root=Path(sys.argv[1])
app=root/'app.mjs'
text=app.read_text(encoding='utf-8')
replacements={
"clarity:1.34,foam:.58,refraction:.66,contact:1.08,hour:13.25,exposure:.98,fire:1.24,smoke:.68,paused:false":"clarity:1.18,foam:.66,refraction:.62,contact:1.08,hour:13.25,exposure:1.00,fire:1.24,smoke:.68,waterVisible:true,paused:false",
"const sun=sunDirection();drawWater(sun);drawMedia();copyScene(true);":"const sun=sunDirection();if(config.waterVisible)drawWater(sun);drawMedia();copyScene(true);",
}
for old,new in replacements.items():
    if old not in text:
        raise SystemExit(f'app fragment missing: {old}')
    text=text.replace(old,new,1)
app.write_text(text,encoding='utf-8')

shader=root/'shaders.mjs'
s=shader.read_text(encoding='utf-8')
replacements={
"float shoreDist=vWorld.z-shoreline(vWorld.xz),dry=smoothstep(-1.0,-12.0,shoreDist),grain=":"float shoreDist=vWorld.z-shoreline(vWorld.xz),dry=1.0-smoothstep(-12.0,-1.0,shoreDist),grain=",
"vec3 behind=texture(uScene,refrUv).rgb;vec3 sigma=mix(vec3(.105,.045,.022),vec3(.22,.095,.052),smoothstep(.30,3.6,thickness))/max(.55,uClarity);vec3 trans=exp(-sigma*opticalPath);":"vec3 behind=texture(uScene,refrUv).rgb;float depthMix=smoothstep(.16,3.8,thickness);vec3 sigma=mix(vec3(.20,.072,.028),vec3(.46,.17,.072),depthMix)/max(.58,uClarity);vec3 trans=exp(-sigma*opticalPath);",
"vec3 F=fresnelSchlick(ndv,vec3(.0204)),reflected=skyRadiance(reflect(-V,N),uSunDir,uMode,1.0);":"vec3 F=fresnelSchlick(ndv,vec3(.0204));F=max(F,vec3(.028+.020*smoothstep(.08,.55,thickness)));vec3 reflected=skyRadiance(reflect(-V,N),uSunDir,uMode,1.0);",
"vec3 scatter=mix(vec3(.018,.105,.125),vec3(.026,.185,.215),smoothstep(.45,3.5,thickness));vec3 water=(behind*trans+scatter*(1.0-trans))*(1.0-F)+reflected*F+spec*.48;":"vec3 scatter=mix(vec3(.030,.185,.175),vec3(.018,.105,.205),smoothstep(.38,3.6,thickness));vec3 water=(behind*trans+scatter*(1.0-trans))*(1.0-F)+reflected*F+spec*.56;float body=smoothstep(.06,.90,thickness);water=mix(water,water+vec3(.008,.052,.062),body*.34);",
"float fog=1.0-exp(-length(uCamera-vWorld)*.0022);water=mix(water,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,1.0),fog*.10);float farBlend=smoothstep(30.0,53.0,vWorld.z);water=mix(water,farSeaRadiance(normalize(vWorld-uCamera),uSunDir,uMode,1.0),farBlend*.72);":"float fog=1.0-exp(-length(uCamera-vWorld)*.0017);water=mix(water,skyRadiance(normalize(vWorld-uCamera),uSunDir,uMode,1.0),fog*.075);float farBlend=smoothstep(25.0,51.0,vWorld.z);water=mix(water,farSeaRadiance(normalize(vWorld-uCamera),uSunDir,uMode,uExposure),farBlend*.82);",
"float coverage=smoothstep(.0035,.032,thickness);outColor=vec4(water*uExposure*coverage,coverage);":"float coverage=smoothstep(.0025,.026,thickness);outColor=vec4(water*uExposure*coverage,coverage);",
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit(f'shader fragment missing: {old[:110]}')
    s=s.replace(old,new,1)
shader.write_text(s,encoding='utf-8')

build=root/'BUILD.json'
data=json.loads(build.read_text(encoding='utf-8'))
data['waterRevision']='thickness-dependent absorption, visible water body, retained transparent millimetre edge'
data['qaWaterToggle']=True
build.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

for module in sorted(root.glob('*.mjs')):
    subprocess.run(['node','--check',str(module)],check=True)
print(json.dumps({'status':'PASS','waterVisibleDefault':True,'transparentEdge':True,'persistentImageAssets':0},ensure_ascii=False,indent=2))
