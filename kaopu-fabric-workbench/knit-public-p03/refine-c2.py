from pathlib import Path
import hashlib

ROOT=Path(__file__).resolve().parent
WOOL=ROOT/'wool-envelope.mjs'
BUILD=ROOT/'build.py'
OUT=ROOT/'wool-envelope-c2.mjs'

def replace_once(text,old,new,label):
    count=text.count(old)
    if count!=1:
        raise AssertionError(f'{label}: expected 1, found {count}')
    return text.replace(old,new,1)

w=WOOL.read_text()
# Soft carrier: let the wool envelope, not a glossy dark tube, define the yarn.
w=replace_once(w,
" material.roughness=.97;material.metalness=0;material.sheen=.72;material.sheenRoughness=1;\n material.sheenColor.set('#e8ddc9');material.ior=1.36;material.specularIntensity=.18;material.color.setScalar(.80);",
" material.roughness=.995;material.metalness=0;material.sheen=.42;material.sheenRoughness=1;\n material.sheenColor.set('#e8ddc9');material.ior=1.33;material.specularIntensity=.08;material.color.setScalar(.70);",
'carrier response')
w=replace_once(w,"    diffuseColor.rgb*=.72+.16*c0+.08*c1;","    diffuseColor.rgb*=.90+.07*c0+.04*c1;",'carrier albedo noise')
needle="  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\n    vec2 cp=vec2(vWoolUV.x*4.1+vWoolUV.y*.37,vWoolUV.y*8.3);\n    float c0=woolNoise(cp*1.9),c1=woolNoise(cp*8.7+5.2);\n    diffuseColor.rgb*=.90+.07*c0+.04*c1;\n  `);"
insert=needle+"\n  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>\n    reflectedLight.indirectDiffuse+=diffuseColor.rgb*(.13+.10*clamp(uWoolFuzz,0.,1.35));\n  `);"
w=replace_once(w,needle,insert,'carrier multiple-scatter fill')
# Broader wrapped response avoids black hair-like scratches in shadow.
w=replace_once(w,
" float nd=max(dot(N,L),0.);float cyl=sqrt(max(0.,1.-pow(dot(T,L),2.)));float back=max(dot(-N,L),0.);\n return radiance*(.68*nd+.27*cyl*(.58+.42*nd)+.05*back)/3.141592654;",
" float raw=dot(N,L),nd=max(raw,0.);float wrap=clamp((raw+.42)/1.42,0.,1.);float cyl=sqrt(max(0.,1.-pow(dot(T,L),2.)));float back=max(-raw,0.);\n return radiance*(.46*wrap+.34*cyl*(.62+.38*wrap)+.12*nd+.08*back)/3.141592654;",
'wrapped wool response')
# Stronger unresolved wool envelope; still only two shells to preserve cost and QA invariants.
w=replace_once(w,
"  {offset:.000055,opacity:.30,order:1.05,scale:14500},\n  {offset:.000135,opacity:.19,order:1.10,scale:10900}",
"  {offset:.000085,opacity:.44,order:1.05,scale:18500},\n  {offset:.000210,opacity:.30,order:1.10,scale:11500}",
'shell layers')
w=replace_once(w,
" float grazing=pow(1.-abs(dot(N,V)),.72);float density=clamp(uFuzz/1.35,0.,1.);\n float alpha=uOpacity*density*(.38+.62*grazing)*(.72+.28*grain);if(alpha<.004)discard;\n vec3 light=woolResponse(N,normalize(vec3(.31,.88,.35)),uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,normalize(vec3(.31,.88,.35)),uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);",
" float grazing=pow(1.-abs(dot(N,V)),.50);float density=clamp(uFuzz/1.12,0.,1.);float soft=smoothstep(.10,.90,grain+grazing*.42);\n float alpha=uOpacity*density*(.46+.82*grazing)*(.58+.42*soft);if(alpha<.004)discard;\n vec3 light=vec3(.34+.08*grazing)+woolResponse(N,normalize(vec3(.31,.88,.35)),uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,normalize(vec3(.31,.88,.35)),uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);",
'shell opacity and fill')
# Finite staples are shorter, wider and lighter, so they overlap as wool instead of tracing full dark lines.
w=replace_once(w,"   const span=.19+.31*Math.pow(hash(id*3301+h*67+17),.82),start=hash(id*2713+h*43+29)*(1-span);","   const span=.075+.17*Math.pow(hash(id*3301+h*67+17),.88),start=hash(id*2713+h*43+29)*(1-span);",'staple span')
w=replace_once(w,"   const lift=.000026+.000115*Math.pow(hash(id*1877+h*73+31),1.45),width=hash(id*1429+h*61+37),densityKey=hash(id*2029+h*89+41);","   const lift=.000018+.000072*Math.pow(hash(id*1877+h*73+31),1.55),width=hash(id*1429+h*61+37),densityKey=hash(id*2029+h*89+41);",'staple lift')
w=replace_once(w,"   const col=colBase.clone().multiplyScalar(.68+.44*hash(id*379+h*101+47));","   const col=colBase.clone().multiplyScalar(.92+.16*hash(id*379+h*101+47));",'staple dye')
w=replace_once(w," float actual=projectionMatrix[1][1]*(.000036+.000025*fibreRand.z)/max(-mv.z,.00001)*uSize.y*.5;"," float actual=projectionMatrix[1][1]*(.000055+.000035*fibreRand.z)/max(-mv.z,.00001)*uSize.y*.5;",'staple width')
w=replace_once(w," float d=clamp(uDensity/1.35,0.,1.);float keep=smoothstep(fibreRand.w-.18,fibreRand.w+.10,d);vAlpha=endFade*keep*clamp(uDetail,0.,1.4)*(.60+.26*fibreRand.z)*min(1.,actual/.82);"," float d=clamp(uDensity/1.12,0.,1.);float keep=smoothstep(fibreRand.w-.20,fibreRand.w+.08,d);vAlpha=endFade*keep*clamp(uDetail,0.,1.4)*(.48+.16*fibreRand.z)*min(1.,actual/.82);",'staple coverage')
old_light=" vec3 light=woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);\n for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);"
if w.count(old_light)!=2: raise AssertionError(f'staple/halo light blocks: {w.count(old_light)}')
w=w.replace(old_light," vec3 light=vec3(.38)+woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);\n for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);",1)
# Halo population: mostly very short down, a smaller silhouette halo and rare controlled flyaways.
w=replace_once(w,
"   const q=hash(hid*29+9);let kind,len;if(q<.80){kind=0;len=.00026+.00062*Math.pow(hash(hid*31+11),1.75);}else if(q<.982){kind=.55;len=.00062+.00118*Math.pow(hash(hid*37+13),1.25);}else{kind=1;len=.00135+.00215*hash(hid*41+17);}",
"   const q=hash(hid*29+9);let kind,len;if(q<.88){kind=0;len=.00010+.00022*Math.pow(hash(hid*31+11),1.80);}else if(q<.985){kind=.55;len=.00028+.00055*Math.pow(hash(hid*37+13),1.35);}else{kind=1;len=.00070+.00110*hash(hid*41+17);}",
'halo lengths')
w=replace_once(w,
"   const tangentBias=kind<.2?1.25:(kind<.8?.58:.30);const outward=kind<.2?.28:(kind<.8?.78:1.02);",
"   const tangentBias=kind<.2?.72:(kind<.8?.44:.24);const outward=kind<.2?.34:(kind<.8?.72:.96);",
'halo direction')
w=replace_once(w,
"   const curve=f.B.clone().multiplyScalar((hash(hid*59+31)-.5)*len*(kind<.2?.65:1.45)).addScaledVector(f.N,(hash(hid*61+37)-.48)*len*(kind<.2?.42:.95)).addScaledVector(n,-len*(.08+.18*hash(hid*67+41)));",
"   const curve=f.B.clone().multiplyScalar((hash(hid*59+31)-.5)*len*(kind<.2?.45:.85)).addScaledVector(f.N,(hash(hid*61+37)-.48)*len*(kind<.2?.30:.60)).addScaledVector(n,-len*(.05+.12*hash(hid*67+41)));",
'halo curvature')
w=replace_once(w,"   const col=colBase.clone().multiplyScalar(.67+.46*hash(hid*79+53));","   const col=colBase.clone().multiplyScalar(.90+.18*hash(hid*79+53));",'halo dye')
w=replace_once(w," float baseWidth=mix(.000033,.000060,identity.y);float actual=projectionMatrix[1][1]*(baseWidth+.000012*identity.z)/max(-mv.z,.00001)*uSize.y*.5;"," float baseWidth=mix(.000060,.000090,identity.y);float actual=projectionMatrix[1][1]*(baseWidth+.000016*identity.z)/max(-mv.z,.00001)*uSize.y*.5;",'halo width')
w=replace_once(w," float d=clamp(uDensity/1.35,0.,1.);float keep=smoothstep(identity.x-.17,identity.x+.09,d);float kindBoost=mix(.78,1.08,identity.y);vAlpha=keep*kindBoost*(1.-t*.30)*min(1.,actual/.78);"," float d=clamp(uDensity/1.12,0.,1.);float keep=smoothstep(identity.x-.20,identity.x+.08,d);float kindBoost=mix(.72,.96,identity.y);vAlpha=keep*kindBoost*(1.-t*.45)*min(1.,actual/.78);",'halo coverage')
# Replace only the remaining halo lighting block; staple block already changed.
w=replace_once(w,
" vec3 light=woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);\n for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);",
" vec3 light=vec3(.40)+woolResponse(N,T,uKeyDir,uKey)*woolShadow(uKS,uKM,vWorld)+woolResponse(N,T,uRimDir,uRim)*woolShadow(uRS,uRM,vWorld);\n for(int i=0;i<8;i++)light+=woolResponse(N,T,uED[i],uEC[i]);",
'halo fill')
w=w.replace("qualityTarget:'soft dense wool envelope; candidate only, not user accepted'","qualityTarget:'C2 soft continuous wool envelope; candidate only, not user accepted'")
OUT.write_text(w)

