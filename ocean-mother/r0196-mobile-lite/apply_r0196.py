from pathlib import Path
SRC=Path('ocean-mother/releases/Ocean_Mother_R0195_Progressive_Runtime_Direct_Open.html')
OUT=Path('ocean-mother/releases/Ocean_Mother_R0196_Mobile_Lite_Quality_Direct_Open.html')
s=SRC.read_text(encoding='utf-8')
def rep(a,b):
    global s
    if a not in s: raise RuntimeError('missing: '+a[:80])
    s=s.replace(a,b,1)
rep('float islandRadiusL(float a){return 146.*(1.+.112*sin(3.*a+.55)+.072*sin(5.*a-1.25)+.046*sin(8.*a+2.1)+.028*sin(13.*a-.2))+18.*exp(-pow(mod(a+3.14159,6.28318)-1.2,2.)*2.2)-13.*exp(-pow(a+.45,2.)*6.);}\nfloat gaussRL',
    'float islandRadiusL(float a){return 146.*(1.+.112*sin(3.*a+.55)+.072*sin(5.*a-1.25)+.046*sin(8.*a+2.1)+.028*sin(13.*a-.2))+18.*exp(-pow(mod(a+3.14159,6.28318)-1.2,2.)*2.2)-13.*exp(-pow(a+.45,2.)*6.);}\nfloat coastSignedL(vec2 p){return islandRadiusL(atan(p.y,p.x))-length(p);}float gaussRL')
old='float waveL(vec2 q,float t){float bed=bedL(q),baseDepth=max(.02,uTide-bed),shallow=smoothstep(38.,2.2,baseDepth),wet=smoothstep(.05,.8,baseDepth),shoal=mix(.72,1.+.34*uShoaling,shallow)*wet,eta=uTide;for(int i=0;i<WN;i++){vec4 w=WAVES[i];float ph=dot(w.xy,q)*w.z+sqrt(9.81*w.z)*t*uWaveSpeed+WPHASE[i];eta+=uWaveScale*w.w*shoal*(sin(ph)+.16*sin(2.*ph+.35));}return eta;}\nvec3 sunL()'
new='vec3 waveStateL(vec2 q,float t){float bed=bedL(q),baseDepth=max(.02,uTide-bed),shallow=smoothstep(38.,2.2,baseDepth),wet=smoothstep(.05,.8,baseDepth),shoal=mix(.72,1.+.34*uShoaling,shallow)*wet,eta=uTide;vec2 grad=vec2(0.);for(int i=0;i<WN;i++){vec4 w=WAVES[i];float ph=dot(w.xy,q)*w.z+sqrt(9.81*w.z)*t*uWaveSpeed+WPHASE[i];float amp=uWaveScale*w.w*shoal;eta+=amp*(sin(ph)+.16*sin(2.*ph+.35));float d=amp*w.z*(cos(ph)+.32*cos(2.*ph+.35));grad+=w.xy*d;}return vec3(eta,grad);}\nfloat waveL(vec2 q,float t){return waveStateL(q,t).x;}\nvec3 sunL()'
rep(old,new)
rep('vec3 normalWaveL(vec2 q){float e=.55,hx=waveL(q+vec2(e,0),uTime)-waveL(q-vec2(e,0),uTime),hz=waveL(q+vec2(0,e),uTime)-waveL(q-vec2(0,e),uTime);return normalize(vec3(-hx/(2.*e),1.,-hz/(2.*e)));}',
    'vec3 normalWaveL(vec2 q){vec3 w=waveStateL(q,uTime);return normalize(vec3(-w.y,1.,-w.z));}')
rep('vec3 normalBedL(vec2 q){float e=.9,','vec3 normalBedL(vec2 q){float e=1.2,')
rep('for(int i=0;i<22;i++){vec3 p=ro+rd*t;if(length(p.xz)>270.&&t>40.)break;float d=p.y-bedL(p.xz);if(d<.22){hit=t;hp=p;return true;}t+=clamp(d*.36,.8,18.);',
    'for(int i=0;i<18;i++){vec3 p=ro+rd*t;if(length(p.xz)>275.&&t>42.)break;float d=p.y-bedL(p.xz);if(d<.28){hit=t;hp=p;return true;}t+=clamp(d*.40,1.0,20.);')
rep('hp=ro+rd*t;return waveL(hp.xz,uTime)-bedL(hp.xz)>.03?t:-1.;}',
    'hp=ro+rd*t;float h=waveL(hp.xz,uTime);hp.y=h;return h-bedL(hp.xz)>.03?t:-1.;}')
marker='void main(){vec2 uv='
land='vec3 landColorL(vec3 p,vec3 n){float h=p.y,c=coastSignedL(p.xz);float beach=1.-smoothstep(5.,18.,c);float high=smoothstep(13.,36.,h);float cliff=sat((1.-n.y)*1.7);float grain=.82+.26*noise2l(p.xz*.095)+.08*noise2l(p.xz*.23+7.3);vec3 sand=vec3(.47,.34,.18),earth=vec3(.24,.20,.13),green=vec3(.065,.22,.095),rock=vec3(.30,.31,.29);vec3 base=mix(green,earth,.34+high*.34);base=mix(base,sand,beach*.92);base=mix(base,rock,cliff*.72);return base*grain;}\n'
rep(marker,land+marker)
rep('vec3 n=normalBedL(lp.xz);float h=lp.y;vec3 base=mix(vec3(.22,.17,.09),vec3(.08,.18,.08),smoothstep(3.,22.,h));base=mix(base,vec3(.34,.28,.17),smoothstep(20.,3.,abs(islandRadiusL(atan(lp.z,lp.x))-length(lp.xz))));float l=.18+.82*max(dot(n,sunL()),0.)*sunTransL();col=base*l;',
    'vec3 n=normalBedL(lp.xz),base=landColorL(lp,n);float ndl=max(dot(n,sunL()),0.),hemi=.26+.30*sat(n.y),rim=.16*pow(1.-sat(dot(n,-rd)),2.);col=base*(hemi+.78*ndl*sunTransL())+vec3(.10,.15,.14)*rim;')
