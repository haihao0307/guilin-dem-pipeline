from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    require(count == 1, f"{label}: expected exactly one match, found {count}")
    return updated


CONTINUOUS_TUBE_T07 = r"""
function continuousTube(m,samples,col,sides=10,rough=.22,capStart=false,capEnd=false){
  if(samples.length<2)return{rings:0,samples:0,dispCount:0,mediumSq:0,microSq:0,maxMedium:0,maxMicro:0,tipCount:0,tipExtension:0};
  const work=samples.map((s,i)=>({p:s.p.slice(),r:s.r,order:s.order,seed:(s.seed??(i*0.61803398875))}));
  const tipNorm=clamp((cfg.tip-.45)/1.0,0,1);
  const addClosure=(atStart)=>{
    const base=atStart?work[0]:work[work.length-1],inside=atStart?work[1]:work[work.length-2],
      outward=norm(sub(base.p,inside.p)),r=Math.max(base.r,.0001),
      distances=[mix(.24,.42,tipNorm),mix(.47,.77,tipNorm),mix(.68,1.08,tipNorm),mix(.82,1.36,tipNorm)],
      radii=[mix(.56,.98,tipNorm),mix(.25,.82,tipNorm),mix(.08,.48,tipNorm),.018],
      points=distances.map((d,i)=>({p:add(base.p,mul(outward,r*d)),r:r*radii[i],order:base.order,seed:base.seed+i*.173}));
    if(atStart)work.unshift(points[3],points[2],points[1],points[0]);else work.push(...points);
    return r*distances[3];
  };
  let tipCount=0,tipExtension=0;
  if(capStart){tipExtension+=addClosure(true);tipCount++}
  if(capEnd){tipExtension+=addClosure(false);tipCount++}
  const frames=transportFrames(work),rings=[];
  let arc=0,dispCount=0,mediumSq=0,microSq=0,maxMedium=0,maxMicro=0;
  for(let i=0;i<work.length;i++){
    if(i)arc+=len(sub(work[i].p,work[i-1].p));
    const F=frames[i],ring=[],baseR=Math.max(work[i].r,.0001),order=work[i].order||0,
      branchAtten=clamp(baseR/.16,.24,1)*clamp(1-order*.035,.66,1),
      cupFreq=6.0+cfg.cupScale*.72,angularBands=3+Math.floor(cfg.cupScale/14),
      seed=(work[i].seed||0)+order*.137;
    for(let j=0;j<sides;j++){
      const q=j/sides*TAU,cs=Math.cos(q),sn=Math.sin(q),
        radial=norm(add(mul(F.n,cs),mul(F.b,sn))),
        medium=rough*branchAtten*(.070*Math.sin(q*3+arc*4.1+seed*5.3)+.040*Math.sin(q*5-arc*2.6+seed*9.7)),
        u=.5+.5*Math.cos(arc*cupFreq+seed*TAU),
        v=.5+.5*Math.cos(q*angularBands+arc*cupFreq*.23+seed*3.1),
        cell=Math.pow(clamp(u*v,0,1),2.6),
        rim=Math.pow(clamp(1-Math.abs(Math.sqrt(Math.max(cell,0))-.58)/.23,0,1),2),
        cupBand=branchAtten*cfg.micro*(.078*rim-.105*cfg.cupDepth*cell),
        ridgeBand=branchAtten*cfg.micro*.042*Math.sin(q*(angularBands+2)-arc*(cupFreq*.46)+seed*7.7),
        grainBand=branchAtten*cfg.micro*cfg.grain*.034*Math.sin(q*9+arc*(cupFreq*1.73)+seed*17.1)
          *Math.sin(q*4-arc*(cupFreq*.81)+seed*11.9),
        micro=clamp(cupBand+ridgeBand+grainBand,-.17,.19),
        scale=clamp(1+medium+micro,.72,1.30),
        p=add(work[i].p,mul(radial,baseR*cfg.thickness*scale));
      ring.push({p,n:radial});
      dispCount++;mediumSq+=medium*medium;microSq+=micro*micro;
      maxMedium=Math.max(maxMedium,Math.abs(medium));maxMicro=Math.max(maxMicro,Math.abs(micro));
    }
    rings.push(ring);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const k=(j+1)%sides,A=rings[i][j],B=rings[i][k],C=rings[i+1][k],D=rings[i+1][j];
    m.q(A.p,B.p,C.p,D.p,col,A.n,B.n,C.n,D.n);
  }
  return{rings:rings.length,samples:work.length,dispCount,mediumSq,microSq,maxMedium,maxMicro,tipCount,tipExtension};
}
"""

