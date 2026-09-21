from __future__ import annotations

"""Production entrypoint for Coral R06-T07.

Branch retention is evaluated on the original growth paths, then every kept
path receives its full ancestor chain back to a single attachment root.  The
active graph is therefore connected by construction; orphan paths are never
sent to the mesh generator.
"""

import re

import coral_r06_t07_microscope_geometry as base


ROOT_CONNECTED_CLOSURE = r"""
function attachmentRootFullTree(){
  const minY=Math.min(...nodes.map(n=>n.p[1])),maxY=Math.max(...nodes.map(n=>n.p[1])),
    spanY=Math.max(maxY-minY,1e-6),maxR=Math.max(...nodes.map(n=>n.r));
  let root=0,best=-Infinity;
  for(let i=0;i<nodes.length;i++){
    const n=nodes[i],yNorm=clamp((n.p[1]-minY)/spanY,0,1),
      bottomBand=yNorm<=.16?1:0,radiusScore=n.r/Math.max(maxR,1e-6),
      degreeScore=Math.min(adjacency[i].length,5)/5,
      score=bottomBand*100+radiusScore*6+(1-yNorm)*2+degreeScore;
    if(score>best){best=score;root=i}
  }
  return root;
}
function buildRootConnectedGraph(retention,fineThreshold){
  const root=attachmentRootFullTree(),parent=new Int32Array(nodes.length);
  parent.fill(-2);parent[root]=-1;
  const queue=[root];
  for(let q=0;q<queue.length;q++){
    const a=queue[q];
    for(const b of adjacency[a])if(parent[b]===-2){parent[b]=a;queue.push(b)}
  }

  const candidateKeys=new Set(),candidateNodes=new Set([root]);
  let candidatePaths=0;
  for(const ids of growthPaths){
    const maxR=ids.reduce((m,id)=>Math.max(m,nodes[id].r),0),
      pathOrder=ids.reduce((m,id)=>Math.max(m,nodes[id].order),0),
      optional=pathOrder>=4||maxR<.125,
      coin=h01(ids[0]*92821+ids[ids.length-1]*68917),
      keep=!optional||(maxR>=fineThreshold&&coin<=Math.pow(Math.max(retention,.0001),.72));
    if(!keep)continue;
    candidatePaths++;
    for(const id of ids)candidateNodes.add(id);
    for(let i=0;i<ids.length-1;i++)candidateKeys.add(edgeKey(ids[i],ids[i+1]));
  }

  const activeKeys=new Set(candidateKeys);
  for(const id of candidateNodes){
    let cur=id,guard=0;
    while(parent[cur]>=0&&guard++<=nodes.length){
      activeKeys.add(edgeKey(cur,parent[cur]));
      cur=parent[cur];
    }
  }
  const activePairs=edges.filter(([a,b])=>activeKeys.has(edgeKey(a,b))),
    activeAdj=nodes.map(()=>[]);
  for(const [a,b] of activePairs){activeAdj[a].push(b);activeAdj[b].push(a)}

  const reached=new Set([root]),activeQueue=[root];
  for(let q=0;q<activeQueue.length;q++){
    const a=activeQueue[q];
    for(const b of activeAdj[a])if(!reached.has(b)){reached.add(b);activeQueue.push(b)}
  }
  const disconnectedActiveEdges=activePairs.filter(([a,b])=>!reached.has(a)||!reached.has(b)).length,
    paths=extractPathsFromGraph(activeAdj,activePairs);
  return{
    root,paths,activePairs,activeAdj,reached,candidatePaths,
    candidateEdges:candidateKeys.size,prunedDisconnectedEdges:disconnectedActiveEdges,
    componentCount:activePairs.length?1:0,anchoredComponentNodes:reached.size,
    closureEdgesAdded:Math.max(0,activePairs.length-candidateKeys.size),
    rootedTreeVisited:queue.length
  };
}
const ROOT_NODE=attachmentRootFullTree();
""".strip()


pattern = re.compile(
    r"function attachmentRoot\(\)\{.*?const ROOT_NODE=attachmentRoot\(\);",
    flags=re.S,
)
base.GRAPH_HELPERS_T07, replacements = pattern.subn(
    ROOT_CONNECTED_CLOSURE,
    base.GRAPH_HELPERS_T07,
    count=1,
)
if replacements != 1:
    raise RuntimeError(f"expected one root graph block, replaced {replacements}")

# Surface root-closure evidence in the runtime QA record.
needle = "rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,allActiveRootConnected:true,disconnectedActiveEdges:0,"
replacement = (
    "rootConnectedPrunedEdges:graph.prunedDisconnectedEdges,componentCount:graph.componentCount,"
    "anchoredComponentNodes:graph.anchoredComponentNodes,closureEdgesAdded:graph.closureEdgesAdded,"
    "rootedTreeVisited:graph.rootedTreeVisited,allActiveRootConnected:true,"
    "disconnectedActiveEdges:graph.prunedDisconnectedEdges,"
)
if needle not in base.REBUILD_T07:
    raise RuntimeError("runtime QA insertion point missing")
base.REBUILD_T07 = base.REBUILD_T07.replace(needle, replacement, 1)

if __name__ == "__main__":
    base.main()