rep('float dep=max(0.,waveL(wp.xz,uTime)-bedL(wp.xz));vec3 refl=skyL(reflect(rd,n));vec3 sigma=mix(vec3(.025,.012,.008),vec3(.075,.034,.020),sat(uTurbidity))/max(uClarity,.2);vec3 T=exp(-sigma*dep/max(NoV,.22));vec3 water=vec3(.012,.12,.16)*(1.-T)+vec3(.11,.20,.13)*T;col=mix(water,refl,F*.92);float spec=pow(max(dot(n,normalize(V+sunL())),0.),110.)*sunTransL();col+=vec3(1.,.76,.45)*spec*.8;',
    'float dep=max(0.,wp.y-bedL(wp.xz));vec3 refl=skyL(reflect(rd,n));vec3 sigma=mix(vec3(.025,.012,.008),vec3(.075,.034,.020),sat(uTurbidity))/max(uClarity,.2);vec3 T=exp(-sigma*dep/max(NoV,.22));vec3 deep=vec3(.010,.095,.135),shallow=vec3(.055,.24,.22),bottom=vec3(.22,.24,.14);float shallowMix=exp(-dep*.12);vec3 water=mix(deep,shallow,shallowMix);water=mix(water,bottom,T*shallowMix*.42);col=mix(water,refl,F*.90);float spec=pow(max(dot(n,normalize(V+sunL())),0.),96.)*sunTransL();float crest=sat((1.-n.y)*4.2);col+=vec3(1.,.79,.50)*spec*(.72+.35*crest)+vec3(.12,.24,.22)*crest*.18;')
rep('}col=vec3(1.)-exp(-col*uExposure);col*=1.-.13*dot(uv,uv);outColor=vec4(pow(col,vec3(.94)),1.);}`;',
    '}float fogAmt=sat(length((land?lp:wp)-uCameraPos)/max(uFog,1.));if((land)||(wt>0.))col=mix(col,skyL(rd),fogAmt*fogAmt*.38);col=vec3(1.)-exp(-col*uExposure);col*=1.-.11*dot(uv,uv);outColor=vec4(pow(col,vec3(.94)),1.);}`;')
s=s.replace('R019.5 · Progressive Runtime','R019.6 · Mobile Lite Quality').replace('R019.5 · PROGRESSIVE RUNTIME','R019.6 · MOBILE LITE QUALITY').replace("version:'R019.5-progressive-runtime-candidate'","version:'R019.6-mobile-lite-quality-candidate'")
s=s.replace("renderScale=isMobileViewport?.24:.34","renderScale=isMobileViewport?.30:.34").replace("else if(isMobileViewport){renderScale=Math.min(renderScale,.20);quality='performance';}","else if(isMobileViewport){renderScale=Math.min(renderScale,.30);quality='performance';}").replace("renderScale=isSoftware?.16:(isMobileViewport?.20:.30);","renderScale=isSoftware?.16:(isMobileViewport?.30:.30);")
s=s.replace("else if(liteProgramReady&&!fullProgramReady&&fps>32){next=Math.min(isMobileViewport?.28:.42,renderScale+.015);}","else if(liteProgramReady&&!fullProgramReady&&fps>30){next=Math.min(isMobileViewport?.40:.42,renderScale+.018);}")
rep("const minW=isSoftware?112:(isMobileViewport?220:280),minH=isSoftware?72:(isMobileViewport?150:190);w=Math.max(minW,w);h=Math.max(minH,h);const budget=isSoftware?8500:(quality==='cinematic'?(isMobileViewport?220000:900000):(quality==='balanced'?(isMobileViewport?150000:520000):(isMobileViewport?90000:260000)));",
    "const liteOnly=liteProgramReady&&!fullProgramReady;const minW=isSoftware?112:(isMobileViewport?(liteOnly?280:220):280),minH=isSoftware?72:(isMobileViewport?(liteOnly?190:150):190);w=Math.max(minW,w);h=Math.max(minH,h);const budget=isSoftware?8500:(quality==='cinematic'?(isMobileViewport?220000:900000):(quality==='balanced'?(isMobileViewport?150000:520000):(isMobileViewport?(liteOnly?175000:90000):260000)));")
s=s.replace("Object.assign(camera,{yaw:-.78,pitch:.08,dist:105,target:[610,0,390]});","Object.assign(camera,{yaw:-.78,pitch:.15,dist:132,target:[610,0,390]});")
s=s.replace("statusMain.textContent='轻量 Ocean 核运行中';statusSub.textContent='稳定优先 · 精细核尚未加载';","statusMain.textContent='轻量 Ocean 核运行中';statusSub.textContent='移动核清晰度优先 · 精细核尚未加载';")
OUT.write_text(s,encoding='utf-8')
print(OUT)