GRAPH_HELPERS_T07 = r"""
const growthPaths=extractGrowthPaths();
function extractPathsFromGraph(adj,edgePairs){
  const seen=new Set(),paths=[];
  for(let start=0;start<nodes.length;start++){
    if(adj[start].length===0||adj[start].length===2)continue;
    for(const first of adj[start]){
      const k=edgeKey(start,first);if(seen.has(k))continue;
      const ids=[start];let prev=start,cur=first;seen.add(k);
      while(true){
        ids.push(cur);if(adj[cur].length!==2)break;
        const next=adj[cur][0]===prev?adj[cur][1]:adj[cur][0],ek=edgeKey(cur,next);
        if(seen.has(ek))break;seen.add(ek);prev=cur;cur=next;
      }
      if(ids.length>1)paths.push(ids);
    }
  }
  for(const [a,b] of edgePairs){
    const k=edgeKey(a,b);if(seen.has(k))continue;
    const ids=[a],origin=a;let prev=a,cur=b;seen.add(k);
    for(let guard=0;guard<nodes.length+2;guard++){
      ids.push(cur);const nexts=adj[cur].filter(x=>x!==prev),next=nexts[0];
      if(next===undefined||next===origin)break;
      const ek=edgeKey(cur,next);if(seen.has(ek))break;
      seen.add(ek);prev=cur;cur=next;
    }
    if(ids.length>1)paths.push(ids);
  }
  return paths;
}
function attachmentRoot(){
  let root=0,minY=nodes[0].p[1];
  for(let i=1;i<nodes.length;i++){
    const y=nodes[i].p[1];
    if(y<minY-1e-7||(Math.abs(y-minY)<1e-7&&nodes[i].r>nodes[root].r)){root=i;minY=y}
  }
  return root;
}
function buildRootConnectedGraph(retention,fineThreshold){
  const candidateKeys=new Set();
  let candidatePaths=0;
  for(const ids of growthPaths){
    const maxR=ids.reduce((m,id)=>Math.max(m,nodes[id].r),0),
      pathOrder=ids.reduce((m,id)=>Math.max(m,nodes[id].order),0),
      optional=pathOrder>=4||maxR<.125,
      coin=h01(ids[0]*92821+ids[ids.length-1]*68917),
      containsRoot=ids.includes(ROOT_NODE),
      keep=containsRoot||!optional||(maxR>=fineThreshold&&coin<=Math.pow(Math.max(retention,.0001),.72));
    if(!keep)continue;
    candidatePaths++;
    for(let i=0;i<ids.length-1;i++)candidateKeys.add(edgeKey(ids[i],ids[i+1]));
  }
  const candidatePairs=edges.filter(([a,b])=>candidateKeys.has(edgeKey(a,b))),
    cadj=nodes.map(()=>[]);
  for(const [a,b] of candidatePairs){cadj[a].push(b);cadj[b].push(a)}
  const reached=new Set([ROOT_NODE]),queue=[ROOT_NODE];
  while(queue.length){
    const a=queue.shift();
    for(const b of cadj[a])if(!reached.has(b)){reached.add(b);queue.push(b)}
  }
  const activePairs=candidatePairs.filter(([a,b])=>reached.has(a)&&reached.has(b)),
    activeAdj=nodes.map(()=>[]);
  for(const [a,b] of activePairs){activeAdj[a].push(b);activeAdj[b].push(a)}
  const paths=extractPathsFromGraph(activeAdj,activePairs);
  return{
    root:ROOT_NODE,paths,activePairs,activeAdj,reached,candidatePaths,
    candidateEdges:candidatePairs.length,
    prunedDisconnectedEdges:candidatePairs.length-activePairs.length
  };
}
const ROOT_NODE=attachmentRoot();
"""

