#!/usr/bin/env python3
from __future__ import annotations
import hashlib,json,math,struct,sys
from pathlib import Path
import numpy as np

DT=np.dtype([('q','<u2',(3,)),('n','<i2',(3,)),('f1','u1',(4,)),('f2','u1',(4,)),('f3','u1',(4,)),('f4','u1',(4,)),('pad','u1',(4,))])

def smooth(x):
    x=np.clip(x,0.0,1.0); return x*x*(3.0-2.0*x)

def rep(text,old,new):
    if old not in text: raise RuntimeError('missing token: '+old[:100])
    return text.replace(old,new,1)

def wq(v,w,q):
    o=np.argsort(v); v=v[o]; w=w[o]; c=np.cumsum(w); return float(v[np.searchsorted(c,q*c[-1])])

def main(root:Path):
    scene=root/'scene.bin'; meta_path=root/'SCENE_META.json'
    data=bytearray(scene.read_bytes())
    if bytes(data[:4])!=b'LMF5': raise RuntimeError('bad magic')
    version,stride,nv,ni=struct.unpack_from('<4I',data,4)
    mn=np.array(struct.unpack_from('<3f',data,20),float); mx=np.array(struct.unpack_from('<3f',data,32),float)
    vo,io,nt=struct.unpack_from('<3I',data,44)
    if version!=5 or stride!=32: raise RuntimeError('unsupported scene')
    vv=np.frombuffer(data,dtype=DT,count=nv,offset=vo); ind=np.frombuffer(data,dtype='<u4',count=ni,offset=io)
    pos=mn+vv['q'].astype(float)/65535.0*(mx-mn)
    tids=vv['f4'][:,3].astype(int); material=vv['f1'][:,0]
    meta=json.loads(meta_path.read_text())
    old_receipt={int(x['id']):x for x in meta.get('towerProfileReceipt',[])}
    receipt=[]
    for t in meta['towers']:
        tid=int(t['id']); mask=tids==tid; p=pos[mask]
        center=np.array(t['sourcePeakPositionM'],float); base=float(t['sourceBaseElevationM']); h=float(t['renderRelativeHeightM'])
        top=float(p[:,1].max()); hn=np.clip((p[:,1]-base)/max(top-base,1.0),0,1)
        dx=p[:,0]-center[0]; dz=p[:,2]-center[1]; r=np.hypot(dx,dz); a=np.arctan2(dz,dx)
        current=float(old_receipt.get(tid,{}).get('baseRadiusM',max(1,np.quantile(r[hn<.12],.90) if np.any(hn<.12) else np.quantile(r,.90))))
        target=max(28.0,min(float(t['sourceMaximumInteriorDistanceM'])*.46,h*.49))
        base_scale=target/max(current,1.0)
        height_scale=base_scale*(1.0-.22*smooth((hn-.55)/.45))
        phase=(tid*1.61803398875)%(2*math.pi)
        facet=1.0+.055*np.sin(5*a+phase)*smooth(hn/.82)+.028*np.sin(11*a-phase*.7)*smooth(hn/.90)
        scale=height_scale*facet
        lean=min(9.0,h*.055)*hn**1.6
        p[:,0]=center[0]+dx*scale+math.cos(phase+.6)*lean
        p[:,2]=center[1]+dz*scale+math.sin(phase+.6)*lean
        rr=np.hypot(p[:,0]-center[0],p[:,2]-center[1])
        crown=smooth((hn-.70)/.30)
        local=rr/max(target*.52,1.0)
        p[:,1]-=h*.105*crown*np.clip(local,0,1.3)**1.45
        p[:,1]-=h*.022*crown*(.5+.5*np.sin(3*a+phase))*smooth((local-.18)/.8)
        p[:,1]=np.minimum(p[:,1],top)
        pos[mask]=p
        t['renderRelativeHeightM']=float(p[:,1].max()-base)
        receipt.append({'id':tid,'baseRadiusM':float(target),'widthM':float(target*2),'heightM':t['renderRelativeHeightM'],'heightWidthRatio':float(t['renderRelativeHeightM']/max(target*2,1))})
    q=np.clip(np.rint((pos-mn)/(mx-mn)*65535.0),0,65535).astype(np.uint16); vv['q'][:]=q
    pp=mn+q.astype(float)/65535.0*(mx-mn); tri=ind.reshape(-1,3)
    cr=np.cross(pp[tri[:,1]]-pp[tri[:,0]],pp[tri[:,2]]-pp[tri[:,0]]); ar2=np.linalg.norm(cr,axis=1)
    fn=np.divide(cr,ar2[:,None],out=np.zeros_like(cr),where=ar2[:,None]>1e-12)
    acc=np.zeros((nv,3),float)
    np.add.at(acc,tri[:,0],fn); np.add.at(acc,tri[:,1],fn); np.add.at(acc,tri[:,2],fn)
    ln=np.linalg.norm(acc,axis=1); acc[ln>0]/=ln[ln>0,None]
    vv['n'][:]=np.clip(np.rint(acc*32767),-32767,32767).astype(np.int16)
    scene.write_bytes(data)
    areas=ar2*.5; slopes=np.degrees(np.arccos(np.clip(np.abs(fn[:,1]),0,1))); tf=np.all(material[tri]==1,axis=1); valid=tf&(areas>1e-10)
    sw=areas[valid]; sv=slopes[valid]; total=float(sw.sum()); high=sv>=45
    sc=meta['scene']; heights=[float(t['renderRelativeHeightM']) for t in meta['towers']]
    sc['binarySha256']=hashlib.sha256(scene.read_bytes()).hexdigest(); sc['binaryBytes']=scene.stat().st_size
    sc['renderRelativeHeightRangeM']=[min(heights),max(heights)]; sc['areaWeightedMeanSlopeDeg']=float(np.sum(sv*sw)/total)
    sc['areaWeightedMeanSlope45PlusDeg']=float(np.sum(sv[high]*sw[high])/sw[high].sum()); sc['areaWeightedP50SlopeDeg']=wq(sv,sw,.5); sc['areaWeightedP90SlopeDeg']=wq(sv,sw,.9)
    for th in [45,60,75,80,87,89]: sc[f'areaRatioSlope{th}Plus']=float(sw[sv>=th].sum()/total)
    sc['tinyFaceCountLt1e8']=int(np.sum(areas<1e-8)); sc['slopeStatisticsScope']='tower surfaces only; ground excluded'
    meta['schema']='landscape-mother-guilin-putao-fenglin-v015-progress/2'; meta['version']='V015P2'; meta['prototype']='Guilin Putao narrow tower forest progress P2'; meta['towerProfileReceipt']=receipt
    meta['visualRevision']={'status':'progress candidate P2','changes':['tower width reduced to roughly 0.92 to 0.98 of height','lower walls retained as continuous steep bands','upper shoulders and crowns contracted again','camera moved into the peak forest','limestone contrast and plain illumination rebalanced'],'visualApproved':False,'visualAcceptance':False,'productionReady':False}
    meta['approvals']={'visualApproved':False,'visualAcceptance':False,'productionReady':False}
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')

    ap=root/'app.js'; s=ap.read_text()
    pairs={
      "tour:true,vivid:1.03,clarity:1.02,rockLight:1.08,plainLight:.92,":"tour:true,vivid:1.08,clarity:1.06,rockLight:.94,plainLight:1.06,",
      "limestone:1.02,warmth:.46,fresh:.78,micro:.52,":"limestone:1.02,warmth:.48,fresh:.82,micro:.58,",
      "vegetation:.82,moss:.68,lichen:.56,plainGreen:.88,":"vegetation:.80,moss:.72,lichen:.58,plainGreen:.94,",
      "waterStain:1.08,iron:.58,wet:.20,cavity:.84,":"waterStain:1.18,iron:.62,wet:.22,cavity:.90,",
      "sun:4.10,sky:.80,inspect:.40,exposure:1.04,mode:0":"sun:3.45,sky:.94,inspect:.32,exposure:.96,mode:0",
      "vec3 grassDeep=s2l(vec3(.035,.105,.032));":"vec3 grassDeep=s2l(vec3(.036,.130,.034));",
      "vec3 grassMid=s2l(vec3(.080,.255,.055));":"vec3 grassMid=s2l(vec3(.090,.305,.060));",
      "vec3 grassSun=s2l(vec3(.190,.410,.085));":"vec3 grassSun=s2l(vec3(.225,.465,.095));",
      "vec3 limestoneCool=s2l(vec3(.385,.405,.397));":"vec3 limestoneCool=s2l(vec3(.255,.285,.280));",
      "vec3 limestoneWarm=s2l(vec3(.525,.492,.402));":"vec3 limestoneWarm=s2l(vec3(.445,.408,.325));",
      "vec3 limestonePale=s2l(vec3(.675,.690,.642));":"vec3 limestonePale=s2l(vec3(.600,.620,.575));",
      "vec3 weathered=s2l(vec3(.405,.380,.315));":"vec3 weathered=s2l(vec3(.335,.300,.235));",
      "vec3 calcite=s2l(vec3(.760,.770,.725));":"vec3 calcite=s2l(vec3(.690,.710,.670));",
      "float directVisibility=mix(1.0,.26,castShadow*.82);":"float directVisibility=mix(1.0,.46,castShadow*.78);",
      "version:'V015P1'":"version:'V015P2'",
      "subtitle.textContent='V015 进展版 · '+m.scene.towerCount+' 座收束塔峰 · 峰冠与崖壁已重构';":"subtitle.textContent='V015 P2 · '+m.scene.towerCount+' 座窄体塔峰 · 已进入峰林内部观察';",
      "showToast('<b>桂林葡萄峰林 V015 进展版</b> · 峰冠、陡壁与综合色彩已重构');":"showToast('<b>桂林葡萄峰林 V015 P2</b> · 窄峰、陡壁和石灰岩综合色彩已载入');",
      "let views={},camera={yaw:.78,pitch:.18,dist:3900,target:[0,160,0]},activeView='hero';":"let views={},camera={yaw:.82,pitch:.04,dist:2150,target:[-350,160,-260]},activeView='hero';",
      "hero:{yaw:.82,pitch:.18,dist:width*.92,target:[0,158,0]},":"hero:{yaw:.82,pitch:.04,dist:width*.54,target:[-350,160,-260]},",
      "forest:{yaw:1.08,pitch:.14,dist:width*.62,target:[-120,158,-260]},":"forest:{yaw:1.02,pitch:.025,dist:width*.39,target:[-390,160,-330]},",
      "cliff:{yaw:1.48,pitch:.10,dist:Math.max(430,tallest.renderRelativeHeightM*3.1),":"cliff:{yaw:1.48,pitch:.055,dist:Math.max(330,tallest.renderRelativeHeightM*2.55),",
      "const fov=innerWidth<720?.92:.70;":"const fov=innerWidth<720?.78:.62;"
    }
    for o,n in pairs.items(): s=rep(s,o,n)
    ap.write_text(s)
    ip=root/'index.html'; htxt=ip.read_text(); htxt=htxt.replace('桂林葡萄峰林 V015 进展版','桂林葡萄峰林 V015 P2 进展版').replace('收束峰冠 · 连续陡壁','窄体塔峰 · 连续陡壁'); ip.write_text(htxt)
    (root/'PROGRESS_NOTES.md').write_text('# Landscape Mother 桂林葡萄峰林 V015 P2\n\n第二次进展收敛：峰体宽度约束到高度的同量级，视角进入峰林内部，石灰岩和峰间平原重新配色。\n\n人工视觉批准、视觉验收和生产就绪均为 false。\n')
    print(json.dumps({'version':meta['version'],'heightRangeM':sc['renderRelativeHeightRangeM'],'meanSlopeDeg':sc['areaWeightedMeanSlopeDeg'],'p90SlopeDeg':sc['areaWeightedP90SlopeDeg'],'area87Plus':sc['areaRatioSlope87Plus'],'profiles':receipt},ensure_ascii=False,indent=2))

if __name__=='__main__':
    if len(sys.argv)!=2: raise SystemExit('usage: retune_v015_p2.py <runtime-dir>')
    main(Path(sys.argv[1]).resolve())