b=BUILD.read_text()
b=replace_once(b,"import {softenCarrierMaterial,makeWoolEnvelope} from './wool-envelope.mjs';","import {softenCarrierMaterial,makeWoolEnvelope} from './wool-envelope-c2.mjs';",'build module import')
anchor="s=s.replace('kaopu:knit:public:p02','kaopu:knit:public:p03')"
addition=anchor+"\nrep(\"const seed=4291, cols=16, rows=20, pitch=.0058, spacing=.00290, radius=.00086;\",\"const seed=4291, cols=16, rows=20, pitch=.00545, spacing=.00268, radius=.00091;\")"
b=replace_once(b,anchor,addition,'denser carrier geometry')
b=replace_once(b,"jx=(hash(id*149+11)-.5)*.14,jy=(hash(id*233+17)-.5)*.18","jx=(hash(id*149+11)-.5)*.18,jy=(hash(id*233+17)-.5)*.22",'stitch jitter')
b=replace_once(b,"const tensionX=.96+.08*hash(id*307+19),tensionY=.95+.10*hash(id*401+23);","const tensionX=.93+.14*hash(id*307+19),tensionY=.93+.14*hash(id*401+23);",'stitch tension')
b=replace_once(b,"mesh.material.sheen=on?.72:0;mesh.material.roughness=on?.97:.56;mesh.material.color.setScalar(on?.80:1);","mesh.material.sheen=on?.42:0;mesh.material.roughness=on?.995:.56;mesh.material.color.setScalar(on?.70:1);",'carrier mode response')
b=b.replace("'status':'SOURCE_CANDIDATE_AWAITING_RUNTIME_AND_VISUAL_REVIEW'","'status':'C2_SOURCE_CANDIDATE_AWAITING_RUNTIME_AND_VISUAL_REVIEW'")
BUILD.write_text(b)
print({'module':OUT.name,'moduleSHA256':hashlib.sha256(OUT.read_bytes()).hexdigest(),'buildSHA256':hashlib.sha256(BUILD.read_bytes()).hexdigest()})