REBUILD_T07 = r"""
function rebuild(){
  const m=new Mesh(),dbg=[];
  let tubeSamples=0,tubeRings=0,dispCount=0,mediumSq=0,microSq=0,maxMedium=0,maxMicro=0,
    tipCount=0,tipExtension=0,verrucaeCount=0;
  const retention=clamp(cfg.fineRetention??.22,0,1),fineThreshold=.025+(1-retention)*.075;
  cfg.fine=fineThreshold;
  const graph=buildRootConnectedGraph(retention,fineThreshold),activePaths=graph.paths,
    activeEdges=graph.activePairs.length,activeNodeCount=graph.reached.size;
  const absorb=(stat)=>{
    tubeSamples+=stat.samples;tubeRings+=stat.rings;dispCount+=stat.dispCount||0;
    mediumSq+=stat.mediumSq||0;microSq+=stat.microSq||0;
    maxMedium=Math.max(maxMedium,stat.maxMedium||0);maxMicro=Math.max(maxMicro,stat.maxMicro||0);
    tipCount+=stat.tipCount||0;tipExtension+=stat.tipExtension||0;
  };
  for(const ids of activePaths){
    if(ids.length<2)continue;
    const first=ids[0],last=ids[ids.length-1],samples=pathSamples(ids,3);
    for(let i=0;i<samples.length;i++)samples[i].seed=(first*.013+last*.029+i*.071)%1;
    const order=samples.reduce((v,s)=>Math.max(v,s.order),0),col=colorFor(order),
      startTip=graph.activeAdj[first].length===1&&nodes[first].p[1]>.30,
      endTip=graph.activeAdj[last].length===1&&nodes[last].p[1]>.30;
    absorb(continuousTube(m,samples,col,10,cfg.rough,startTip,endTip));
  }
  for(const i of graph.reached){
    const n=nodes[i],degree=graph.activeAdj[i].length;
    if(degree>=3){
      const rad=n.r*cfg.thickness*.86;
      junctionPatch(m,n.p,rad,colorFor(n.order),5,10);
    }
    if(cfg.diag==='tips'&&degree!==2&&degree>0){
      const isTip=degree===1,c=isTip?colors.tip:colors.node;
      dbg.push(...n.p,0,1,0,...c);
    }
  }
  if(cfg.verrucae>0){
    for(const [ai,bi] of graph.activePairs){
      const A=nodes[ai],B=nodes[bi],rr=Math.min(A.r,B.r);
      if(rr<Math.max(cfg.fine,.046))continue;
      const chance=h01(ai*92821+bi*68917);
      if(chance>=cfg.verrucae*.38)continue;
      const t=.18+.64*h01(ai*311+bi*47),p=add(A.p,mul(sub(B.p,A.p),t)),
        w=norm(sub(B.p,A.p)),u=norm(cross(Math.abs(w[1])<.86?[0,1,0]:[1,0,0],w)),
        v=cross(w,u),ang=TAU*h01(ai*71+bi*131),
        out=norm(add(mul(u,Math.cos(ang)),mul(v,Math.sin(ang)))),
        L=rr*(.38+cfg.verrucae*(.72+.50*h01(ai*17+bi*19))),
        side=mul(w,L*(.06+.08*cfg.verrucae)),tip=add(add(p,mul(out,L)),side),
        mid=add(add(p,mul(out,L*.50)),mul(side,.36)),
        order=Math.max(A.order,B.order),
        bud=[
          {p,r:rr*(.23+.15*cfg.verrucae),order,seed:(ai+bi)*.017},
          {p:mid,r:rr*(.17+.13*cfg.verrucae),order:order+1,seed:(ai+bi)*.031},
          {p:tip,r:rr*(.10+.09*cfg.verrucae),order:order+1,seed:(ai+bi)*.047}
        ];
      absorb(continuousTube(m,bud,colorFor(order+1),8,cfg.rough,false,true));
      verrucaeCount++;
    }
  }
  upload(genGpu,m.d);upload(dbgGpu,dbg,gl.POINTS);
  const ext=m.max.map((x,i)=>x-m.min[i]),refExt=[4,3.077359,1.840004],
    eWH=Math.abs(ext[0]/ext[1]-refExt[0]/refExt[1])/(refExt[0]/refExt[1]),
    eDH=Math.abs(ext[2]/ext[1]-refExt[2]/refExt[1])/(refExt[2]/refExt[1]),
    err=100*(eWH+eDH)/2,
    geometrySignature=(()=>{let s=0;for(let i=0;i<m.d.length;i+=170)s+=Math.abs(m.d[i]||0)*.73+Math.abs(m.d[i+1]||0)*1.37+Math.abs(m.d[i+2]||0)*2.11;return Number(s.toFixed(6))})(),
    mediumDisplacementRms=dispCount?Math.sqrt(mediumSq/dispCount):0,
    microDisplacementRms=dispCount?Math.sqrt(microSq/dispCount):0,
    tipExtensionMean=tipCount?tipExtension/tipCount:0;
  $('genExt').textContent=ext.map(x=>x.toFixed(3)).join(' : ');
  $('ratioErr').textContent=err.toFixed(1)+'%';
  $('ratioCard').className='qaCard '+(err<8?'good':err<16?'warn':'');
  $('extentCard').className='qaCard '+(err<8?'good':'');
  $('fieldStats').textContent=activePaths.length+' PATHS / '+tubeRings+' RINGS';
  $('pathStats').textContent=activePaths.length+' / '+tubeSamples;
  window.__CORAL_R06_QA__={
    ready:true,errors:[],referencePoints:ref.length,nodes:nodes.length,sourceEdges:edges.length,
    rootNode:graph.root,rootY:nodes[graph.root].p[1],candidatePaths:graph.candidatePaths,
    candidateEdges:graph.candidateEdges,activeEdges,growthPaths:activePaths.length,activeNodeCount,
    rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,allActiveRootConnected:true,disconnectedActiveEdges:0,
    fineRetention:retention,fineThreshold,tubeSamples,tubeRings,
    activeJunctions:[...graph.reached].filter(i=>graph.activeAdj[i].length>=3).length,
    extent:ext,aspectErrorPct:err,noExternalAssets:true,runtimeGLB:0,runtimeTextures:0,networkFetches:0,
    surfaceTextureBytes:0,continuousTube:true,frameTransport:'parallel-transport',
    microscopeRole:'true ring-normal geometry displacement',
    microscopeGeometry:true,microDetailMode:'3-band corallite / rim-ridge / skeletal-grain geometry field',
    mediumDisplacementRms,microDisplacementRms,maxMediumDisplacement:maxMedium,maxMicroDisplacement:maxMicro,
    tipExtensionMean,tipCount,verrucaeCount,geometrySignature,geometryVertexCount:m.d.length/10,
    palette:cfg.palette,visualAcceptance:false,productionReady:false
  };
}
"""

