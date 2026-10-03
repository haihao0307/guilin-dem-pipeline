from pathlib import Path
import re,json,hashlib,os
R=Path(os.environ.get('R09_BUILD_ROOT','build_material_r09')); B=R/'baseline'; S=R/'src'
def replace(s,a,b):
 assert a in s,a[:120]
 return s.replace(a,b,1)
# Frozen baselines are byte-identical; no R08 code used.
wet=(B/'teacher.frag').read_text()
mat=(B/'material.glsl').read_text()
iq=(B/'audit_03_no_texture_weighted.frag').read_text()
S.joinpath('wet-baseline.frag').write_text(wet)
S.joinpath('wet-material-baseline.frag').write_text(wet.replace('void main(){mainImage(outColor,gl_FragCoord.xy);}','')+'\n'+mat)
S.joinpath('iq-baseline.frag').write_text(iq)
rig='''
uniform int uSharedRig;
uniform vec3 uKeyTint,uFillTint;
uniform vec2 uKeyAngles,uFillAngles;
uniform float uKeyPower,uFillPower;
uniform vec3 uBackground;
vec3 rotateLight(vec3 p,vec2 a){if(a.x==0.0&&a.y==0.0)return p;float c=cos(a.x),s=sin(a.x);p.xz=mat2(c,-s,s,c)*p.xz;c=cos(a.y);s=sin(a.y);p.yz=mat2(c,-s,s,c)*p.yz;return p;}
'''
extra=rig+'''
uniform int uShapeSeed,uNoiseSeed;
uniform vec3 uShapeScale;
uniform float uCutStrength;
uniform vec3 uBaseRaw,uMineralLow,uMineralHigh,uPatinaColor,uMicaTint,uGrainColor;
uniform vec4 uLayerOn,uLayerStrength,uLayerScale,uLayerCover,uLayerSeed;
uniform int uSurfaceView,uLook;
uniform float uSpecularScale;
float signedSeedOffset(float seed){return seed==0.0?0.0:seed*2.173;}
vec3 layerOffset(float seed){return vec3(signedSeedOffset(seed),seed*.731,seed*1.217);}
float studyMica(vec3 p){
 if(uLayerOn.z<0.5)return 0.0;
 if(uLayerScale.z==32.0&&uLayerCover.z==0.5&&uLayerSeed.z==0.0&&uLayerStrength.z==1.0)
  return smoothstep(-0.15,0.15,fbm(32.0*p,4)-0.15);
 return smoothstep(-.15,.15,fbm(uLayerScale.z*p+layerOffset(uLayerSeed.z),4)-(.15+(.5-uLayerCover.z)*.7))*uLayerStrength.z;
}
vec3 layeredBase(vec3 p,vec3 onor,out vec4 masks){
 vec3 albedo=pow(constant_gray_vec(uBaseRaw,onor),vec3(3.0,3.2,3.0));
 masks=vec4(0.0);
 if(uLayerOn.x>0.5){
  float mineral=clamp(.5+.6*fbm(p*uLayerScale.x+layerOffset(uLayerSeed.x),4),0.,1.);
  if(uLayerCover.x!=.5)mineral=clamp(mineral+(uLayerCover.x-.5),0.,1.);
  masks.x=mineral;
  albedo=mix(albedo,mix(uMineralLow,uMineralHigh,mineral),uLayerStrength.x);
 }
 if(uLayerOn.y>0.5){
  float patina=smoothstep(0.,.5,fbm(p*uLayerScale.y+8.0+layerOffset(uLayerSeed.y),4)+ (uLayerCover.y-.5)*.8);
  masks.y=patina*uLayerStrength.y;
  albedo=mix(albedo,uPatinaColor,masks.y);
 }
 if(uLayerOn.w>0.5){
  float gr=smoothstep(-.12,.12,fbm(p*uLayerScale.w+layerOffset(uLayerSeed.w),3)+ (uLayerCover.w-.5)*.8);
  masks.w=gr*uLayerStrength.w;
  albedo=mix(albedo,uGrainColor,masks.w);
 }
 masks.z=studyMica(p);
 return albedo;
}
'''
iq=replace(iq,'float h = uIQK;', 'float h = uIQK;')
iq=replace(iq,'return (a+b+sqrt((a-b)*(a-b)+h*h))/2.0;', '''if(h<=0.0||uMethod==0)return max(a,b);
    if(uMethod==1){float w=clamp(.5+.5*(b-a)/h,0.,1.);return mix(a,b,w)+h*w*(1.-w);}
    return (a+b+sqrt((a-b)*(a-b)+h*h))/2.0;''')
