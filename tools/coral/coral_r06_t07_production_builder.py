from __future__ import annotations

"""Production entrypoint for Coral R06-T07.

The base builder contains the first root-selection experiment.  This entrypoint
hardens it by selecting the anchored connected component after branch
retention, rather than guessing one root before pruning.
"""

import re

import coral_r06_t07_microscope_geometry as base


ROOT_CONNECTED_COMPONENT = r"""
function attachmentRootFromSet(ids){
  const minY=Math.min(...ids.map(i=>nodes[i].p[1])),
    maxY=Math.max(...ids.map(i=>nodes[i].p[1])),
    maxR=Math.max(...ids.map(i=>nodes[i].r)),
    minOrder=Math.min(...ids.map(i=>nodes[i].order));
  let root=ids[0],best=-Infinity;
  for(const i of ids){
    const n=nodes[i];
    if(Math.abs(n.order-minOrder)>1e-9)continue;
    const radiusScore=n.r/Math.max(maxR,1e-6),
      baseScore=1-clamp((n.p[1]-minY)/Math.max(maxY-minY,1e-6),0,1),
      degreeScore=Math.min(adjacency[i].length,5)/5,
      score=radiusScore*8+baseScore+degreeScore*.5;
    if(score>best){best=score;root=i}
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
      keep=!optional||(maxR>=fineThreshold&&coin<=Math.pow(Math.max(retention,.0001),.72));
    if(!keep)continue;
    candidatePaths++;
    for(let i=0;i<ids.length-1;i++)candidateKeys.add(edgeKey(ids[i],ids[i+1]));
  }
  const candidatePairs=edges.filter(([a,b])=>candidateKeys.has(edgeKey(a,b))),
    cadj=nodes.map(()=>[]);
  for(const [a,b] of candidatePairs){cadj[a].push(b);cadj[b].push(a)}

  const visited=new Set(),components=[];
  for(let seed=0;seed<nodes.length;seed++){
    if(visited.has(seed)||cadj[seed].length===0)continue;
    const component=[],queue=[seed];visited.add(seed);
    while(queue.length){
      const a=queue.shift();component.push(a);
      for(const b of cadj[a])if(!visited.has(b)){visited.add(b);queue.push(b)}
    }
    components.push(component);
  }
  if(components.length===0){
    return{root:0,paths:[],activePairs:[],activeAdj:nodes.map(()=>[]),reached:new Set(),candidatePaths,
      candidateEdges:0,prunedDisconnectedEdges:0,componentCount:0,anchoredComponentNodes:0};
  }

  const globalMinOrder=Math.min(...nodes.map(n=>n.order));
  let anchored=components[0],best=-Infinity;
  for(const component of components){
    const compMinOrder=Math.min(...component.map(i=>nodes[i].order)),
      maxR=Math.max(...component.map(i=>nodes[i].r)),
      xs=component.map(i=>nodes[i].p[0]),ys=component.map(i=>nodes[i].p[1]),zs=component.map(i=>nodes[i].p[2]),
      span=(Math.max(...xs)-Math.min(...xs))+(Math.max(...ys)-Math.min(...ys))+(Math.max(...zs)-Math.min(...zs)),
      anchoredOrder=Math.abs(compMinOrder-globalMinOrder)<1e-9?1:0,
      score=anchoredOrder*1e9+component.length*1e5+span*1e3+maxR*100;
    if(score>best){best=score;anchored=component}
  }

  const reached=new Set(anchored),root=attachmentRootFromSet(anchored),
    activePairs=candidatePairs.filter(([a,b])=>reached.has(a)&&reached.has(b)),
    activeAdj=nodes.map(()=>[]);
  for(const [a,b] of activePairs){activeAdj[a].push(b);activeAdj[b].push(a)}
  const paths=extractPathsFromGraph(activeAdj,activePairs);
  return{
    root,paths,activePairs,activeAdj,reached,candidatePaths,
    candidateEdges:candidatePairs.length,
    prunedDisconnectedEdges:candidatePairs.length-activePairs.length,
    componentCount:components.length,anchoredComponentNodes:anchored.length
  };
}
const ROOT_NODE=attachmentRootFromSet(nodes.map((_,i)=>i));
""".strip()


pattern = re.compile(
    r"function attachmentRoot\(\)\{.*?const ROOT_NODE=attachmentRoot\(\);",
    flags=re.S,
)
base.GRAPH_HELPERS_T07, replacements = pattern.subn(
    ROOT_CONNECTED_COMPONENT,
    base.GRAPH_HELPERS_T07,
    count=1,
)
if replacements != 1:
    raise RuntimeError(f"expected one root graph block, replaced {replacements}")

# Surface component-selection evidence in the runtime QA record.
needle = "rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,allActiveRootConnected:true,disconnectedActiveEdges:0,"
replacement = (
    "rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,componentCount:graph.componentCount,"
    "anchoredComponentNodes:graph.anchoredComponentNodes,allActiveRootConnected:true,disconnectedActiveEdges:0,"
)
if needle not in base.REBUILD_T07:
    raise RuntimeError("runtime QA insertion point missing")
base.REBUILD_T07 = base.REBUILD_T07.replace(needle, replacement, 1)

if __name__ == "__main__":
    base.main()