EVENTS_T07 = r"""
for(const k of ['thickness','tip','rough','point','verrucae','cupScale','cupDepth','grain','micro','glow','saturation']){
  const el=$(k),out=$(k+'O');
  el.oninput=()=>{
    cfg[k]=Number(el.value);out.value=Number(el.value).toFixed(k==='cupScale'?1:2);
    if(!['point','glow','saturation'].includes(k))rebuild();
    markT07();
  };
}
const fineEl=$('fine'),fineOut=$('fineO');
fineEl.oninput=()=>{cfg.fineRetention=Number(fineEl.value);fineOut.value=cfg.fineRetention.toFixed(3);rebuild();markT07()};
function markT07(){
  if(window.__CORAL_R06_QA__)Object.assign(window.__CORAL_R06_QA__,{
    t07:true,compactWorkbench:true,allAdjustablesGrouped:true,fineRetention:cfg.fineRetention,
    fineThreshold:cfg.fine,userFacingTriangleMetric:false,visualAcceptance:false,productionReady:false
  });
  window.__CORAL_R06_T07__={
    ready:true,version:'R06-T07',geometry:'continuous tube + root-connected pruning + 3-band ring-normal displacement',
    microscopeAffectsGeometry:true,tipClosure:'continuous variable blunt cap',rootConnectedPruning:true,
    adjustableControls:document.querySelectorAll('#parameterDock input[type=range]').length,
    visualAcceptance:false,productionReady:false
  };
}
$('thickness').value='0.92';$('thicknessO').value='0.92';cfg.thickness=.92;
fineEl.value='0.220';fineOut.value='0.220';cfg.fineRetention=.22;
rebuild();markT07();setView('persp');requestAnimationFrame(frame);
"""


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: coral_r06_t07_microscope_geometry.py <t06-index.html> <output-dir>")

    source = Path(sys.argv[1])
    out_dir = Path(sys.argv[2])
    html = source.read_text(encoding="utf-8")

    require("Compact Parameter Dock T06" in html, "unexpected source: T06 title missing")
    require("function continuousTube" in html and "function rebuild()" in html, "T06 runtime functions missing")
    require("window.__CORAL_R06_T06__" in html, "T06 QA marker missing")

    html = replace_once(
        html,
        "<title>Coral Mother R06 · Compact Parameter Dock T06</title>",
        "<title>Coral Mother R06 · Microscope Geometry T07</title>",
        "document title",
    )
    html = html.replace("PROCEDURAL · R06-T06", "PROCEDURAL · R06-T07")
    html = html.replace("FUNCTION · R06-T06", "FUNCTION · R06-T07")
    html = html.replace("Coral Mother R06 · T06", "Coral Mother R06 · T07")
    html = html.replace("Pocillopora 紧凑调参工作台 T06", "Pocillopora 微尺度形体工作台 T07")
    html = html.replace(
        "连续管状生长函数 + Microscope 表面场；0 GLB / 0 texture",
        "连续管状生长 + Microscope 真实形体位移；0 GLB / 0 texture",
    )
    html = html.replace(
        "继续保持标本／函数 A/B。枝图不再逐边造柱，而是提取连续生长路径，用平行传输截面生成完整管状枝体；Microscope 仅负责珊瑚杯、细脊和骨骼颗粒。",
        "继续保持标本／函数 A/B。T07 在连续管环上加入杯体、杯缘／细脊与骨骼颗粒三频真实位移，并以附着根连通遍历删除悬空枝。",
    )
    html = html.replace(
        "CONTINUOUS TUBE / MICROSCOPE SURFACE · visualAcceptance=false",
        "CONTINUOUS TUBE / MICROSCOPE GEOMETRY · visualAcceptance=false",
    )
    html = html.replace("Pocillopora 不应出现针尖", "连续管自身闭合；高值形成更长、更钝圆枝端")
    html = html.replace("仅微观频带，不改大轮廓", "中尺度真实轮廓起伏；0 平滑，1 明显")
    html = html.replace("短钝突起，不是细长分枝", "数量、半径和长度同步反馈；仍连接母枝")
    html = html.replace("珊瑚杯与杯缘频率；0 贴图", "只控制杯体／杯缘图形尺度与频率")
    html = html.replace("小杯、小脊的明暗深度", "杯口凹陷深度；同时参与真实形体")
    html = html.replace("高频粗糙；仅着色器计算", "高频骨骼颗粒；进入真实管环位移")
    html = html.replace("杯缘、细脊与颗粒的法线扰动", "杯体、杯缘、细脊与颗粒真实位移幅度")
    html = html.replace(
        "本轮先解决逐段圆柱造成的枝体断续：连续路径共享管环和截面框架，分叉仅在 junction 处平滑连接。Microscope 仍是低成本表面函数，不是镜头；物种级 corallite 与最终形态仍需继续 A/B 收敛。",
        "T07 已把 Microscope 从纯明暗推进到连续管环真实位移，并在细枝筛选后执行 root-connected traversal。所有显示枝体必须可沿父路径回到共同附着基底；仍需用户视觉批准。",
    )

    html = regex_once(
        html,
        r"function continuousTube\(m,samples,col,sides=10,rough=\.22,capStart=false,capEnd=false\)\{.*?\}\nfunction junctionPatch",
        CONTINUOUS_TUBE_T07.strip() + "\nfunction junctionPatch",
        "continuous tube geometry",
    )
    html = replace_once(
        html,
        "const growthPaths=extractGrowthPaths();",
        GRAPH_HELPERS_T07.strip(),
        "root-connected graph helpers",
    )
    html = regex_once(
        html,
        r"function rebuild\(\)\{.*?\}\n\nconst camera=",
        REBUILD_T07.strip() + "\n\nconst camera=",
        "T07 rebuild",
    )
    html = regex_once(
        html,
        r"for\(const k of \['thickness','tip','rough','point','verrucae','cupScale','cupDepth','grain','micro','glow','saturation'\]\)\{.*?\}\nconst fineEl=\$\('fine'\),fineOut=\$\('fineO'\);.*?rebuild\(\);markT06\(\);setView\('persp'\);requestAnimationFrame\(frame\);",
        EVENTS_T07.strip(),
        "T07 slider events",
    )

    html = html.replace("markT06()", "markT07()")
    html = html.replace("window.__CORAL_R06_T06__={", "window.__CORAL_R06_T06_ARCHIVE__={")
    html = html.replace("version:'R06-T06'", "version:'R06-T06-ARCHIVE'")
    html = html.replace(
        "microscopeRole:'surface scale only'",
        "microscopeRole:'archived shader-scale role; superseded by T07 geometry'",
    )
    html = html.replace("PROCEDURAL · R06-T05", "PROCEDURAL · R06-T07")

    t07_marker = r"""
<script id="t07-build-marker">
window.__CORAL_R06_T07_BUILD__={
  ready:true,version:'R06-T07',species:'Pocillopora damicornis',
  noaaBroadType:'Hard / stony coral',noaaGrowthForm:'Branching Coral',
  palauOccurrenceEvidence:'UNRESOLVED',
  geometryBands:['corallite-body','rim-ridge','skeletal-grain'],
  rootConnectedPruning:true,runtimeGLB:0,runtimeTextures:0,networkFetches:0,
  visualAcceptance:false,productionReady:false
};
</script>
"""
    html = replace_once(html, "</body>", t07_marker.strip() + "\n</body>", "T07 build marker")

    require("microscopeGeometry:true" in html, "microscope geometry QA marker missing")
    require("buildRootConnectedGraph" in html, "root-connected pruning missing")
    require("markT07" in html, "T07 slider binding missing")
    require("markT06()" not in html, "stale markT06 call remains")

    out_dir.mkdir(parents=True, exist_ok=True)
    index = out_dir / "index.html"
    index.write_text(html, encoding="utf-8")

    build = {
        "schema": "CORAL_MOTHER_R06_T07_MICROSCOPE_GEOMETRY_BUILD",
        "source": str(source),
        "bytes": len(html.encode("utf-8")),
        "sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
        "species": "Pocillopora damicornis",
        "classification": {
            "noaaBroadType": "Hard / stony coral",
            "noaaGrowthForm": "Branching Coral",
            "palauOccurrenceEvidence": "UNRESOLVED",
        },
        "geometry": {
            "continuousTube": True,
            "parallelTransport": True,
            "rootConnectedPruning": True,
            "microscopeRingNormalDisplacement": True,
            "bands": ["corallite-body", "rim-ridge", "skeletal-grain"],
            "variableContinuousTipClosure": True,
            "mediumScaleSurfaceRelief": True,
            "verrucaeConnectedToParent": True,
        },
        "adjustableControls": 12,
        "runtimeGLB": 0,
        "runtimeTextures": 0,
        "networkFetchCalls": 0,
        "visualAcceptance": False,
        "productionReady": False,
    }
    (out_dir / "BUILD_T07.json").write_text(
        json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (out_dir / "T07_IMPLEMENTATION_ZH.md").write_text(
        "# Coral Mother R06-T07 实现回执\n\n"
        "- Microscope 凹凸进入连续管环真实顶点位移。\n"
        "- 三频带：杯体、杯缘／细脊、骨骼颗粒。\n"
        "- 表面起伏改为中尺度轮廓位移。\n"
        "- 枝端钝化控制连续闭合长度与半径保持曲线，不增加球帽。\n"
        "- 细枝筛选后执行附着根 BFS，只生成 root-connected 路径、节点和疣突。\n"
        "- 运行时保持 0 GLB、0 外部贴图、0 fetch。\n"
        "- visualAcceptance=false；productionReady=false。\n",
        encoding="utf-8",
    )
    print(json.dumps(build, ensure_ascii=False))


if __name__ == "__main__":
    main()