iq=replace(iq,'const float kBound = 1.0;', '''const float kBound = 1.0;
float activeBound(){return (uShapeSeed==0&&uNoiseSeed==0&&all(equal(uShapeScale,vec3(1.0)))&&uCutStrength==1.0)?kBound:1.15*max(uShapeScale.x,max(uShapeScale.y,uShapeScale.z));}''')
iq=replace(iq,'vec3 q = world_to_object(p,t);','vec3 q = world_to_object(p,t);\n    if(any(notEqual(uShapeScale,vec3(1.0))))q/=uShapeScale;')
iq=replace(iq,'vec3 rp = vec3(1.4,-1.5,1.3)*sin( float(i)*vec3(63,103,4)+2.0 );', '''vec3 rp = vec3(1.4,-1.5,1.3)*sin( float(i)*vec3(63,103,4)+2.0 );
        if(uShapeSeed!=0)rp=vec3(1.4,-1.5,1.3)*sin(float(i)*vec3(63,103,4)+2.0+float(uShapeSeed)*vec3(.71,1.13,.39));''')
iq=replace(iq,'float dp = (dot(q,rp)-1.0)/length(rp);','float dp = (dot(q,rp)-1.0)/length(rp);\n        if(uCutStrength!=1.0)dp=(dot(q,rp)-uCutStrength)/length(rp);')
iq=replace(iq,'dis = doDisp*fbm(4.0*q,oct);','dis = doDisp*fbm(4.0*q,oct);\n        if(uNoiseSeed!=0)dis=doDisp*fbm(4.0*q+vec3(float(uNoiseSeed)*.317,float(uNoiseSeed)*.713,float(uNoiseSeed)*.113),oct);')
iq=replace(iq,'return vec2(d,dis);','return vec2(d*min(uShapeScale.x,min(uShapeScale.y,uShapeScale.z)),dis);')
iq=iq.replace('iSphere( ro, rd, kBound )','iSphere( ro, rd, activeBound() )')
start=iq.index('vec3 constant_gray');end=iq.index('\n}',start)+2
vec_helper='''vec3 constant_gray_vec(vec3 value,vec3 n){n=n*n;return (value*n.x+value*n.y+value*n.z)/(n.x+n.y+n.z);}'''
iq=iq[:end]+'\n'+vec_helper+extra[extra.index('float signedSeedOffset'):]+iq[end:]
uniforms=extra[:extra.index('float signedSeedOffset')]
iq=replace(iq,'// Created by inigo',uniforms+'\n// Created by inigo')
iq=replace(iq,'vec3 opos = world_to_object(pos,time);','vec3 opos = world_to_object(pos,time);\n        if(any(notEqual(uShapeScale,vec3(1.0))))opos/=uShapeScale;')
iq=replace(iq,'vec3 mate_alb = pow(constant_gray(180.0/255.0,onor),vec3(3.0,3.2,3.0));\n        float is_mica = smoothstep(-0.15,0.15,fbm( 32.0*opos, 4 )-0.15);', '''vec4 layerMasks;
        vec3 mate_alb = layeredBase(opos,onor,layerMasks)*uTone;
        float is_mica = layerMasks.z;
        if(uSurfaceView==1)return pow(clamp(mate_alb,0.,1.),vec3(.4545));
        if(uSurfaceView>=2&&uSurfaceView<=5)return vec3(layerMasks[uSurfaceView-2]);''')
iq=replace(iq,'mate_alb *= 1.0-0.9*is_mica;','mate_alb *= 1.0-0.9*is_mica;\n        mate_alb *= mix(vec3(1.0),uMicaTint,is_mica);')
old='''const vec3 kLigPos[2] = vec3[2]( 4.0*normalize(vec3(1.0,0.6,0.1)),
                                     4.0*normalize(vec3(-1.0,0.3,-0.3)) );
    const vec3 kLigCol[2] = vec3[2]( 2.5*vec3(16.0,12.0,8.0),
                                     0.7*vec3(8.0,12.0,18.0) );'''
new='''vec3 kLigPos[2] = vec3[2](4.0*normalize(vec3(1.0,0.6,0.1)),4.0*normalize(vec3(-1.0,0.3,-0.3)));
    vec3 kLigCol[2] = vec3[2](2.5*vec3(16.0,12.0,8.0),0.7*vec3(8.0,12.0,18.0));
    if(uSharedRig==0&&uLook==1){
       kLigPos[0]=4.0*normalize(vec3(1.0,.8,-.3));kLigPos[1]=4.0*normalize(vec3(-1.0,.5,.45));
       kLigCol[0]=.65*vec3(16.0,12.0,8.0);kLigCol[1]=1.0*vec3(8.0,12.0,18.0);
    }
    if(uSharedRig==1){
       kLigPos[0]=rotateLight(kLigPos[0],uKeyAngles);kLigPos[1]=rotateLight(kLigPos[1],uFillAngles);
       kLigCol[0]*=uKeyTint*uKeyPower;kLigCol[1]*=uFillTint*uFillPower;
    }'''
