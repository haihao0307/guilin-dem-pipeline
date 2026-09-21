from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def main() -> None:
    pages = Path(sys.argv[1] if len(sys.argv) > 1 else "pages")
    src = pages / "coral-mother-r06-pocillopora-t04-microscope-color" / "index.html"
    if not src.exists():
        raise FileNotFoundError(src)
    html = src.read_text(encoding="utf-8")

    def rep(old: str, new: str, count: int = 1) -> None:
        nonlocal html
        if old not in html:
            raise AssertionError(old[:220])
        html = html.replace(old, new, count)

    rep("<title>Coral Mother R06 · Microscope Surface + Vivid Color T04</title>", "<title>Coral Mother R06 · Continuous Tube Growth T05</title>")
    rep("PROCEDURAL · R06-T04", "PROCEDURAL · R06-T05")
    rep("三频 Microscope 波场 + 高饱和活组织色；0 GLB / 0 texture", "连续管状生长函数 + Microscope 表面场；0 GLB / 0 texture")
    rep("Coral Mother R06 · Pocillopora Microscope 表面 T04", "Coral Mother R06 · Pocillopora 连续管状生长 T05")
    rep("MICROSCOPE / VIVID LIVE COLOR · visualAcceptance=false", "CONTINUOUS TUBE / MICROSCOPE SURFACE · visualAcceptance=false")
    rep(
        "继续保持标本／函数 A/B。大形体不变；硬珊瑚表面改为三频 Microscope 解析波场，强化珊瑚杯、杯缘、细脊和骨骼颗粒，同时不增加贴图与重几何。",
        "继续保持标本／函数 A/B。枝图不再逐边造柱，而是提取连续生长路径，用平行传输截面生成完整管状枝体；Microscope 仅负责珊瑚杯、细脊和骨骼颗粒。",
    )
    rep("<button id=\"microscope\">Microscope 近镜</button>", "")
    rep("<span id=\"tri\">-- TRI</span>", "<span id=\"fieldStats\">-- PATHS</span>")
    rep("Graph nodes / edges", "Growth paths / samples")
    rep("<b>726 / 725</b>", "<b id=\"pathStats\">--</b>")
    rep("<span>Species kernel</span><b>NOT YET</b>", "<span>Tube continuity</span><b>ACTIVE</b>")
    rep("珊瑚杯尺度", "Microscope 尺度")
    rep("解析波场频率；不增加三角面", "珊瑚杯与杯缘频率；0 贴图")
    rep("Microscope 强度", "Microscope 凹凸")
    rep("三频杯缘、细脊与凹陷；0 贴图", "杯缘、细脊与颗粒的法线扰动")
    rep(
        "本轮只解决硬珊瑚表面过光滑和缺少活体色的问题。珊瑚杯与颗粒是低成本解析波场，不是物种级 corallite 真值；P. damicornis 的枝序与包络仍需继续 A/B 收敛，visualAcceptance 保持 false。",
        "本轮先解决逐段圆柱造成的枝体断续：连续路径共享管环和截面框架，分叉仅在 junction 处平滑连接。Microscope 仍是低成本表面函数，不是镜头；物种级 corallite 与最终形态仍需继续 A/B 收敛。",
    )
    html = html.replace("三角面", "几何采样")

    geometry = r"""
function smoothstep01(t){t=clamp(t,0,1);return t*t*(3-2*t)}
function hermite(p0,p1,m0,m1,t){const t2=t*t,t3=t2*t,h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;return add(add(mul(p0,h00),mul(m0,h10)),add(mul(p1,h01),mul(m1,h11)))}
function pathSamples(ids,subdiv=3){const out=[];for(let s=0;s<ids.length-1;s++){const i0=ids[Math.max(0,s-1)],i1=ids[s],i2=ids[s+1],i3=ids[Math.min(ids.length-1,s+2)],A=nodes[i1],B=nodes[i2],P0=nodes[i0].p,P1=A.p,P2=B.p,P3=nodes[i3].p,m0=mul(sub(P2,P0),.5),m1=mul(sub(P3,P1),.5);for(let j=0;j<subdiv;j++){const t=j/subdiv,e=smoothstep01(t);out.push({p:hermite(P1,P2,m0,m1,t),r:mix(A.r,B.r,e),order:Math.max(A.order,B.order)})}}const z=nodes[ids[ids.length-1]];out.push({p:z.p.slice(),r:z.r,order:z.order});return out}
function transportFrames(samples){const frames=[],tans=[];for(let i=0;i<samples.length;i++){const p0=samples[Math.max(0,i-1)].p,p1=samples[Math.min(samples.length-1,i+1)].p;tans.push(norm(sub(p1,p0)))}let n=norm(cross(Math.abs(tans[0][1])<.86?[0,1,0]:[1,0,0],tans[0]));for(let i=0;i<samples.length;i++){const t=tans[i];if(i){const projected=sub(n,mul(t,dot(n,t)));n=len(projected)>.001?norm(projected):norm(cross(Math.abs(t[1])<.86?[0,1,0]:[1,0,0],t))}const b=norm(cross(t,n));n=norm(cross(b,t));frames.push({t,n,b})}return frames}
function continuousTube(m,samples,col,sides=10,rough=.22,capStart=false,capEnd=false){if(samples.length<2)return{rings:0,samples:0};const work=samples.map(s=>({p:s.p.slice(),r:s.r,order:s.order}));if(capStart){const t=norm(sub(work[1].p,work[0].p)),base=work[0],r=base.r;work.unshift({p:add(base.p,mul(t,-r*.42)),r:r*.72,order:base.order},{p:add(base.p,mul(t,-r*.78)),r:r*.30,order:base.order},{p:add(base.p,mul(t,-r*.92)),r:.025*r,order:base.order})}if(capEnd){const n=work.length,t=norm(sub(work[n-1].p,work[n-2].p)),base=work[n-1],r=base.r;work.push({p:add(base.p,mul(t,r*.42)),r:r*.72,order:base.order},{p:add(base.p,mul(t,r*.78)),r:r*.30,order:base.order},{p:add(base.p,mul(t,r*.92)),r:.025*r,order:base.order})}const frames=transportFrames(work),rings=[];let arc=0;for(let i=0;i<work.length;i++){if(i)arc+=len(sub(work[i].p,work[i-1].p));const F=frames[i],ring=[];for(let j=0;j<sides;j++){const q=j/sides*TAU,cs=Math.cos(q),sn=Math.sin(q),radial=norm(add(mul(F.n,cs),mul(F.b,sn))),wave=1+rough*.012*Math.sin(q*5+arc*17)+rough*.008*Math.sin(q*9-arc*11),p=add(work[i].p,mul(radial,work[i].r*cfg.thickness*wave));ring.push({p,n:radial})}rings.push(ring)}for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides,A=rings[i][j],B=rings[i][k],C=rings[i+1][k],D=rings[i+1][j];m.q(A.p,B.p,C.p,D.p,col,A.n,B.n,C.n,D.n)}return{rings:rings.length,samples:work.length}}
function junctionPatch(m,c,r,col,lat=5,lon=10){const P=(i,j)=>{const th=PI*i/lat,ph=TAU*j/lon,s=Math.sin(th),n=[s*Math.cos(ph),Math.cos(th),s*Math.sin(ph)],p=add(c,mul(n,r));return{p,n}};for(let i=0;i<lat;i++)for(let j=0;j<lon;j++){const A=P(i,j),B=P(i+1,j),C=P(i+1,j+1),D=P(i,j+1);m.t(A.p,C.p,B.p,col,col,col,A.n,C.n,B.n);m.t(A.p,D.p,C.p,col,col,col,A.n,D.n,C.n)}}
const adjacency=nodes.map(()=>[]);for(const [a,b] of edges){adjacency[a].push(b);adjacency[b].push(a)}
function edgeKey(a,b){return a<b?a+'_'+b:b+'_'+a}
function extractGrowthPaths(){const seen=new Set(),paths=[];for(let start=0;start<nodes.length;start++){if(adjacency[start].length===2)continue;for(const first of adjacency[start]){const k=edgeKey(start,first);if(seen.has(k))continue;const ids=[start];let prev=start,cur=first;seen.add(k);while(true){ids.push(cur);if(adjacency[cur].length!==2)break;const next=adjacency[cur][0]===prev?adjacency[cur][1]:adjacency[cur][0],ek=edgeKey(cur,next);if(seen.has(ek))break;seen.add(ek);prev=cur;cur=next}if(ids.length>1)paths.push(ids)}}for(const [a,b] of edges){const k=edgeKey(a,b);if(seen.has(k))continue;const ids=[a],origin=a;let prev=a,cur=b;seen.add(k);for(let guard=0;guard<nodes.length+2;guard++){ids.push(cur);const nexts=adjacency[cur].filter(x=>x!==prev),next=nexts[0];if(next===undefined||next===origin)break;const ek=edgeKey(cur,next);if(seen.has(ek))break;seen.add(ek);prev=cur;cur=next}if(ids.length>1)paths.push(ids)}return paths}
const growthPaths=extractGrowthPaths();
"""

    html, count = re.subn(r"function cyl\(m,a,b,r0,r1,col,seg=8,rough=\.35\).*?function sphere\(m,c,r,col,lat=5,lon=8,rough=\.2\).*?\nconst colors=", geometry + "\nconst colors=", html, count=1, flags=re.S)
    if count != 1:
        raise AssertionError("geometry helpers")

    rebuild = r"""
function rebuild(){const m=new Mesh(),dbg=[];let activePaths=0,tubeSamples=0,tubeRings=0,activeEdges=0;for(const ids of growthPaths){let keep=false;for(let q=0;q<ids.length;q++)if(nodes[ids[q]].r>=cfg.fine){keep=true;break}if(!keep)continue;const filtered=ids.filter((id,i)=>nodes[id].r>=cfg.fine||i===0||i===ids.length-1);if(filtered.length<2)continue;const first=filtered[0],last=filtered[filtered.length-1],samples=pathSamples(filtered,3),order=samples.reduce((m,s)=>Math.max(m,s.order),0),col=colorFor(order),startTip=adjacency[first].length===1&&nodes[first].p[1]>.30,endTip=adjacency[last].length===1&&nodes[last].p[1]>.30,stat=continuousTube(m,samples,col,10,cfg.rough,startTip,endTip);activePaths++;tubeSamples+=stat.samples;tubeRings+=stat.rings;activeEdges+=Math.max(1,filtered.length-1)}for(let i=0;i<nodes.length;i++){const n=nodes[i];if(n.r<cfg.fine)continue;if(adjacency[i].length>=3){const rad=n.r*cfg.thickness*.88;junctionPatch(m,n.p,rad,colorFor(n.order),5,10)}if(cfg.diag==='tips'&&adjacency[i].length!==2){const isTip=adjacency[i].length===1,c=isTip?colors.tip:colors.node;dbg.push(...n.p,0,1,0,...c)}}if(cfg.verrucae>0){for(const [ai,bi] of edges){const A=nodes[ai],B=nodes[bi],rr=Math.min(A.r,B.r);if(rr<Math.max(cfg.fine,.052))continue;const chance=h01(ai*92821+bi*68917);if(chance>=cfg.verrucae*.24)continue;const t=.26+.48*h01(ai*311+bi*47),p=add(A.p,mul(sub(B.p,A.p),t)),w=norm(sub(B.p,A.p)),u=norm(cross(Math.abs(w[1])<.86?[0,1,0]:[1,0,0],w)),v=cross(w,u),ang=TAU*h01(ai*71+bi*131),out=norm(add(mul(u,Math.cos(ang)),mul(v,Math.sin(ang)))),L=rr*(.42+.48*h01(ai*17+bi*19)),side=mul(w,L*.10),tip=add(add(p,mul(out,L)),side),mid=add(add(p,mul(out,L*.48)),mul(side,.35)),bud=[{p,r:rr*.30,order:Math.max(A.order,B.order)},{p:mid,r:rr*.25,order:Math.max(A.order,B.order)+1},{p:tip,r:rr*.16,order:Math.max(A.order,B.order)+1}],stat=continuousTube(m,bud,colorFor(Math.max(A.order,B.order)+1),8,cfg.rough,false,true);tubeSamples+=stat.samples;tubeRings+=stat.rings}}upload(genGpu,m.d);upload(dbgGpu,dbg,gl.POINTS);const ext=m.max.map((x,i)=>x-m.min[i]),refExt=[4,3.077359,1.840004],eWH=Math.abs(ext[0]/ext[1]-refExt[0]/refExt[1])/(refExt[0]/refExt[1]),eDH=Math.abs(ext[2]/ext[1]-refExt[2]/refExt[1])/(refExt[2]/refExt[1]),err=100*(eWH+eDH)/2;$('genExt').textContent=ext.map(x=>x.toFixed(3)).join(' : ');$('ratioErr').textContent=err.toFixed(1)+'%';$('ratioCard').className='qaCard '+(err<8?'good':err<16?'warn':'');$('extentCard').className='qaCard '+(err<8?'good':'');$('fieldStats').textContent=activePaths+' PATHS / '+tubeRings+' RINGS';$('pathStats').textContent=activePaths+' / '+tubeSamples;window.__CORAL_R06_QA__={ready:true,errors:[],referencePoints:ref.length,nodes:nodes.length,sourceEdges:edges.length,activeEdges,growthPaths:activePaths,tubeSamples,tubeRings,junctions:nodes.filter((n,i)=>adjacency[i].length>=3).length,extent:ext,aspectErrorPct:err,noExternalAssets:true,runtimeGLB:0,runtimeTextures:0,networkFetches:0,surfaceTextureBytes:0,continuousTube:true,frameTransport:'parallel-transport',microscopeRole:'surface-scale analytic function',microDetailMode:'3-band analytic surface field',palette:cfg.palette,visualAcceptance:false,productionReady:false}}
"""
    html, count = re.subn(r"function rebuild\(\)\{.*?\}\nconst camera=", rebuild + "\nconst camera=", html, count=1, flags=re.S)
    if count != 1:
        raise AssertionError("rebuild")

    rep(
        "$('microscope').onclick=()=>{camera.yaw=.76;camera.pitch=.18;camera.dist=4.25;cfg.compare='gen';document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('on',x.dataset.mode==='gen'));$('viewName').textContent='MICROSCOPE CLOSE';};$('reset').onclick=()=>setView(cfg.view);",
        "$('reset').onclick=()=>setView(cfg.view);",
    )
    rep(
        "window.__CORAL_R06_T04__={\"ready\":true,\"version\":\"R06-T04\",\"surface\":\"3-band analytic microscope wave\",\"surfaceTextureBytes\":0,\"defaultPalette\":\"magenta\",\"paletteCount\":7,\"stageOverlayText\":0,\"customClassesAllowed\":false,\"visualAcceptance\":false};",
        "window.__CORAL_R06_T05__={\"ready\":true,\"version\":\"R06-T05\",\"geometry\":\"continuous swept tube on maximal growth paths\",\"frameTransport\":\"parallel-transport\",\"junctionBlend\":\"single smooth patch per junction\",\"microscopeRole\":\"surface scale only\",\"surfaceTextureBytes\":0,\"defaultPalette\":\"magenta\",\"paletteCount\":7,\"stageOverlayText\":0,\"customClassesAllowed\":false,\"visualAcceptance\":false,\"productionReady\":false};",
    )
    html = html.replace("R06-T04", "R06-T05")

    low = html.lower()
    assert "fetch(" not in html and ".glb" not in low
    assert "id=\"microscope\"" not in low
    assert "-- tri" not in low and ">tri<" not in low
    assert "continuousTube" in html and "extractGrowthPaths" in html and "parallel-transport" in html
    assert "window.__CORAL_R06_T05__" in html

    out = pages / "coral-mother-r06-pocillopora-t05-continuous-tube"
    out.mkdir(parents=True, exist_ok=True)
    data = html.encode("utf-8")
    (out / "index.html").write_bytes(data)
    qa = {
        "schema": "CORAL_MOTHER_R06_T05_CONTINUOUS_TUBE_QA",
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "directSingleFile": True,
        "runtimeGLB": 0,
        "runtimeTextures": 0,
        "surfaceTextureBytes": 0,
        "networkFetchCalls": 0,
        "geometry": "continuous swept tube",
        "pathExtraction": "maximal junction-to-junction / junction-to-tip",
        "frameTransport": "parallel transport",
        "microscopeRole": "surface-scale analytic function, not camera",
        "defaultPalette": "magenta",
        "paletteCount": 7,
        "stageOverlayText": 0,
        "userFacingTriangleMetric": False,
        "desktopBrowserQA": False,
        "mobile390x844QA": False,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (out / "QA_DIRECT.json").write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(qa, ensure_ascii=False))


if __name__ == "__main__":
    main()
