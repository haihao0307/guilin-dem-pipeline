from pathlib import Path

SRC=Path('ocean-mother/releases/Ocean_Mother_R0196_Mobile_Lite_Quality_Direct_Open.html')
OUT=Path('ocean-mother/releases/Ocean_Mother_R0197_Mobile_Heightfield_Direct_Open.html')
s=SRC.read_text(encoding='utf-8')

def rep(a,b):
    global s
    if a not in s:
        raise RuntimeError('missing: '+a[:120])
    s=s.replace(a,b,1)

rep('<title>Ocean Mother R019.6 · Mobile Lite Quality</title>','<title>Ocean Mother R019.7 · Mobile Heightfield</title>')
s=s.replace('R019.6 · MOBILE LITE QUALITY','R019.7 · MOBILE HEIGHTFIELD')
s=s.replace("version:'R019.6-mobile-lite-quality-candidate'","version:'R019.7-mobile-heightfield-candidate'")

old_trace='bool traceLandL(vec3 ro,vec3 rd,float maxT,out float hit,out vec3 hp){float t=2.;for(int i=0;i<18;i++){vec3 p=ro+rd*t;if(length(p.xz)>275.&&t>42.)break;float d=p.y-bedL(p.xz);if(d<.28){hit=t;hp=p;return true;}t+=clamp(d*.40,1.0,20.);if(t>maxT||p.y<-45.)break;}return false;}'
new_trace='bool traceLandL(vec3 ro,vec3 rd,float maxT,out float hit,out vec3 hp){float t=2.,prevT=2.;for(int i=0;i<20;i++){vec3 p=ro+rd*t;if(length(p.xz)>280.&&t>42.)break;float surface=bedL(p.xz),d=p.y-surface;if(d<=0.){float lo=prevT,hi=t;for(int j=0;j<4;j++){float mid=.5*(lo+hi);vec3 mp=ro+rd*mid;float md=mp.y-bedL(mp.xz);if(md>0.)lo=mid;else hi=mid;}hit=hi;hp=ro+rd*hit;hp.y=bedL(hp.xz);return true;}if(d<.10){hit=t;hp=p;hp.y=surface;return true;}prevT=t;t+=clamp(d*.32,.75,15.);if(t>maxT||p.y<-45.)break;}return false;}'
rep(old_trace,new_trace)

old_head='bool land=uDeepMode==0&&traceLandL(uCameraPos,rd,min(uFog,850.),lt,lp);float wt=traceWaterL(uCameraPos,rd,wp);if(land&&(wt<0.||lt<wt)){'
new_head='bool land=uDeepMode==0&&traceLandL(uCameraPos,rd,min(uFog,850.),lt,lp);float wt=traceWaterL(uCameraPos,rd,wp);bool frontLand=land&&(wt<0.||lt<wt);if(frontLand){'
rep(old_head,new_head)

old_mat='vec3 n=normalBedL(lp.xz);float hL=lp.y,cL=coastSignedL(lp.xz);float beachL=1.-smoothstep(5.,18.,cL),highL=smoothstep(13.,36.,hL),cliffL=sat((1.-n.y)*1.7);float grainL=.82+.26*noise2l(lp.xz*.095)+.08*noise2l(lp.xz*.23+vec2(7.3));vec3 sandL=vec3(.47,.34,.18),earthL=vec3(.24,.20,.13),greenL=vec3(.065,.22,.095),rockL=vec3(.30,.31,.29);vec3 base=mix(greenL,earthL,.34+highL*.34);base=mix(base,sandL,beachL*.92);base=mix(base,rockL,cliffL*.72);base*=grainL;float ndl=max(dot(n,sunL()),0.),hemi=.26+.30*sat(n.y),rim=.16*pow(1.-sat(dot(n,-rd)),2.);col=base*(hemi+.78*ndl*sunTransL())+vec3(.10,.15,.14)*rim;'
new_mat='vec3 n=normalBedL(lp.xz);float hL=lp.y,cL=coastSignedL(lp.xz);float beachL=1.-smoothstep(4.,15.,cL),altL=smoothstep(2.,46.,hL),cliffL=sat((1.-n.y)*2.15),wetL=1.-smoothstep(.4,4.8,hL);float macroL=fbm2l(lp.xz*.032),detailL=noise2l(lp.xz*.16+vec2(11.7));vec3 sandL=vec3(.50,.35,.18),soilL=vec3(.25,.16,.075),greenLowL=vec3(.045,.19,.065),greenHighL=vec3(.11,.29,.12),rockL=vec3(.30,.31,.27);vec3 base=mix(greenLowL,greenHighL,altL);base=mix(base,soilL,(.12+.26*detailL)*smoothstep(7.,32.,hL));base=mix(base,sandL,beachL*.88);base=mix(base,rockL,cliffL*.78);base*=.80+.34*macroL;base=mix(base,base*vec3(.48,.67,.60),wetL*.42);float ndl=max(dot(n,sunL()),0.),hemi=.46+.26*sat(n.y),rim=.11*pow(1.-sat(dot(n,-rd)),2.);float relief=.88+.12*sat(n.y)+.10*(detailL-.5);col=base*relief*(hemi+1.04*ndl*sunTransL())+vec3(.07,.105,.09)*rim;'
rep(old_mat,new_mat)

old_fog='float fogAmt=sat(length((land?lp:wp)-uCameraPos)/max(uFog,1.));if((land)||(wt>0.))col=mix(col,skyL(rd),fogAmt*fogAmt*.38);'
new_fog='float fogAmt=sat(length((frontLand?lp:wp)-uCameraPos)/max(uFog,1.));if(frontLand)col=mix(col,skyL(rd),fogAmt*fogAmt*.11);else if(wt>0.)col=mix(col,skyL(rd),fogAmt*fogAmt*.38);'
rep(old_fog,new_fog)

old_resize="const liteOnly=liteProgramReady&&!fullProgramReady;const minW=isSoftware?112:(isMobileViewport?(liteOnly?280:220):280),minH=isSoftware?72:(isMobileViewport?(liteOnly?190:150):190);w=Math.max(minW,w);h=Math.max(minH,h);const budget=isSoftware?8500:(quality==='cinematic'?(isMobileViewport?220000:900000):(quality==='balanced'?(isMobileViewport?150000:520000):(isMobileViewport?(liteOnly?175000:90000):260000)));"
new_resize="const liteOnly=liteProgramReady&&!fullProgramReady;const minW=isSoftware?112:(isMobileViewport?(liteOnly?320:220):280),minH=isSoftware?72:(isMobileViewport?(liteOnly?220:150):190);w=Math.max(minW,w);h=Math.max(minH,h);const budget=isSoftware?8500:(quality==='cinematic'?(isMobileViewport?220000:900000):(quality==='balanced'?(isMobileViewport?170000:520000):(isMobileViewport?(liteOnly?205000:90000):260000)));"
rep(old_resize,new_resize)
s=s.replace("next=Math.min(isMobileViewport?.40:.42,renderScale+.018)","next=Math.min(isMobileViewport?.42:.42,renderScale+.016)")
s=s.replace("statusMain.textContent='轻量 Ocean 核运行中';statusSub.textContent='移动核清晰度优先 · 精细核尚未加载';","statusMain.textContent='轻量 Ocean 核运行中';statusSub.textContent='高度场命中已锁定 · 移动清晰度优先';")

OUT.write_text(s,encoding='utf-8')
print(OUT)