iq=replace(iq,old,new)
iq=replace(iq,'col += spe*dif*mate_ks*3.0;', 'col += spe*dif*mate_ks*uSpecularScale;')
iq=replace(iq,'vec3 col = vec3(0.0,0.0,0.0);','vec3 col = uSharedRig==1?uBackground:vec3(0.0,0.0,0.0);')
S.joinpath('iq-merged.frag').write_text(iq)
wetshared=rig+'''
vec3 wetStudioLight(SurfaceSample m,vec3 p,vec3 n,vec3 v){
 vec3 lpos[2]=vec3[2](4.0*normalize(vec3(1.,.6,.1)),4.0*normalize(vec3(-1.,.3,-.3)));
 vec3 rad[2]=vec3[2](2.5*vec3(16.,12.,8.),.7*vec3(8.,12.,18.));
 lpos[0]=rotateLight(lpos[0],uKeyAngles);lpos[1]=rotateLight(lpos[1],uFillAngles);
 rad[0]*=uKeyTint*uKeyPower;rad[1]*=uFillTint*uFillPower;
 vec3 result=vec3(0.0);
 for(int i=0;i<2;i++){
  vec3 l=normalize(lpos[i]-p);
  float spot=pow(max(dot(l,normalize(lpos[i])),0.),12.0)*5.0/dot(lpos[i]-p,lpos[i]-p);
  // GGX/Smith/Schlick implementation is the inherited R04 material, not a new fake wet highlight.
  result+=lightBRDF(m,n,v,l,rad[i]*spot);
 }
 result+=.01*m.baseColor*m.occlusion*(.5-.5*n.y);
 return result;
}
vec3 studioBackdrop(vec3 ro,vec3 rd){
 vec3 col=uBackground;
 vec3 lpos[2]=vec3[2](4.0*normalize(vec3(1.,.6,.1)),4.0*normalize(vec3(-1.,.3,-.3)));
 vec3 rad[2]=vec3[2](2.5*vec3(16.,12.,8.),.7*vec3(8.,12.,18.));
 lpos[0]=rotateLight(lpos[0],uKeyAngles);lpos[1]=rotateLight(lpos[1],uFillAngles);
 rad[0]*=uKeyTint*uKeyPower;rad[1]*=uFillTint*uFillPower;
 for(int i=0;i<2;i++){vec3 l=normalize(lpos[i]-ro);float g=pow(max(0.0,dot(rd,l)),10.0);g*=exp2(5.0)/dot(lpos[i]-ro,lpos[i]-ro);col+=rad[i]*g*.0003;}
 return pow(col*1.2/(1.0+col),vec3(.4545));
}
'''
mat2=replace(mat,'void main(){',wetshared+'\nvoid main(){')
mat2=replace(mat2,'vec3 linear=uPBR==1?shadePBR(m,n,v):shadeLegacy(m,p,n,v,cavity);', 'vec3 linear=uSharedRig==1?wetStudioLight(m,p,n,v):(uPBR==1?shadePBR(m,n,v):shadeLegacy(m,p,n,v,cavity));')
mat2=replace(mat2,'outColor=vec4(clamp(color,0.0,1.0),1.0);','if(uSharedRig==1&&!(t<3.5&&p.y>-.887))color=studioBackdrop(ro,rd);\n outColor=vec4(clamp(color,0.0,1.0),1.0);')
S.joinpath('wet-material.frag').write_text(wet.replace('void main(){mainImage(outColor,gl_FragCoord.xy);}','')+'\n'+mat2)
expected={'wet-baseline.frag':'f03a5c354f54bef8d9c7d3e9b1b406e34e8a93759e592fb4d30ef1558a09e4db','wet-material-baseline.frag':'32c7b7f9860a41a15e03404c2d779239caa82b3a4173fcd843df43f0c33384a3','iq-baseline.frag':'3038d95dd183605d942115bbd78a701c970aaaaf1a8bb1205b4b5b983ebca162','iq-merged.frag':'af46bc0291e305deac8fc919d814204970b2f09e495668b226eb179046d0c0b4','wet-material.frag':'4f4eddeaf2aa71a75fa50e5de975289da94a4e6f2ddeb791fb1dc9b5a97ca0d7'}
for name,wanted in expected.items():
 f=S/name;s=re.sub(r'//[^\n]*','',f.read_text())
 assert not re.search(r'\bsampler\w*\b|\btexture\s*\(',s),name
 actual=hashlib.sha256(f.read_bytes()).hexdigest();assert actual==wanted,(name,actual,wanted)
print('All five runtime shaders reproduce the locally tested source hashes exactly.')
